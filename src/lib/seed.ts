import { prisma } from "@/lib/db";
import {
  calculateLineItem,
  calculateEstimateTotals,
  calculateInteriorRoomMetrics,
  conditionMultiplier,
} from "@/lib/calculations";
import {
  INTERIOR_PRODUCTION_RATES,
  SUPPORTING_PRODUCTION_RATES,
  toProductionRateRow,
} from "@/lib/interior-production-rates";
import {
  buildPremiumSwDefaults,
  parseSurfaceProductDefaults,
  serializeSurfaceProductDefaults,
} from "@/lib/surface-product-defaults";

/**
 * Process-local gate so navigation/list reads do not re-run seed checks.
 * Resets only if the initial seed attempt fails (allows retry).
 */
let seededPromise: Promise<void> | null = null;

/** Ensure business settings + seed catalogs exist (first-run safe). */
export async function ensureSeeded() {
  if (!seededPromise) {
    seededPromise = runEnsureSeeded().catch((err) => {
      seededPromise = null;
      throw err;
    });
  }
  return seededPromise;
}

async function runEnsureSeeded() {
  const [settings, productCount, rateCount] = await Promise.all([
    prisma.businessSettings.findFirst({ select: { id: true } }),
    prisma.paintProduct.count(),
    prisma.productionRate.count(),
  ]);

  // Hot path: catalogs already exist. Skip sync/migration churn that used to
  // fire dozens of remote DB round-trips on every cold start / first nav.
  if (settings && productCount > 0 && rateCount > 0) {
    return;
  }

  if (!settings) {
    await prisma.businessSettings.create({
      data: {
        companyName: "Summit Coatings Co.",
        address: "1240 Industrial Blvd",
        city: "Denver",
        state: "CO",
        zip: "80216",
        phone: "(303) 555-0142",
        email: "estimates@summitcoatings.example",
        website: "www.summitcoatings.example",
        defaultLaborRate: 55,
        materialMarkupPct: 25,
        taxRatePct: 0,
        wasteFactorPct: 12,
        defaultPrepPct: 30,
        defaultProfitTargetPct: 35,
        defaultCoverageSqftPerGallon: 375,
        doorDeductionSqft: 20,
        windowDeductionSqft: 15,
      },
    });
  }

  if (productCount === 0) {
    for (const product of SEED_PRODUCTS) {
      const { sheens, ...rest } = product;
      const sheenList = sheens?.length ? sheens : rest.sheen ? [rest.sheen] : [];
      await prisma.paintProduct.create({
        data: {
          ...rest,
          sheen: sheenList[0] ?? rest.sheen ?? null,
          sheens: {
            create: sheenList.map((name, sortOrder) => ({ name, sortOrder })),
          },
        },
      });
    }
    await ensureProductSheens();
    await syncExteriorStuccoProduct();
  }

  if (rateCount === 0) {
    await prisma.productionRate.createMany({
      data: SEED_RATES,
    });
    await syncInteriorProductionRates();
    await ensureExteriorStuccoRate();
  }

  const customerCount = await prisma.customer.count();
  if (customerCount === 0) {
    await seedDemoEstimate();
  }

  await syncSurfaceProductDefaults();
}

/** Fill company surface→product defaults with premium SW presets when empty. */
async function syncSurfaceProductDefaults() {
  const settings = await prisma.businessSettings.findFirst({
    select: { id: true },
  });
  if (!settings) return;

  try {
    // Requires migration `20260718120000_surface_default_products` (DDL via owner, not app role).
    const rows = await prisma.$queryRaw<
      Array<{ defaultProductsJson: string | null }>
    >`SELECT "defaultProductsJson" FROM "BusinessSettings" WHERE id = ${settings.id}`;
    const existing = parseSurfaceProductDefaults(
      rows[0]?.defaultProductsJson ?? null
    );
    if (Object.keys(existing).length > 0) return;

    const products = await prisma.paintProduct.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sheen: true,
        defaultSurfaceType: true,
        sheens: { select: { name: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    const map = buildPremiumSwDefaults(products);
    const json = serializeSurfaceProductDefaults(map);
    if (!json) return;
    await prisma.$executeRaw`
      UPDATE "BusinessSettings"
      SET "defaultProductsJson" = ${json}
      WHERE id = ${settings.id}
    `;
  } catch (err) {
    // Column missing until migration is applied with a table owner / DIRECT_URL.
    console.warn(
      "[seed] Skipping surface product defaults sync (run migration for defaultProductsJson):",
      err instanceof Error ? err.message : err
    );
  }
}

/** Push INTERIOR_PRODUCTION_RATES into an existing DB (match surfaceType + method). */
async function syncInteriorProductionRates() {
  const targets = [
    ...INTERIOR_PRODUCTION_RATES,
    ...SUPPORTING_PRODUCTION_RATES,
  ];
  for (const rate of targets) {
    const row = toProductionRateRow(rate);
    const matches = await prisma.productionRate.findMany({
      where: { surfaceType: row.surfaceType, method: row.method },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    const keep = matches[0];
    if (keep) {
      await prisma.productionRate.update({
        where: { id: keep.id },
        data: {
          measurementType: row.measurementType,
          ratePerManHour: row.ratePerManHour,
          firstCoatRate: row.firstCoatRate,
          additionalCoatRate: row.additionalCoatRate,
          effective2CoatRate: row.effective2CoatRate,
          defaultCoats: row.defaultCoats,
          notes: row.notes,
          sortOrder: row.sortOrder,
          isActive: true,
        },
      });
      const dupes = matches.slice(1).map((m) => m.id);
      if (dupes.length) {
        await prisma.productionRate.deleteMany({
          where: { id: { in: dupes } },
        });
      }
    } else {
      await prisma.productionRate.create({ data: row });
    }
  }

  // Spray smooth walls: scale to ~2× brush/roll target when still on old seed
  const spray = await prisma.productionRate.findFirst({
    where: { surfaceType: "Interior Walls Smooth", method: "Spray" },
  });
  if (spray && spray.ratePerManHour >= 300) {
    await prisma.productionRate.update({
      where: { id: spray.id },
      data: {
        ratePerManHour: 180,
        effective2CoatRate: 180,
        notes: "Spray + backroll — ~2× brush/roll smooth walls",
      },
    });
  }

  // Hide legacy interior aliases that the estimator no longer uses
  await prisma.productionRate.updateMany({
    where: {
      surfaceType: {
        in: [
          "Interior Walls",
          "Interior Doors (per side)",
          "Interior Windows (per unit)",
        ],
      },
    },
    data: { isActive: false },
  });
}

const SEED_PRODUCTS: Array<{
  name: string;
  brand: string;
  coverageSqftPerGallon: number;
  pricePerGallon: number;
  sheen?: string;
  sheens?: string[];
  category: string;
  defaultSurfaceType?: string;
  notes?: string;
  sortOrder: number;
}> = [
  {
    name: "Duration Home Interior",
    brand: "Sherwin-Williams",
    coverageSqftPerGallon: 375,
    pricePerGallon: 62,
    sheen: "Eggshell",
    sheens: ["Flat", "Matte", "Eggshell", "Satin", "Semi-Gloss"],
    category: "interior",
    defaultSurfaceType: "Interior Walls Smooth",
    sortOrder: 1,
  },
  {
    name: "Emerald Interior Acrylic Latex",
    brand: "Sherwin-Williams",
    coverageSqftPerGallon: 350,
    pricePerGallon: 78,
    sheen: "Satin",
    sheens: ["Flat", "Matte", "Eggshell", "Satin", "Semi-Gloss", "Gloss"],
    category: "interior",
    defaultSurfaceType: "Interior Walls Smooth",
    sortOrder: 2,
  },
  {
    name: "Cashmere Interior",
    brand: "Sherwin-Williams",
    coverageSqftPerGallon: 375,
    pricePerGallon: 55,
    sheen: "Eggshell",
    sheens: ["Flat", "Low Lustre", "Eggshell", "Pearl"],
    category: "interior",
    defaultSurfaceType: "Interior Walls Smooth",
    sortOrder: 3,
  },
  {
    name: "SuperPaint Interior",
    brand: "Sherwin-Williams",
    coverageSqftPerGallon: 375,
    pricePerGallon: 48,
    sheen: "Flat",
    sheens: ["Flat", "Satin", "Semi-Gloss"],
    category: "interior",
    sortOrder: 4,
  },
  {
    name: "ProMar 200 Zero VOC",
    brand: "Sherwin-Williams",
    coverageSqftPerGallon: 400,
    pricePerGallon: 32,
    sheen: "Flat",
    sheens: ["Flat", "Eg-Shel", "Semi-Gloss"],
    category: "interior",
    sortOrder: 5,
    notes: "Production / builder grade",
  },
  {
    name: "Duration Exterior Acrylic Latex",
    brand: "Sherwin-Williams",
    coverageSqftPerGallon: 300,
    pricePerGallon: 68,
    sheen: "Satin",
    sheens: ["Flat", "Satin", "Gloss"],
    category: "exterior",
    defaultSurfaceType: "Exterior Siding",
    sortOrder: 6,
  },
  {
    name: "Emerald Rain Refresh Exterior",
    brand: "Sherwin-Williams",
    coverageSqftPerGallon: 300,
    pricePerGallon: 82,
    sheen: "Satin",
    sheens: ["Flat", "Satin", "Gloss"],
    category: "exterior",
    defaultSurfaceType: "Exterior Siding",
    sortOrder: 7,
  },
  {
    name: "Emerald Urethane Trim Enamel",
    brand: "Sherwin-Williams",
    coverageSqftPerGallon: 250,
    pricePerGallon: 75,
    sheen: "Semi-Gloss",
    sheens: ["Satin", "Semi-Gloss", "Gloss"],
    category: "both",
    defaultSurfaceType: "Interior Trim / Baseboards",
    sortOrder: 8,
  },
  {
    name: "ProClassic Waterborne Acrylic",
    brand: "Sherwin-Williams",
    coverageSqftPerGallon: 250,
    pricePerGallon: 58,
    sheen: "Semi-Gloss",
    sheens: ["Satin", "Semi-Gloss", "Gloss"],
    category: "both",
    defaultSurfaceType: "Interior Trim / Baseboards",
    sortOrder: 9,
  },
  {
    name: "Multi-Purpose Latex Primer",
    brand: "Sherwin-Williams",
    coverageSqftPerGallon: 400,
    pricePerGallon: 28,
    sheen: "Flat",
    sheens: ["Flat"],
    category: "both",
    sortOrder: 10,
  },
  {
    name: "Exterior Stucco Coating",
    brand: "Sherwin-Williams",
    /** Can rating — when surface is Exterior Stucco, calc uses rating × 0.8 */
    coverageSqftPerGallon: 300,
    pricePerGallon: 45,
    sheen: "Flat",
    sheens: ["Flat"],
    category: "exterior",
    defaultSurfaceType: "Exterior Stucco",
    sortOrder: 11,
    notes:
      "On Exterior Stucco surfaces, spread = this rating × 0.8 (−20% coverage). Prefer any exterior product; the surface type applies the factor.",
  },
];

/** Keep stucco product spread at industry medium (~225 sf/gal). */
async function syncExteriorStuccoProduct() {
  const stucco = SEED_PRODUCTS.find(
    (p) => p.defaultSurfaceType === "Exterior Stucco"
  );
  if (!stucco) return;
  const existing = await prisma.paintProduct.findFirst({
    where: {
      OR: [
        { name: stucco.name },
        { defaultSurfaceType: "Exterior Stucco" },
      ],
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.paintProduct.update({
      where: { id: existing.id },
      data: {
        coverageSqftPerGallon: stucco.coverageSqftPerGallon,
        notes: stucco.notes ?? null,
        defaultSurfaceType: "Exterior Stucco",
        category: "exterior",
      },
    });
  } else {
    const { sheens, ...rest } = stucco;
    const sheenList = sheens?.length ? sheens : rest.sheen ? [rest.sheen] : [];
    await prisma.paintProduct.create({
      data: {
        ...rest,
        sheen: sheenList[0] ?? rest.sheen ?? null,
        sheens: {
          create: sheenList.map((name, sortOrder) => ({ name, sortOrder })),
        },
      },
    });
  }
}

async function ensureExteriorStuccoRate() {
  const seed = SEED_RATES.find((r) => r.surfaceType === "Exterior Stucco");
  if (!seed) return;
  const matches = await prisma.productionRate.findMany({
    where: { surfaceType: "Exterior Stucco", method: seed.method },
    select: { id: true },
  });
  if (matches[0]) {
    await prisma.productionRate.update({
      where: { id: matches[0].id },
      data: {
        ratePerManHour: seed.ratePerManHour,
        defaultCoats: seed.defaultCoats,
        notes: seed.notes,
        measurementType: seed.measurementType,
      },
    });
  } else {
    await prisma.productionRate.create({ data: seed });
  }
}

/** Ensure legacy products with a sheen string have PaintProductSheen rows. */
async function ensureProductSheens() {
  const products = await prisma.paintProduct.findMany({
    select: {
      id: true,
      sheen: true,
      sheens: { select: { id: true } },
    },
  });
  for (const p of products) {
    if (p.sheens.length > 0) continue;
    const name = p.sheen?.trim();
    if (!name) continue;
    await prisma.paintProductSheen.create({
      data: { paintProductId: p.id, name, sortOrder: 0 },
    });
  }
}

/**
 * Prompt-aligned production rates + legacy surfaces.
 * first/additional/effective2Coat where the prompt specifies them.
 */
const SEED_RATES = [
  // Interior targets (see src/lib/interior-production-rates.ts)
  ...INTERIOR_PRODUCTION_RATES.map(toProductionRateRow),
  {
    surfaceType: "Interior Walls Smooth",
    method: "Spray",
    measurementType: "area",
    ratePerManHour: 180,
    effective2CoatRate: 180,
    defaultCoats: 2,
    notes: "Spray + backroll — ~2× brush/roll smooth walls",
    sortOrder: 3,
  },
  {
    surfaceType: "Cabinet Boxes (per door)",
    method: "Spray",
    measurementType: "unit",
    ratePerManHour: 1.67,
    firstCoatRate: 1.667,
    additionalCoatRate: 3.333,
    defaultCoats: 2,
    notes: "0.6 hr first / 0.3 hr additional per door",
    sortOrder: 8,
  },
  {
    surfaceType: "Exterior Siding",
    method: "Brush/Roll",
    measurementType: "area",
    ratePerManHour: 125,
    defaultCoats: 2,
    notes: "Prompt: siding_wood_brushroll",
    sortOrder: 10,
  },
  {
    surfaceType: "Exterior Siding",
    method: "Spray",
    measurementType: "area",
    ratePerManHour: 275,
    defaultCoats: 2,
    notes: "Prompt: siding_wood_spray",
    sortOrder: 11,
  },
  {
    surfaceType: "Exterior Stucco",
    method: "Brush/Roll",
    measurementType: "area",
    ratePerManHour: 100,
    defaultCoats: 2,
    notes:
      "Stucco labor; paint gallons use product coverage × 0.8 (−20%)",
    sortOrder: 12,
  },
  {
    surfaceType: "Exterior Trim",
    method: "Brush",
    measurementType: "unit",
    ratePerManHour: 50,
    firstCoatRate: 50,
    additionalCoatRate: 100,
    defaultCoats: 2,
    notes: "LF/hr",
    sortOrder: 13,
  },
  {
    surfaceType: "Exterior Doors",
    method: "Brush",
    measurementType: "unit",
    ratePerManHour: 0.8,
    defaultCoats: 2,
    notes: "1.25 hrs/door → ~0.8 units/hr",
    sortOrder: 14,
  },
  {
    surfaceType: "Exterior Windows",
    method: "Brush",
    measurementType: "unit",
    ratePerManHour: 0.5,
    defaultCoats: 1,
    notes: "2.0 hrs/window → 0.5 units/hr",
    sortOrder: 15,
  },
  {
    surfaceType: "Garage Floor / Concrete",
    method: "Roll",
    measurementType: "area",
    ratePerManHour: 200,
    defaultCoats: 2,
    sortOrder: 16,
  },
  ...SUPPORTING_PRODUCTION_RATES.map(toProductionRateRow),
  {
    surfaceType: "Wallpaper Removal",
    method: "Hand",
    measurementType: "area",
    ratePerManHour: 40,
    defaultCoats: 1,
    sortOrder: 20,
  },
];

async function seedDemoEstimate() {
  const customer = await prisma.customer.create({
    data: {
      name: "Jennifer & Mark Walsh",
      email: "walsh.family@example.com",
      phone: "(720) 555-0198",
      address: "4821 Maple Grove Lane",
      city: "Littleton",
      state: "CO",
      zip: "80123",
      notes: "Demo customer — replace with your own.",
    },
  });

  const job = await prisma.job.create({
    data: {
      customerId: customer.id,
      title: "Bedroom refresh — sample",
      status: "estimating",
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zip: customer.zip,
    },
  });

  const products = await prisma.paintProduct.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const rates = await prisma.productionRate.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const wallsProduct =
    products.find((p) => p.name.includes("Duration Home")) ?? products[0];
  const trimProduct =
    products.find((p) => p.name.includes("Emerald Urethane")) ?? products[0];
  const wallsRate =
    rates.find((r) => r.surfaceType === "Interior Walls Smooth") ?? rates[0];
  const ceilRate =
    rates.find((r) => r.surfaceType === "Interior Ceilings") ?? rates[0];
  const trimRate =
    rates.find((r) => r.surfaceType.includes("Trim / Baseboards")) ?? rates[0];

  const settings = await prisma.businessSettings.findFirstOrThrow();
  const metrics = calculateInteriorRoomMetrics({
    lengthFt: 12,
    widthFt: 15,
    heightFt: 8,
    doorCount: 2,
    windowCount: 2,
    doorDeductionSqft: settings.doorDeductionSqft,
    windowDeductionSqft: settings.windowDeductionSqft,
  });

  const estimate = await prisma.estimate.create({
    data: {
      customerId: customer.id,
      jobId: job.id,
      title: "Sample Bedroom — 12×15×8",
      estimateNumber: "EST-1001",
      status: "draft",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes:
        "Sample 12×15×8 bedroom with 2 doors, 2 windows — 2 coats walls/ceiling/trim.",
      prepPct: settings.defaultPrepPct,
    },
  });

  const surfaceDefs = [
    {
      description: "Master Bedroom — Walls (smooth)",
      surfaceType: "Interior Walls Smooth",
      measurementType: "area" as const,
      inputAreaSqft: metrics.wallNetSqft,
      quantity: null as number | null,
      unitLabel: null as string | null,
      coats: 2,
      method: "Brush/Roll",
      paintProductId: wallsProduct.id,
      productionRateId: wallsRate.id,
      sortOrder: 0,
    },
    {
      description: "Master Bedroom — Ceiling",
      surfaceType: "Interior Ceilings",
      measurementType: "area" as const,
      inputAreaSqft: metrics.ceilingSqft,
      quantity: null,
      unitLabel: null,
      coats: 2,
      method: "Brush/Roll",
      paintProductId: wallsProduct.id,
      productionRateId: ceilRate.id,
      sortOrder: 1,
    },
    {
      description: "Master Bedroom — Trim & baseboards",
      surfaceType: "Interior Trim / Baseboards",
      measurementType: "unit" as const,
      inputAreaSqft: null,
      quantity: metrics.trimLf,
      unitLabel: "lf",
      coats: 2,
      method: "Brush",
      paintProductId: trimProduct.id,
      productionRateId: trimRate.id,
      sortOrder: 2,
    },
  ];

  const materialCosts: number[] = [];
  const laborCosts: number[] = [];
  const lineTotals: number[] = [];
  const laborHours: number[] = [];
  const prepHours: number[] = [];
  const cond = conditionMultiplier("medium");

  const computedSurfaces = surfaceDefs.map((li) => {
    const product =
      products.find((p) => p.id === li.paintProductId) ?? products[0];
    const rate = rates.find((r) => r.id === li.productionRateId) ?? rates[0];
    const calc = calculateLineItem({
      measurementType: li.measurementType,
      inputAreaSqft: li.inputAreaSqft,
      quantity: li.quantity,
      unitLabel: li.unitLabel,
      surfaceType: li.surfaceType,
      coats: li.coats,
      coverageSqftPerGallon: product.coverageSqftPerGallon,
      pricePerGallon: product.pricePerGallon,
      productionRatePerManHour: rate.ratePerManHour,
      firstCoatRate: rate.firstCoatRate,
      additionalCoatRate: rate.additionalCoatRate,
      effective2CoatRate: rate.effective2CoatRate,
      wasteFactorPct: settings.wasteFactorPct,
      materialMarkupPct: settings.materialMarkupPct,
      laborRate: settings.defaultLaborRate,
      conditionMultiplier: cond,
      prepPct: settings.defaultPrepPct,
      surfaceLabel: li.description,
    });
    materialCosts.push(calc.materialCost);
    laborCosts.push(calc.laborCost);
    lineTotals.push(calc.lineTotal);
    laborHours.push(calc.laborHours);
    prepHours.push(calc.prepHours);
    return { ...li, calc };
  });

  await prisma.estimateRoom.create({
    data: {
      estimateId: estimate.id,
      name: "Master Bedroom",
      kind: "interior",
      lengthFt: 12,
      widthFt: 15,
      heightFt: 8,
      doorCount: 2,
      windowCount: 2,
      condition: "medium",
      sortOrder: 0,
      notes: JSON.stringify({ metricsShowWork: metrics.showWork }),
      surfaces: {
        create: computedSurfaces.map(({ calc, ...li }) => ({
          estimateId: estimate.id,
          ...li,
          conditionMultiplier: cond,
          dimensionsJson: JSON.stringify({ roomMetrics: metrics }),
          gallons: calc.gallons,
          laborHours: calc.laborHours,
          prepHours: calc.prepHours,
          materialCost: calc.materialCost,
          laborCost: calc.laborCost,
          lineTotal: calc.lineTotal,
        })),
      },
    },
  });

  const totals = calculateEstimateTotals({
    lineTotals,
    materialCosts,
    laborCosts,
    laborHours,
    prepHours,
    taxRatePct: settings.taxRatePct,
  });

  await prisma.estimate.update({
    where: { id: estimate.id },
    data: {
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
    },
  });
}
