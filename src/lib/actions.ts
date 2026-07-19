"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { customerSchema, jobSchema, businessSettingsSchema } from "@/lib/validators";
import {
  calculateLineItem,
  calculateEstimateTotals,
  conditionMultiplier,
} from "@/lib/calculations";
import { calculatePaintPackaging } from "@/lib/paint-packaging";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

async function boot() {
  await ensureSeeded();
}

async function readDefaultProductsJson(
  settingsId: string
): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ defaultProductsJson: string | null }>
    >`SELECT "defaultProductsJson" FROM "BusinessSettings" WHERE id = ${settingsId}`;
    return rows[0]?.defaultProductsJson ?? null;
  } catch {
    return null;
  }
}

// ─── Settings ───────────────────────────────────────────────
export async function getSettings() {
  await boot();
  try {
    const settings = await prisma.businessSettings.findFirstOrThrow();
    const defaultProductsJson =
      (settings as { defaultProductsJson?: string | null }).defaultProductsJson ??
      (await readDefaultProductsJson(settings.id));
    return { ...settings, defaultProductsJson };
  } catch (err) {
    // Schema ahead of DB (missing columns): load core columns via raw SQL.
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        companyName: string;
        logoPath: string | null;
        address: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        phone: string | null;
        email: string | null;
        website: string | null;
        defaultLaborRate: number;
        materialMarkupPct: number;
        taxRatePct: number;
        wasteFactorPct: number;
        defaultPrepPct: number;
        defaultProfitTargetPct: number;
        defaultCoverageSqftPerGallon: number;
        doorDeductionSqft: number;
        windowDeductionSqft: number;
        termsAndConditions: string;
      }>
    >`
      SELECT
        id, "companyName", "logoPath", address, city, state, zip, phone, email, website,
        "defaultLaborRate", "materialMarkupPct", "taxRatePct", "wasteFactorPct",
        "defaultPrepPct", "defaultProfitTargetPct", "defaultCoverageSqftPerGallon",
        "doorDeductionSqft", "windowDeductionSqft", "termsAndConditions"
      FROM "BusinessSettings"
      ORDER BY "createdAt" ASC
      LIMIT 1
    `;
    const settings = rows[0];
    if (!settings) throw err;
    const defaultProductsJson = await readDefaultProductsJson(settings.id);
    return { ...settings, defaultProductsJson };
  }
}

export async function updateSettings(data: unknown) {
  const parsed = businessSettingsSchema.parse(data);
  const existing = await prisma.businessSettings.findFirstOrThrow();
  const updated = await prisma.businessSettings.update({
    where: { id: existing.id },
    data: {
      companyName: parsed.companyName,
      logoPath: parsed.logoPath ?? null,
      address: parsed.address ?? null,
      city: parsed.city ?? null,
      state: parsed.state ?? null,
      zip: parsed.zip ?? null,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      website: parsed.website ?? null,
      defaultLaborRate: parsed.defaultLaborRate,
      materialMarkupPct: parsed.materialMarkupPct,
      taxRatePct: parsed.taxRatePct,
      wasteFactorPct: parsed.wasteFactorPct,
      defaultPrepPct: parsed.defaultPrepPct ?? existing.defaultPrepPct,
      defaultProfitTargetPct:
        parsed.defaultProfitTargetPct ?? existing.defaultProfitTargetPct,
      defaultCoverageSqftPerGallon:
        parsed.defaultCoverageSqftPerGallon ??
        existing.defaultCoverageSqftPerGallon,
      doorDeductionSqft: parsed.doorDeductionSqft ?? existing.doorDeductionSqft,
      windowDeductionSqft:
        parsed.windowDeductionSqft ?? existing.windowDeductionSqft,
      termsAndConditions: parsed.termsAndConditions ?? "",
    },
  });
  if (parsed.defaultProductsJson !== undefined) {
    try {
      await prisma.$executeRaw`
        UPDATE "BusinessSettings"
        SET "defaultProductsJson" = ${parsed.defaultProductsJson}
        WHERE id = ${existing.id}
      `;
    } catch (err) {
      throw new Error(
        "Could not save default products. Apply migration 20260718120000_surface_default_products (add BusinessSettings.defaultProductsJson) with your database owner / DIRECT_URL, then retry.",
        { cause: err }
      );
    }
  }
  revalidatePath("/settings");
  revalidatePath("/estimates");
  const defaultProductsJson =
    parsed.defaultProductsJson !== undefined
      ? parsed.defaultProductsJson
      : await readDefaultProductsJson(existing.id);
  return { ...updated, defaultProductsJson };
}

// ─── Customers ──────────────────────────────────────────────
export async function listCustomers(search?: string) {
  await boot();
  return prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
            { city: { contains: search } },
          ],
        }
      : undefined,
    include: {
      _count: { select: { estimates: true, jobs: true } },
    },
    orderBy: { name: "asc" },
  });
}

/** Lightweight customer list for estimate builder selects (no relation counts). */
export async function listCustomerOptions() {
  await boot();
  return prisma.customer.findMany({
    select: { id: true, name: true, phone: true, email: true },
    orderBy: { name: "asc" },
  });
}

export async function getCustomer(id: string) {
  await boot();
  return prisma.customer.findUniqueOrThrow({
    where: { id },
    include: {
      estimates: { orderBy: { updatedAt: "desc" } },
      jobs: { orderBy: { updatedAt: "desc" } },
    },
  });
}

export async function createCustomer(data: unknown) {
  const parsed = customerSchema.parse(data);
  const customer = await prisma.customer.create({
    data: {
      ...parsed,
      email: parsed.email || null,
    },
  });
  revalidatePath("/customers");
  return customer;
}

export async function updateCustomer(id: string, data: unknown) {
  const parsed = customerSchema.parse(data);
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...parsed,
      email: parsed.email || null,
    },
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return customer;
}

export async function deleteCustomer(id: string) {
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
}

// ─── Jobs ───────────────────────────────────────────────────
export async function listJobs(status?: string) {
  await boot();
  return prisma.job.findMany({
    where: status ? { status } : undefined,
    include: {
      customer: true,
      estimates: { select: { id: true, total: true, status: true, title: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createJob(data: unknown) {
  const parsed = jobSchema.parse(data);
  const job = await prisma.job.create({ data: parsed });
  revalidatePath("/jobs");
  return job;
}

export async function updateJob(
  id: string,
  data: Partial<{ status: string; title: string; notes: string }>
) {
  const job = await prisma.job.update({ where: { id }, data });
  revalidatePath("/jobs");
  return job;
}

// ─── Estimates ──────────────────────────────────────────────
export async function listEstimates(status?: string) {
  await boot();
  // Lean list projection — list UI only needs these fields.
  return prisma.estimate.findMany({
    where: status ? { status } : undefined,
    select: {
      id: true,
      estimateNumber: true,
      title: true,
      status: true,
      total: true,
      updatedAt: true,
      customer: { select: { name: true } },
      _count: { select: { rooms: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getEstimate(id: string) {
  await boot();
  const estimate = await prisma.estimate.findUniqueOrThrow({
    where: { id },
    include: {
      customer: true,
      job: true,
      options: { orderBy: { sortOrder: "asc" } },
      rooms: {
        include: {
          surfaces: {
            include: { paintProduct: true, productionRate: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      extras: { orderBy: { sortOrder: "asc" } },
      lineItems: {
        include: { paintProduct: true, productionRate: true },
        orderBy: { sortOrder: "asc" },
      },
      photos: { orderBy: { sortOrder: "asc" } },
    },
  });
  // Raw fetch until `prisma generate` picks up newer Estimate / line-item columns
  // (Next may lock the query-engine DLL on Windows).
  const colorRow = await prisma.$queryRaw<
    Array<{ colorAssignmentsJson: string | null }>
  >`SELECT "colorAssignmentsJson" FROM "Estimate" WHERE id = ${id}`;
  const paintFields = await prisma.$queryRaw<
    Array<{
      id: string;
      sheen: string | null;
      colorName: string | null;
      colorHex: string | null;
    }>
  >`SELECT id, sheen, "colorName", "colorHex" FROM "EstimateLineItem" WHERE "estimateId" = ${id}`;
  const paintById = Object.fromEntries(paintFields.map((r) => [r.id, r]));

  return {
    ...estimate,
    colorAssignmentsJson: colorRow[0]?.colorAssignmentsJson ?? null,
    rooms: estimate.rooms.map((room) => ({
      ...room,
      surfaces: room.surfaces.map((s) => ({
        ...s,
        sheen: paintById[s.id]?.sheen ?? null,
        colorName: paintById[s.id]?.colorName ?? null,
        colorHex: paintById[s.id]?.colorHex ?? null,
      })),
    })),
    lineItems: estimate.lineItems.map((li) => ({
      ...li,
      sheen: paintById[li.id]?.sheen ?? null,
      colorName: paintById[li.id]?.colorName ?? null,
      colorHex: paintById[li.id]?.colorHex ?? null,
    })),
  };
}

export async function createEstimate(input: {
  title: string;
  customerId?: string;
  jobId?: string;
}) {
  await boot();
  const latest = await prisma.estimate.findFirst({
    orderBy: { createdAt: "desc" },
    select: { estimateNumber: true },
  });
  let nextNum = 1001;
  const match = latest?.estimateNumber?.match(/(\d+)\s*$/);
  if (match) nextNum = parseInt(match[1], 10) + 1;

  const estimate = await prisma.estimate.create({
    data: {
      title: input.title,
      customerId: input.customerId || null,
      jobId: input.jobId || null,
      estimateNumber: `EST-${nextNum}`,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      // Good/Better/Best tiers deferred — rooms store optionId null for now
    },
    include: { options: true },
  });
  revalidatePath("/estimates");
  revalidatePath("/");
  return estimate;
}

export type SurfacePayload = {
  id?: string;
  description: string;
  surfaceType?: string | null;
  measurementType: string;
  inputAreaSqft?: number | null;
  quantity?: number | null;
  unitLabel?: string | null;
  dimensionsJson?: string | null;
  coats: number;
  method?: string | null;
  conditionMultiplier?: number | null;
  paintProductId?: string | null;
  sheen?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  productionRateId?: string | null;
  productionRateOverride?: number | null;
  gallonsOverride?: number | null;
  laborHoursOverride?: number | null;
  materialCostOverride?: number | null;
  laborCostOverride?: number | null;
  lineTotalOverride?: number | null;
  notes?: string | null;
  sortOrder: number;
};

export type RoomPayload = {
  id?: string;
  name: string;
  kind: string;
  lengthFt?: number | null;
  widthFt?: number | null;
  heightFt?: number | null;
  doorCount?: number;
  windowCount?: number;
  openingCount?: number;
  inputAreaSqft?: number | null;
  inputLinearFt?: number | null;
  condition?: string;
  prepPct?: number | null;
  notes?: string | null;
  sortOrder: number;
  surfaces: SurfacePayload[];
};

export type ExtraPayload = {
  id?: string;
  category: string;
  label: string;
  amountType: string;
  amount: number;
  sortOrder: number;
};

/** @deprecated Use SurfacePayload — kept for any leftover imports */
export type LineItemPayload = SurfacePayload & {
  optionId?: string | null;
};

export async function saveEstimate(input: {
  id: string;
  title: string;
  customerId?: string | null;
  jobId?: string | null;
  status?: string;
  notes?: string | null;
  internalNotes?: string | null;
  colorAssignmentsJson?: string | null;
  wasteFactorPct?: number | null;
  materialMarkupPct?: number | null;
  laborRate?: number | null;
  taxRatePct?: number | null;
  prepPct?: number | null;
  discountPct?: number | null;
  discountAmount?: number | null;
  profitTargetPct?: number | null;
  rooms: RoomPayload[];
  extras?: ExtraPayload[];
}) {
  const settings = await getSettings();
  const waste = input.wasteFactorPct ?? settings.wasteFactorPct;
  const markup = input.materialMarkupPct ?? settings.materialMarkupPct;
  const laborRate = input.laborRate ?? settings.defaultLaborRate;
  const taxRate = input.taxRatePct ?? settings.taxRatePct;
  const prepPct = input.prepPct ?? settings.defaultPrepPct;

  const allSurfaces = input.rooms.flatMap((r) => r.surfaces);
  const productIds = allSurfaces
    .map((l) => l.paintProductId)
    .filter(Boolean) as string[];
  const rateIds = allSurfaces
    .map((l) => l.productionRateId)
    .filter(Boolean) as string[];
  const products = await prisma.paintProduct.findMany({
    where: { id: { in: productIds } },
  });
  const rates = await prisma.productionRate.findMany({
    where: { id: { in: rateIds } },
  });
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
  const rateMap = Object.fromEntries(rates.map((r) => [r.id, r]));

  type ComputedSurface = SurfacePayload & {
    gallons: number;
    laborHours: number;
    prepHours: number;
    materialCost: number;
    laborCost: number;
    lineTotal: number;
    conditionMultiplier: number;
  };

  const roomsComputed = input.rooms.map((room) => {
    const roomCond = conditionMultiplier(room.condition);
    const roomPrep = room.prepPct ?? prepPct;
    const surfaces: ComputedSurface[] = room.surfaces.map((li) => {
      const product = li.paintProductId ? productMap[li.paintProductId] : null;
      const rate = li.productionRateId ? rateMap[li.productionRateId] : null;
      const rateVal = li.productionRateOverride ?? rate?.ratePerManHour ?? null;
      const cond = li.conditionMultiplier ?? roomCond;
      const calc = calculateLineItem({
        measurementType: (li.measurementType as "area" | "unit") || "area",
        inputAreaSqft: li.inputAreaSqft,
        quantity: li.quantity,
        unitLabel: li.unitLabel,
        surfaceType: li.surfaceType,
        coats: li.coats,
        coverageSqftPerGallon:
          product?.coverageSqftPerGallon ??
          settings.defaultCoverageSqftPerGallon,
        pricePerGallon: product?.pricePerGallon,
        productionRatePerManHour: rateVal,
        firstCoatRate: rate?.firstCoatRate,
        additionalCoatRate: rate?.additionalCoatRate,
        effective2CoatRate: rate?.effective2CoatRate,
        wasteFactorPct: waste,
        materialMarkupPct: markup,
        laborRate,
        conditionMultiplier: cond,
        prepPct: roomPrep,
        gallonsOverride: li.gallonsOverride,
        laborHoursOverride: li.laborHoursOverride,
        materialCostOverride: li.materialCostOverride,
        laborCostOverride: li.laborCostOverride,
        lineTotalOverride: li.lineTotalOverride,
        surfaceLabel: li.description,
      });
      return {
        ...li,
        gallons: calc.gallons,
        laborHours: calc.laborHours,
        prepHours: calc.prepHours,
        materialCost: calc.materialCost,
        laborCost: calc.laborCost,
        lineTotal: calc.lineTotal,
        conditionMultiplier: cond,
        method: li.method ?? rate?.method ?? null,
      };
    });
    return { room, surfaces };
  });

  const flat = roomsComputed.flatMap((r) => r.surfaces);

  const packaging = calculatePaintPackaging(
    roomsComputed.flatMap(({ room, surfaces }, ri) =>
      surfaces.map((s, si) => {
        const product = s.paintProductId
          ? productMap[s.paintProductId]
          : null;
        return {
          roomKey: `room-${ri}-${room.sortOrder}`,
          roomName: room.name,
          surfaceKey: `s-${ri}-${si}-${s.sortOrder}`,
          description: s.description,
          paintProductId: s.paintProductId,
          productName: product?.name ?? "Paint",
          pricePerGallon: product?.pricePerGallon ?? 0,
          sheen: s.sheen,
          colorName: s.colorName,
          colorHex: s.colorHex,
          rawGallons: s.gallons,
          materialMarkupPct: markup,
        };
      })
    )
  );

  const totals = calculateEstimateTotals({
    lineTotals: flat.map((c) => c.lineTotal),
    materialCosts: flat.map((c) => c.materialCost),
    laborCosts: flat.map((c) => c.laborCost),
    laborHours: flat.map((c) => c.laborHours),
    prepHours: flat.map((c) => c.prepHours),
    taxRatePct: taxRate,
    extras: (input.extras ?? []).map((e) => ({
      category: e.category,
      label: e.label,
      amountType: e.amountType,
      amount: e.amount,
    })),
    discountPct: input.discountPct,
    discountAmount: input.discountAmount,
    paintPackaging: {
      rawMaterialTotal: packaging.rawMaterialTotal,
      roomMaterialTotal: packaging.roomMaterialTotal,
      efficiencyDiscount: packaging.efficiencyDiscount,
    },
  });

  await prisma.$transaction(async (tx) => {
    // Replace all rooms/surfaces for this estimate (G/B/B tiers deferred)
    await tx.estimateRoom.deleteMany({ where: { estimateId: input.id } });
    await tx.estimateLineItem.deleteMany({
      where: { estimateId: input.id, roomId: null },
    });
    await tx.estimateExtra.deleteMany({ where: { estimateId: input.id } });

    for (const { room, surfaces } of roomsComputed) {
      // Omit sheen/color* from Prisma create until client is regenerated;
      // persist those columns via raw SQL below.
      const created = await tx.estimateRoom.create({
        data: {
          estimateId: input.id,
          optionId: null,
          name: room.name,
          kind: room.kind || "interior",
          lengthFt: room.lengthFt ?? null,
          widthFt: room.widthFt ?? null,
          heightFt: room.heightFt ?? null,
          doorCount: room.doorCount ?? 0,
          windowCount: room.windowCount ?? 0,
          openingCount: room.openingCount ?? 0,
          inputAreaSqft: room.inputAreaSqft ?? null,
          inputLinearFt: room.inputLinearFt ?? null,
          condition: room.condition || "medium",
          prepPct: room.prepPct ?? null,
          notes: room.notes ?? null,
          sortOrder: room.sortOrder,
          surfaces: {
            create: surfaces.map((li) => ({
              estimateId: input.id,
              optionId: null,
              description: li.description,
              surfaceType: li.surfaceType,
              measurementType: li.measurementType,
              inputAreaSqft: li.inputAreaSqft,
              quantity: li.quantity,
              unitLabel: li.unitLabel,
              dimensionsJson: li.dimensionsJson,
              coats: li.coats,
              method: li.method,
              conditionMultiplier: li.conditionMultiplier,
              paintProductId: li.paintProductId || null,
              productionRateId: li.productionRateId || null,
              productionRateOverride: li.productionRateOverride,
              gallons: li.gallons,
              laborHours: li.laborHours,
              prepHours: li.prepHours,
              materialCost: li.materialCost,
              laborCost: li.laborCost,
              lineTotal: li.lineTotal,
              gallonsOverride: li.gallonsOverride,
              laborHoursOverride: li.laborHoursOverride,
              materialCostOverride: li.materialCostOverride,
              laborCostOverride: li.laborCostOverride,
              lineTotalOverride: li.lineTotalOverride,
              notes: li.notes,
              sortOrder: li.sortOrder,
            })),
          },
        },
        include: {
          surfaces: { orderBy: { sortOrder: "asc" }, select: { id: true } },
        },
      });

      for (let i = 0; i < created.surfaces.length; i++) {
        const li = surfaces[i];
        if (!li) continue;
        await tx.$executeRaw`
          UPDATE "EstimateLineItem"
          SET
            sheen = ${li.sheen ?? null},
            "colorName" = ${li.colorName ?? null},
            "colorHex" = ${li.colorHex ?? null}
          WHERE id = ${created.surfaces[i].id}
        `;
      }
    }

    if (input.extras?.length) {
      await tx.estimateExtra.createMany({
        data: input.extras.map((e) => ({
          estimateId: input.id,
          category: e.category,
          label: e.label,
          amountType: e.amountType,
          amount: e.amount,
          sortOrder: e.sortOrder,
        })),
      });
    }

    await tx.estimate.update({
      where: { id: input.id },
      data: {
        title: input.title,
        customerId: input.customerId || null,
        jobId: input.jobId || null,
        status: input.status,
        notes: input.notes,
        internalNotes: input.internalNotes,
        wasteFactorPct: input.wasteFactorPct,
        materialMarkupPct: input.materialMarkupPct,
        laborRate: input.laborRate,
        taxRatePct: input.taxRatePct,
        prepPct: input.prepPct,
        discountPct: input.discountPct,
        discountAmount: input.discountAmount,
        profitTargetPct: input.profitTargetPct,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
      },
    });

    // Persist project colors JSON (array of { id, colorNumber, colorName, notes }).
    if (input.colorAssignmentsJson !== undefined) {
      await tx.$executeRaw`
        UPDATE "Estimate"
        SET "colorAssignmentsJson" = ${input.colorAssignmentsJson}
        WHERE id = ${input.id}
      `;
    }
  });

  revalidatePath(`/estimates/${input.id}`);
  revalidatePath("/estimates");
  revalidatePath("/");
  return { totals };
}

export async function updateEstimateStatus(id: string, status: string) {
  const estimate = await prisma.estimate.update({
    where: { id },
    data: { status },
    include: { customer: true, job: true },
  });

  if (status === "accepted") {
    if (estimate.jobId) {
      await prisma.job.update({
        where: { id: estimate.jobId },
        data: { status: "scheduled" },
      });
    } else if (estimate.customerId) {
      const job = await prisma.job.create({
        data: {
          customerId: estimate.customerId,
          title: estimate.title,
          status: "scheduled",
          address: estimate.customer?.address,
          city: estimate.customer?.city,
          state: estimate.customer?.state,
          zip: estimate.customer?.zip,
        },
      });
      await prisma.estimate.update({
        where: { id },
        data: { jobId: job.id },
      });
    }
  }

  revalidatePath(`/estimates/${id}`);
  revalidatePath("/estimates");
  revalidatePath("/jobs");
  revalidatePath("/");
  return estimate;
}

export async function deleteEstimate(id: string) {
  await prisma.estimate.delete({ where: { id } });
  revalidatePath("/estimates");
  revalidatePath("/jobs");
  revalidatePath("/");
}

export async function duplicateOptionRooms(
  estimateId: string,
  fromOptionId: string,
  toOptionId: string
) {
  const rooms = await prisma.estimateRoom.findMany({
    where: { estimateId, optionId: fromOptionId },
    include: { surfaces: true },
  });
  await prisma.estimateRoom.deleteMany({
    where: { estimateId, optionId: toOptionId },
  });
  for (const room of rooms) {
    const { id: _id, createdAt: _c, updatedAt: _u, surfaces, ...rest } = room;
    await prisma.estimateRoom.create({
      data: {
        ...rest,
        optionId: toOptionId,
        surfaces: {
          create: surfaces.map((li) => {
            const {
              id: _lid,
              createdAt: _lc,
              updatedAt: _lu,
              roomId: _rid,
              ...liRest
            } = li;
            return { ...liRest, optionId: toOptionId, estimateId };
          }),
        },
      },
    });
  }
  revalidatePath(`/estimates/${estimateId}`);
}

/** @deprecated Prefer duplicateOptionRooms */
export async function duplicateOptionLines(
  estimateId: string,
  fromOptionId: string,
  toOptionId: string
) {
  return duplicateOptionRooms(estimateId, fromOptionId, toOptionId);
}

// ─── Catalog ────────────────────────────────────────────────
export async function listPaintProducts() {
  await boot();
  return prisma.paintProduct.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      sheens: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });
}

export async function upsertPaintProduct(
  id: string | null,
  data: {
    name: string;
    brand: string;
    coverageSqftPerGallon: number;
    pricePerGallon: number;
    sheen?: string | null;
    sheens?: string[];
    category?: string;
    defaultSurfaceType?: string | null;
    features?: string | null;
    canImageUrl?: string | null;
    dataSheetUrl?: string | null;
    notes?: string | null;
    isActive?: boolean;
  }
) {
  const sheenNames = Array.from(
    new Set(
      (data.sheens ?? (data.sheen ? [data.sheen] : []))
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
  const primarySheen = sheenNames[0] ?? data.sheen ?? null;
  const productData = {
    name: data.name,
    brand: data.brand,
    coverageSqftPerGallon: data.coverageSqftPerGallon,
    pricePerGallon: data.pricePerGallon,
    sheen: primarySheen,
    category: data.category,
    defaultSurfaceType: data.defaultSurfaceType,
    features: data.features ?? "",
    canImageUrl: data.canImageUrl?.trim() ? data.canImageUrl.trim() : null,
    dataSheetUrl: data.dataSheetUrl?.trim() ? data.dataSheetUrl.trim() : null,
    notes: data.notes,
    isActive: data.isActive,
  };

  const saved = await prisma.$transaction(async (tx) => {
    const product = id
      ? await tx.paintProduct.update({ where: { id }, data: productData })
      : await tx.paintProduct.create({ data: productData });

    if (data.sheens !== undefined || !id) {
      await tx.paintProductSheen.deleteMany({
        where: { paintProductId: product.id },
      });
      if (sheenNames.length) {
        await tx.paintProductSheen.createMany({
          data: sheenNames.map((name, sortOrder) => ({
            paintProductId: product.id,
            name,
            sortOrder,
          })),
        });
      }
    }

    return tx.paintProduct.findUniqueOrThrow({
      where: { id: product.id },
      include: {
        sheens: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      },
    });
  });

  revalidatePath("/settings");
  revalidatePath("/products");
  return saved;
}

export async function deletePaintProduct(id: string) {
  await prisma.paintProduct.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/products");
}

/** AI lookup: manufacturer site attributes via xAI Grok + web search. */
export async function lookupPaintProductAttributes(input: {
  name: string;
  brand: string;
}) {
  const { lookupPaintProductFromManufacturer } = await import(
    "@/lib/xai-product-lookup"
  );
  return lookupPaintProductFromManufacturer(input);
}

export async function listProductionRates() {
  await boot();
  return prisma.productionRate.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function upsertProductionRate(
  id: string | null,
  data: {
    surfaceType: string;
    method: string;
    measurementType: string;
    ratePerManHour: number;
    firstCoatRate?: number | null;
    additionalCoatRate?: number | null;
    effective2CoatRate?: number | null;
    defaultCoats: number;
    notes?: string | null;
    isActive?: boolean;
  }
) {
  if (id) {
    await prisma.productionRate.update({ where: { id }, data });
  } else {
    await prisma.productionRate.create({ data });
  }
  revalidatePath("/settings");
}

export async function deleteProductionRate(id: string) {
  await prisma.productionRate.delete({ where: { id } });
  revalidatePath("/settings");
}

// ─── Dashboard ──────────────────────────────────────────────
export async function getDashboardData() {
  await boot();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    estimatesThisMonth,
    allEstimates,
    recentEstimates,
    customers,
    jobs,
    acceptedThisMonth,
  ] = await Promise.all([
    prisma.estimate.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.estimate.findMany({
      where: { status: { in: ["draft", "sent"] } },
      select: { total: true, status: true },
    }),
    prisma.estimate.findMany({
      take: 8,
      orderBy: { updatedAt: "desc" },
      include: { customer: true },
    }),
    prisma.customer.count(),
    prisma.job.findMany({
      where: { status: { in: ["scheduled", "in_progress"] } },
      take: 5,
      include: { customer: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.estimate.count({
      where: { status: "accepted", updatedAt: { gte: monthStart } },
    }),
  ]);

  const pipelineValue = allEstimates.reduce((s, e) => s + (e.total || 0), 0);

  return {
    estimatesThisMonth,
    acceptedThisMonth,
    pipelineValue,
    customerCount: customers,
    recentEstimates,
    activeJobs: jobs,
  };
}

// ─── Photos ─────────────────────────────────────────────────
export async function uploadEstimatePhoto(
  estimateId: string,
  formData: FormData
) {
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file");

  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    `estimate-${estimateId}`
  );
  await mkdir(dir, { recursive: true });
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, safeName), buffer);
  const relPath = `/uploads/estimate-${estimateId}/${safeName}`;

  const count = await prisma.estimatePhoto.count({ where: { estimateId } });
  const photo = await prisma.estimatePhoto.create({
    data: {
      estimateId,
      path: relPath,
      caption: (formData.get("caption") as string) || null,
      sortOrder: count,
    },
  });
  revalidatePath(`/estimates/${estimateId}`);
  return photo;
}

export async function deleteEstimatePhoto(id: string, estimateId: string) {
  await prisma.estimatePhoto.delete({ where: { id } });
  revalidatePath(`/estimates/${estimateId}`);
}

/** Upload a pre-scaled can image for a paint product. Returns public URL path. */
export async function uploadPaintProductCanImage(
  productId: string,
  formData: FormData
) {
  if (!productId?.trim()) throw new Error("Product id required");
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file");
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image");
  }

  const dir = path.join(process.cwd(), "public", "uploads", "products", productId);
  await mkdir(dir, { recursive: true });
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const safeName = `can-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, safeName), buffer);
  const relPath = `/uploads/products/${productId}/${safeName}`;

  revalidatePath("/products");
  revalidatePath("/settings");
  return { path: relPath };
}

const MAX_CAN_IMAGE_BYTES = 12 * 1024 * 1024;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  // Block obvious private / link-local IPv4 literals
  if (
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return true;
  }
  return false;
}

function sniffImageExt(buf: Buffer): "jpg" | "png" | "webp" | "gif" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "png";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  if (
    buf.length >= 6 &&
    buf.toString("ascii", 0, 3) === "GIF" &&
    (buf[3] === 0x38 /* '8' */)
  ) {
    return "gif";
  }
  return null;
}

/** Normalize AI/search URLs: decode entities, unwrap imgurl= proxies, drop fragments. */
function normalizeCanImageCandidateUrl(raw: string): string | null {
  let url = raw.trim().replace(/&amp;/gi, "&").replace(/&quot;/gi, "");
  if (!url) return null;

  try {
    const parsed = new URL(url);
    // Google / Bing style wrappers: ...?imgurl=https%3A%2F%2F...
    const wrapped =
      parsed.searchParams.get("imgurl") ||
      parsed.searchParams.get("mediaurl") ||
      parsed.searchParams.get("url");
    if (wrapped && /^https?:\/\//i.test(wrapped)) {
      url = wrapped;
    }
  } catch {
    /* keep original */
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (isPrivateOrLocalHostname(parsed.hostname)) return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

async function fetchImageOnce(
  imageUrl: string,
  headers: Record<string, string>
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(imageUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadCanImageBuffer(imageUrl: string): Promise<{
  buffer: Buffer;
  ext: "jpg" | "png" | "webp" | "gif";
}> {
  const normalized = normalizeCanImageCandidateUrl(imageUrl);
  if (!normalized) throw new Error("Invalid image URL");

  const parsed = new URL(normalized);
  const origin = parsed.origin;
  const headerAttempts: Record<string, string>[] = [
    {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "User-Agent": BROWSER_UA,
      Referer: `${origin}/`,
      "Accept-Language": "en-US,en;q=0.9",
    },
    {
      Accept: "image/*,*/*;q=0.8",
      "User-Agent": BROWSER_UA,
      Referer: "https://www.google.com/",
      "Accept-Language": "en-US,en;q=0.9",
    },
    {
      Accept: "*/*",
      "User-Agent": BROWSER_UA,
    },
  ];

  let lastError: Error = new Error("Image download failed");
  for (const headers of headerAttempts) {
    try {
      const res = await fetchImageOnce(normalized, headers);
      if (!res.ok) {
        lastError = new Error(
          `Image download failed (${res.status}) from ${parsed.hostname}`
        );
        continue;
      }

      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (
        contentType &&
        !contentType.startsWith("image/") &&
        !contentType.includes("octet-stream") &&
        !contentType.includes("binary")
      ) {
        lastError = new Error(
          `URL from ${parsed.hostname} returned ${contentType || "non-image"}`
        );
        continue;
      }

      const ab = await res.arrayBuffer();
      if (ab.byteLength < 64) {
        lastError = new Error("Image file too small");
        continue;
      }
      if (ab.byteLength > MAX_CAN_IMAGE_BYTES) {
        throw new Error("Image is too large (max 12 MB)");
      }

      const buffer = Buffer.from(ab);
      const sniffed = sniffImageExt(buffer);
      if (!sniffed) {
        lastError = new Error(
          `Downloaded file from ${parsed.hostname} is not a supported image`
        );
        continue;
      }

      return { buffer, ext: sniffed };
    } catch (e) {
      if (e instanceof Error && e.message.includes("too large")) throw e;
      lastError =
        e instanceof Error
          ? e.name === "AbortError"
            ? new Error(`Image download timed out (${parsed.hostname})`)
            : e
          : new Error(String(e));
    }
  }

  throw lastError;
}

/**
 * Google Images find + import: search company + product name, download the
 * best can photo, and store it under the product uploads folder.
 */
export async function importPaintProductCanImageViaAi(
  productId: string,
  input: { name: string; brand: string }
) {
  if (!productId?.trim()) throw new Error("Product id required");

  const { findPaintProductCanImage } = await import("@/lib/google-images-can");
  const found = await findPaintProductCanImage(input);
  const rawCandidates = [found.canImageUrl, ...found.alternateImageUrls];
  const candidates = Array.from(
    new Set(
      rawCandidates
        .map(normalizeCanImageCandidateUrl)
        .filter((u): u is string => Boolean(u))
    )
  );

  if (!candidates.length) {
    throw new Error(
      `No downloadable can image URL for "${input.brand} ${input.name}". Try paste/upload.`
    );
  }

  let lastError: Error | null = null;
  for (const url of candidates) {
    try {
      const { buffer, ext } = await downloadCanImageBuffer(url);
      // Store gif as png-compatible path name; browsers can still show gif.
      const storeExt = ext === "gif" ? "gif" : ext;
      const dir = path.join(
        process.cwd(),
        "public",
        "uploads",
        "products",
        productId
      );
      await mkdir(dir, { recursive: true });
      const safeName = `can-${Date.now()}.${storeExt}`;
      await writeFile(path.join(dir, safeName), buffer);
      const relPath = `/uploads/products/${productId}/${safeName}`;

      await prisma.paintProduct.update({
        where: { id: productId },
        data: { canImageUrl: relPath },
      });

      revalidatePath("/products");
      revalidatePath("/settings");
      return {
        path: relPath,
        sourceUrl: url,
        confidence: found.confidence,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw (
    lastError ??
    new Error("Could not download can image — try paste/upload instead")
  );
}

const MAX_DATA_SHEET_BYTES = 30 * 1024 * 1024;

function isPdfBuffer(buf: Buffer): boolean {
  return buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-";
}

async function downloadPdfBuffer(pdfUrl: string): Promise<Buffer> {
  const normalized = normalizeCanImageCandidateUrl(pdfUrl);
  if (!normalized) throw new Error("Invalid PDF URL");

  const parsed = new URL(normalized);
  const headerAttempts: Record<string, string>[] = [
    {
      Accept: "application/pdf,*/*;q=0.8",
      "User-Agent": BROWSER_UA,
      Referer: `${parsed.origin}/`,
      "Accept-Language": "en-US,en;q=0.9",
    },
    {
      Accept: "application/pdf,*/*",
      "User-Agent": BROWSER_UA,
      Referer: "https://www.google.com/",
    },
  ];

  let lastError: Error = new Error("PDF download failed");
  for (const headers of headerAttempts) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(normalized, {
        signal: controller.signal,
        redirect: "follow",
        headers,
      });
      if (!res.ok) {
        lastError = new Error(
          `PDF download failed (${res.status}) from ${parsed.hostname}`
        );
        continue;
      }
      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      const ab = await res.arrayBuffer();
      if (ab.byteLength < 64) {
        lastError = new Error("PDF file too small");
        continue;
      }
      if (ab.byteLength > MAX_DATA_SHEET_BYTES) {
        throw new Error("PDF is too large (max 30 MB)");
      }
      const buffer = Buffer.from(ab);
      if (!isPdfBuffer(buffer)) {
        lastError = new Error(
          contentType.includes("pdf")
            ? `Downloaded file from ${parsed.hostname} is not a valid PDF`
            : `URL from ${parsed.hostname} did not return a PDF`
        );
        continue;
      }
      return buffer;
    } catch (e) {
      if (e instanceof Error && e.message.includes("too large")) throw e;
      lastError =
        e instanceof Error
          ? e.name === "AbortError"
            ? new Error(`PDF download timed out (${parsed.hostname})`)
            : e
          : new Error(String(e));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

/**
 * Google Search find + import: locate a product data sheet PDF, download it,
 * store under product uploads, and save the path on the product.
 */
export async function importPaintProductDataSheet(
  productId: string,
  input: { name: string; brand: string }
) {
  if (!productId?.trim()) throw new Error("Product id required");

  const { findPaintProductDataSheet } = await import("@/lib/google-datasheet");
  const found = await findPaintProductDataSheet(input);
  const candidates = Array.from(
    new Set(
      [found.dataSheetUrl, ...found.alternateUrls]
        .map(normalizeCanImageCandidateUrl)
        .filter((u): u is string => Boolean(u))
    )
  );

  if (!candidates.length) {
    throw new Error(
      `No downloadable data sheet for "${input.brand} ${input.name}".`
    );
  }

  let lastError: Error | null = null;
  for (const url of candidates) {
    try {
      const buffer = await downloadPdfBuffer(url);
      const dir = path.join(
        process.cwd(),
        "public",
        "uploads",
        "products",
        productId
      );
      await mkdir(dir, { recursive: true });
      const safeName = `datasheet-${Date.now()}.pdf`;
      await writeFile(path.join(dir, safeName), buffer);
      const relPath = `/uploads/products/${productId}/${safeName}`;

      await prisma.paintProduct.update({
        where: { id: productId },
        data: { dataSheetUrl: relPath },
      });

      revalidatePath("/products");
      revalidatePath("/settings");
      return {
        path: relPath,
        sourceUrl: url,
        title: found.title,
        confidence: found.confidence,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw (
    lastError ??
    new Error("Could not download product data sheet PDF")
  );
}

/** Clear the saved product data sheet PDF (DB + local upload file when present). */
export async function clearPaintProductDataSheet(productId: string) {
  if (!productId?.trim()) throw new Error("Product id required");

  const product = await prisma.paintProduct.findUnique({
    where: { id: productId },
    select: { dataSheetUrl: true },
  });
  if (!product) throw new Error("Product not found");

  const rel = product.dataSheetUrl?.trim() || "";
  await prisma.paintProduct.update({
    where: { id: productId },
    data: { dataSheetUrl: null },
  });

  // Delete local upload if it lives under this product's uploads folder
  if (rel.startsWith(`/uploads/products/${productId}/`)) {
    const filePath = path.join(process.cwd(), "public", rel.replace(/^\//, ""));
    try {
      await unlink(filePath);
    } catch {
      // File may already be gone — DB clear is what matters
    }
  }

  revalidatePath("/products");
  revalidatePath("/settings");
  return { ok: true as const };
}

// ─── Export / Import ────────────────────────────────────────
export async function exportAllData() {
  await boot();
  const [settings, customers, jobs, estimates, products, rates] =
    await Promise.all([
      prisma.businessSettings.findMany(),
      prisma.customer.findMany(),
      prisma.job.findMany(),
      prisma.estimate.findMany({
        include: {
          lineItems: true,
          rooms: { include: { surfaces: true } },
          extras: true,
          options: true,
          photos: true,
        },
      }),
      prisma.paintProduct.findMany(),
      prisma.productionRate.findMany(),
    ]);
  return {
    exportedAt: new Date().toISOString(),
    settings,
    customers,
    jobs,
    estimates,
    products,
    rates,
  };
}

export async function exportEstimateJson(id: string) {
  await boot();
  const estimate = await getEstimate(id);
  return {
    exportedAt: new Date().toISOString(),
    type: "painterapps-estimate",
    version: 1,
    estimate,
  };
}

export async function importEstimateJson(payload: {
  title?: string;
  customerId?: string | null;
  rooms?: RoomPayload[];
  extras?: ExtraPayload[];
  notes?: string | null;
  wasteFactorPct?: number | null;
  materialMarkupPct?: number | null;
  laborRate?: number | null;
  taxRatePct?: number | null;
  prepPct?: number | null;
  discountPct?: number | null;
  discountAmount?: number | null;
  profitTargetPct?: number | null;
}) {
  const created = await createEstimate({
    title: payload.title || "Imported Estimate",
    customerId: payload.customerId || undefined,
  });
  await saveEstimate({
    id: created.id,
    title: payload.title || created.title,
    customerId: payload.customerId ?? null,
    notes: payload.notes ?? null,
    wasteFactorPct: payload.wasteFactorPct,
    materialMarkupPct: payload.materialMarkupPct,
    laborRate: payload.laborRate,
    taxRatePct: payload.taxRatePct,
    prepPct: payload.prepPct,
    discountPct: payload.discountPct,
    discountAmount: payload.discountAmount,
    profitTargetPct: payload.profitTargetPct,
    rooms: (payload.rooms ?? []).map((r, i) => ({
      ...r,
      sortOrder: r.sortOrder ?? i,
      surfaces: (r.surfaces ?? []).map((s, j) => ({
        ...s,
        sortOrder: s.sortOrder ?? j,
      })),
    })),
    extras: payload.extras ?? [],
  });
  revalidatePath(`/estimates/${created.id}`);
  return created;
}
