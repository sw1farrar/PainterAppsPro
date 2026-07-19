export const PAINT_PRODUCT_CATEGORIES = [
  "interior",
  "exterior",
  "both",
  "interior_primer",
  "exterior_primer",
  "both_primer",
] as const;

export type PaintProductCategory = (typeof PAINT_PRODUCT_CATEGORIES)[number];

export function isPaintProductCategory(
  value: string | null | undefined
): value is PaintProductCategory {
  return (
    !!value &&
    (PAINT_PRODUCT_CATEGORIES as readonly string[]).includes(value)
  );
}

export function paintProductCategoryLabel(category: string | null | undefined) {
  switch (category) {
    case "interior":
      return "Interior";
    case "exterior":
      return "Exterior";
    case "both":
      return "Interior & Exterior";
    case "interior_primer":
      return "Interior Primer";
    case "exterior_primer":
      return "Exterior Primer";
    case "both_primer":
      return "Interior & Exterior Primer";
    default:
      return category?.trim() || "Interior & Exterior";
  }
}
