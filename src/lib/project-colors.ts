/**
 * Project colors: a shared palette on the estimate.
 * Surfaces reference a color by id (stored in EstimateLineItem.colorName).
 * Packaging pools by product × sheen × that id.
 */

export type ProjectColor = {
  id: string;
  /** Manufacturer color code (e.g. 1648, SW 7006) */
  colorNumber: string | null;
  /** Color name (e.g. Dover White) */
  colorName: string;
  /** Manufacturer, formula, store, etc. */
  notes: string | null;
};

export function newProjectColorId(): string {
  return `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatProjectColorLabel(
  c: Pick<ProjectColor, "colorNumber" | "colorName"> | null | undefined
): string {
  if (!c) return "";
  const num = c.colorNumber?.trim() || "";
  const name = c.colorName?.trim() || "";
  if (num && name) return `${num} ${name}`;
  return name || num;
}

export function isProjectColorComplete(
  c: Pick<ProjectColor, "colorNumber" | "colorName"> | null | undefined
): boolean {
  return Boolean(c?.colorName?.trim() || c?.colorNumber?.trim());
}

export function resolveProjectColor(
  colorId: string | null | undefined,
  colors: ProjectColor[]
): ProjectColor | null {
  if (!colorId?.trim()) return null;
  const id = colorId.trim();
  return colors.find((c) => c.id === id) ?? null;
}

function normalizeColor(raw: Partial<ProjectColor> & { id?: string }): ProjectColor | null {
  const colorName = raw.colorName?.trim() || "";
  const colorNumber = raw.colorNumber?.trim() || null;
  if (!colorName && !colorNumber) return null;
  return {
    id: raw.id?.trim() || newProjectColorId(),
    colorNumber,
    colorName,
    notes: raw.notes?.trim() || null,
  };
}

type LegacyAssignment = {
  colorNumber?: string | null;
  colorName?: string | null;
  notes?: string | null;
  actualName?: string | null;
};

/**
 * Parse estimate color JSON.
 * - New format: ProjectColor[]
 * - Legacy: map of placeholder → assignment (migrated to ProjectColor[] with stable ids)
 */
export function parseProjectColorsJson(
  json: string | null | undefined
): {
  colors: ProjectColor[];
  /** Legacy placeholder label → new color id (for remapping line items once) */
  placeholderToId: Record<string, string>;
} {
  if (!json?.trim()) return { colors: [], placeholderToId: {} };
  try {
    const raw = JSON.parse(json) as unknown;
    if (Array.isArray(raw)) {
      const colors: ProjectColor[] = [];
      const seen = new Set<string>();
      for (const row of raw) {
        if (!row || typeof row !== "object") continue;
        const c = normalizeColor(row as Partial<ProjectColor>);
        if (!c || seen.has(c.id)) continue;
        seen.add(c.id);
        colors.push(c);
      }
      return { colors, placeholderToId: {} };
    }
    if (raw && typeof raw === "object") {
      const placeholderToId: Record<string, string> = {};
      const colors: ProjectColor[] = [];
      for (const [placeholder, v] of Object.entries(
        raw as Record<string, LegacyAssignment>
      )) {
        if (!placeholder.trim() || !v || typeof v !== "object") continue;
        const colorName =
          v.colorName?.trim() || v.actualName?.trim() || placeholder.trim();
        const colorNumber = v.colorNumber?.trim() || null;
        const id = newProjectColorId();
        colors.push({
          id,
          colorNumber,
          colorName,
          notes: v.notes?.trim() || null,
        });
        placeholderToId[placeholder.trim()] = id;
        placeholderToId[placeholder.trim().toLowerCase()] = id;
      }
      return { colors, placeholderToId };
    }
  } catch {
    /* ignore */
  }
  return { colors: [], placeholderToId: {} };
}

export function serializeProjectColors(
  colors: ProjectColor[]
): string | null {
  const cleaned: ProjectColor[] = [];
  const seen = new Set<string>();
  for (const c of colors) {
    const n = normalizeColor(c);
    if (!n || seen.has(n.id)) continue;
    seen.add(n.id);
    cleaned.push(n);
  }
  if (cleaned.length === 0) return null;
  return JSON.stringify(cleaned);
}

/**
 * Remap a line-item color field that may be a project color id or a legacy placeholder.
 */
export function remapLineColorId(
  stored: string | null | undefined,
  colors: ProjectColor[],
  placeholderToId: Record<string, string>
): string | null {
  const raw = stored?.trim();
  if (!raw) return null;
  if (colors.some((c) => c.id === raw)) return raw;
  const mapped =
    placeholderToId[raw] ?? placeholderToId[raw.toLowerCase()] ?? null;
  if (mapped) return mapped;
  // Orphan / free-text: keep as-is if it looks like an id, else create nothing
  if (raw.startsWith("pc-")) return raw;
  return null;
}

/** Apply legacy placeholder → id remapping across surfaces; create colors for orphan placeholders. */
export function hydrateLineColorIds<T extends { colorName?: string | null }>(
  items: T[],
  colors: ProjectColor[],
  placeholderToId: Record<string, string>
): { items: T[]; colors: ProjectColor[] } {
  let nextColors = [...colors];
  const nextMap = { ...placeholderToId };
  const out = items.map((item) => {
    const raw = item.colorName?.trim();
    if (!raw) return { ...item, colorName: null };
    const existing = remapLineColorId(raw, nextColors, nextMap);
    if (existing) return { ...item, colorName: existing };
    // Legacy placeholder with no assignment entry — promote to a project color
    const id = newProjectColorId();
    nextColors = [
      ...nextColors,
      {
        id,
        colorNumber: null,
        colorName: raw,
        notes: null,
      },
    ];
    nextMap[raw] = id;
    nextMap[raw.toLowerCase()] = id;
    return { ...item, colorName: id };
  });
  return { items: out, colors: nextColors };
}
