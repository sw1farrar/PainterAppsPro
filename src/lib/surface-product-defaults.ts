/**
 * Company defaults: catalog surface type → paint product + preferred sheen.
 * Used when adding rooms/surfaces in the estimator.
 */

export type SurfaceProductDefault = {
  productId: string;
  sheen: string | null;
};

export type SurfaceProductDefaultsMap = Record<string, SurfaceProductDefault>;

export type SurfaceDefaultRow = {
  surfaceType: string;
  group: "interior" | "exterior";
  label: string;
};

/** Ordered catalog surface types shown in Settings. */
export const SURFACE_TYPES_FOR_DEFAULTS: SurfaceDefaultRow[] = [
  { surfaceType: "Interior Walls Smooth", group: "interior", label: "Walls (smooth)" },
  { surfaceType: "Interior Walls Textured", group: "interior", label: "Walls (textured)" },
  { surfaceType: "Interior Ceilings", group: "interior", label: "Ceilings" },
  { surfaceType: "Interior Trim / Baseboards", group: "interior", label: "Trim & baseboards" },
  { surfaceType: "Interior Crown Molding", group: "interior", label: "Crown molding" },
  { surfaceType: "Interior Doors (both sides)", group: "interior", label: "Doors" },
  { surfaceType: "Interior Windows", group: "interior", label: "Windows" },
  { surfaceType: "Cabinet Boxes (per door)", group: "interior", label: "Cabinets" },
  { surfaceType: "Closets", group: "interior", label: "Closet walls" },
  { surfaceType: "Closet Ceilings", group: "interior", label: "Closet ceilings" },
  { surfaceType: "Exterior Siding", group: "exterior", label: "Siding / body" },
  { surfaceType: "Exterior Stucco", group: "exterior", label: "Stucco" },
  { surfaceType: "Exterior Trim", group: "exterior", label: "Trim" },
  { surfaceType: "Exterior Doors", group: "exterior", label: "Doors" },
  { surfaceType: "Exterior Windows", group: "exterior", label: "Windows" },
];

type NamedProduct = {
  id: string;
  name: string;
  defaultSurfaceType?: string | null;
  sheen?: string | null;
  sheens?: Array<{ name: string }> | string[];
  isActive?: boolean;
};

function productSheenNames(p: NamedProduct): string[] {
  if (p.sheens?.length) {
    return p.sheens.map((s) => (typeof s === "string" ? s : s.name));
  }
  return p.sheen ? [p.sheen] : [];
}

function pickSheen(product: NamedProduct, preferred: string | null): string | null {
  const names = productSheenNames(product);
  if (!names.length) return preferred ?? product.sheen ?? null;
  if (preferred) {
    const match = names.find(
      (n) => n.toLowerCase() === preferred.toLowerCase()
    );
    if (match) return match;
  }
  return names[0] ?? null;
}

export function parseSurfaceProductDefaults(
  json: string | null | undefined
): SurfaceProductDefaultsMap {
  if (!json?.trim()) return {};
  try {
    const raw = JSON.parse(json) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: SurfaceProductDefaultsMap = {};
    for (const [surfaceType, v] of Object.entries(
      raw as Record<string, unknown>
    )) {
      if (!surfaceType.trim() || !v || typeof v !== "object") continue;
      const row = v as { productId?: unknown; sheen?: unknown };
      const productId =
        typeof row.productId === "string" ? row.productId.trim() : "";
      if (!productId) continue;
      out[surfaceType] = {
        productId,
        sheen:
          typeof row.sheen === "string" && row.sheen.trim()
            ? row.sheen.trim()
            : null,
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeSurfaceProductDefaults(
  map: SurfaceProductDefaultsMap
): string | null {
  const cleaned: SurfaceProductDefaultsMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (!k.trim() || !v?.productId?.trim()) continue;
    cleaned[k.trim()] = {
      productId: v.productId.trim(),
      sheen: v.sheen?.trim() || null,
    };
  }
  if (Object.keys(cleaned).length === 0) return null;
  return JSON.stringify(cleaned);
}

function findProductByName(
  products: NamedProduct[],
  name: string
): NamedProduct | undefined {
  const n = name.toLowerCase();
  return products.find((p) => p.name.toLowerCase() === n);
}

/**
 * Premium Sherwin-Williams factory presets, resolved by product name.
 */
export function buildPremiumSwDefaults(
  products: NamedProduct[]
): SurfaceProductDefaultsMap {
  const emeraldInt = findProductByName(
    products,
    "Emerald Interior Acrylic Latex"
  );
  const emeraldExt = findProductByName(
    products,
    "Emerald Rain Refresh Exterior"
  );
  const urethane = findProductByName(
    products,
    "Emerald Urethane Trim Enamel"
  );
  const durationExt = findProductByName(
    products,
    "Duration Exterior Acrylic Latex"
  );
  const durationHome = findProductByName(products, "Duration Home Interior");

  const walls = emeraldInt ?? durationHome;
  const body = emeraldExt ?? durationExt;
  const enamel = urethane ?? emeraldInt;
  const stucco = durationExt ?? emeraldExt ?? body;

  const map: SurfaceProductDefaultsMap = {};

  function set(
    surfaceType: string,
    product: NamedProduct | undefined,
    sheen: string | null
  ) {
    if (!product) return;
    map[surfaceType] = {
      productId: product.id,
      sheen: pickSheen(product, sheen),
    };
  }

  set("Interior Walls Smooth", walls, "Eggshell");
  set("Interior Walls Textured", walls, "Eggshell");
  set("Closets", walls, "Eggshell");
  set("Interior Ceilings", walls, "Flat");
  set("Closet Ceilings", walls, "Flat");
  set("Interior Trim / Baseboards", enamel, "Semi-Gloss");
  set("Interior Crown Molding", enamel, "Semi-Gloss");
  set("Interior Doors (both sides)", enamel, "Semi-Gloss");
  set("Interior Windows", enamel, "Semi-Gloss");
  set("Cabinet Boxes (per door)", enamel, "Semi-Gloss");
  set("Exterior Siding", body, "Satin");
  set("Exterior Stucco", stucco, "Flat");
  set("Exterior Trim", enamel, "Semi-Gloss");
  set("Exterior Doors", enamel, "Semi-Gloss");
  set("Exterior Windows", enamel, "Semi-Gloss");

  return map;
}

export function resolveDefaultPaint<T extends NamedProduct>({
  surfaceType,
  products,
  defaultsMap,
}: {
  surfaceType: string | null | undefined;
  products: T[];
  defaultsMap: SurfaceProductDefaultsMap;
}): { product: T | null; sheen: string | null } {
  const active = products.filter((p) => p.isActive !== false);
  const pool = active.length ? active : products;
  const key = surfaceType?.trim() || "";

  if (key && defaultsMap[key]?.productId) {
    const entry = defaultsMap[key];
    const product =
      pool.find((p) => p.id === entry.productId) ??
      products.find((p) => p.id === entry.productId) ??
      null;
    if (product) {
      return { product, sheen: pickSheen(product, entry.sheen) };
    }
  }

  if (key) {
    const byField =
      pool.find((p) => p.defaultSurfaceType === key) ??
      products.find((p) => p.defaultSurfaceType === key);
    if (byField) {
      return { product: byField, sheen: pickSheen(byField, null) };
    }
  }

  const first = pool[0] ?? null;
  return {
    product: first,
    sheen: first ? pickSheen(first, null) : null,
  };
}
