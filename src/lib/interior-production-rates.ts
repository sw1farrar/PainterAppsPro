/**
 * Residential interior production rates — 2 coats, moderate conditions.
 *
 * Encoding notes (matches ProductionRate model / calculateLaborHours):
 * - Area & LF: rate = units completed per man-hour at the 2-coat job rate
 *   → hours = measure ÷ effective2CoatRate when coats === 2
 * - Doors/windows: stored as items/hr (= 1 ÷ hours_per_item)
 *   → 1.25 hrs/door ⇒ 0.8 doors/hr; 1.0 hr/window ⇒ 1.0 windows/hr
 *
 * Coat scaling when coats !== 2 and effective2CoatRate is set:
 *   hours = (measure × coats) ÷ (effective2CoatRate × 2)
 */

export type InteriorProductionRateConfig = {
  surfaceType: string;
  method: string;
  measurementType: "area" | "unit";
  /** Primary / fallback production (sq ft/hr, LF/hr, or items/hr) */
  ratePerManHour: number;
  firstCoatRate?: number | null;
  additionalCoatRate?: number | null;
  /** Blended production when coats === 2 (same units as ratePerManHour) */
  effective2CoatRate?: number | null;
  defaultCoats: number;
  notes?: string;
  sortOrder: number;
  /** Human-readable target used in docs / before-after tables */
  targetLabel: string;
};

/** Ready-to-import interior production rates */
export const INTERIOR_PRODUCTION_RATES: InteriorProductionRateConfig[] = [
  {
    surfaceType: "Interior Walls Smooth",
    method: "Brush/Roll",
    measurementType: "area",
    ratePerManHour: 90,
    effective2CoatRate: 90,
    firstCoatRate: null,
    additionalCoatRate: null,
    defaultCoats: 2,
    notes: "2-coat moderate residential — 90 sq ft/hr",
    sortOrder: 1,
    targetLabel: "90 sq ft/hr",
  },
  {
    surfaceType: "Interior Walls Textured",
    method: "Brush/Roll",
    measurementType: "area",
    ratePerManHour: 75,
    effective2CoatRate: 75,
    firstCoatRate: null,
    additionalCoatRate: null,
    defaultCoats: 2,
    notes: "2-coat moderate residential — 75 sq ft/hr",
    sortOrder: 2,
    targetLabel: "75 sq ft/hr",
  },
  {
    surfaceType: "Interior Ceilings",
    method: "Brush/Roll",
    measurementType: "area",
    ratePerManHour: 65,
    effective2CoatRate: 65,
    firstCoatRate: null,
    additionalCoatRate: null,
    defaultCoats: 2,
    notes: "Smooth ceilings — 65 sq ft/hr @ 2 coats",
    sortOrder: 4,
    targetLabel: "65 sq ft/hr",
  },
  {
    surfaceType: "Interior Ceilings Textured",
    method: "Brush/Roll",
    measurementType: "area",
    ratePerManHour: 55,
    effective2CoatRate: 55,
    firstCoatRate: null,
    additionalCoatRate: null,
    defaultCoats: 2,
    notes: "Textured ceilings — 55 sq ft/hr @ 2 coats",
    sortOrder: 4,
    targetLabel: "55 sq ft/hr",
  },
  {
    surfaceType: "Interior Trim / Baseboards",
    method: "Brush",
    measurementType: "unit",
    ratePerManHour: 28,
    effective2CoatRate: 28,
    firstCoatRate: null,
    additionalCoatRate: null,
    defaultCoats: 2,
    notes: "Baseboard / straight trim — 28 LF/hr @ 2 coats",
    sortOrder: 5,
    targetLabel: "28 LF/hr",
  },
  {
    surfaceType: "Interior Crown Molding",
    method: "Brush",
    measurementType: "unit",
    ratePerManHour: 20,
    effective2CoatRate: 20,
    firstCoatRate: null,
    additionalCoatRate: null,
    defaultCoats: 2,
    notes: "Crown molding — 20 LF/hr @ 2 coats",
    sortOrder: 5,
    targetLabel: "20 LF/hr",
  },
  {
    surfaceType: "Interior Doors (both sides)",
    method: "Brush/Roll",
    measurementType: "unit",
    // 1.25 hrs/door @ 2 coats → 0.8 doors/hr
    ratePerManHour: 0.8,
    effective2CoatRate: 0.8,
    // Optional split (~0.9 hr first + ~0.35 hr second ≈ 1.25)
    firstCoatRate: 1.11,
    additionalCoatRate: 2.86,
    defaultCoats: 2,
    notes: "Both sides + frame/jamb — 1.25 hrs/door @ 2 coats (0.8 doors/hr)",
    sortOrder: 6,
    targetLabel: "1.25 hrs/door",
  },
  {
    surfaceType: "Interior Windows",
    method: "Brush",
    measurementType: "unit",
    // 1.0 hr/window @ 2 coats → 1.0 windows/hr
    ratePerManHour: 1.0,
    effective2CoatRate: 1.0,
    firstCoatRate: null,
    additionalCoatRate: null,
    defaultCoats: 2,
    notes: "Casing + sill — 1.0 hr/window @ 2 coats",
    sortOrder: 7,
    targetLabel: "1.0 hr/window",
  },
  {
    surfaceType: "Closets",
    method: "Brush/Roll",
    measurementType: "area",
    ratePerManHour: 80,
    effective2CoatRate: 80,
    firstCoatRate: null,
    additionalCoatRate: null,
    defaultCoats: 2,
    notes: "Closet walls — 80 sq ft/hr @ 2 coats",
    sortOrder: 9,
    targetLabel: "80 sq ft/hr",
  },
  {
    surfaceType: "Closet Ceilings",
    method: "Brush/Roll",
    measurementType: "area",
    ratePerManHour: 60,
    effective2CoatRate: 60,
    firstCoatRate: null,
    additionalCoatRate: null,
    defaultCoats: 2,
    notes: "Closet ceilings — 60 sq ft/hr @ 2 coats",
    sortOrder: 9,
    targetLabel: "60 sq ft/hr",
  },
];

/** Suggested supporting rates (not auto-applied to room surfaces) */
export const SUPPORTING_PRODUCTION_RATES: InteriorProductionRateConfig[] = [
  {
    surfaceType: "Prep / Patching",
    method: "Hand",
    measurementType: "area",
    ratePerManHour: 50,
    effective2CoatRate: null,
    defaultCoats: 1,
    notes: "Patch/sand/caulk — ~50 sq ft wall area per prep hour",
    sortOrder: 17,
    targetLabel: "50 sq ft/hr",
  },
  {
    surfaceType: "Masking",
    method: "Hand",
    measurementType: "unit",
    ratePerManHour: 50,
    effective2CoatRate: null,
    defaultCoats: 1,
    notes: "Tape/paper/plastic — ~50 LF/hr",
    sortOrder: 18,
    targetLabel: "50 LF/hr",
  },
  {
    surfaceType: "Setup / Breakdown",
    method: "Hand",
    measurementType: "unit",
    ratePerManHour: 1,
    effective2CoatRate: null,
    defaultCoats: 1,
    notes: "Use quantity = hours (e.g. 0.75–1.5 hr per room or 2–4 hr/job)",
    sortOrder: 19,
    targetLabel: "1 hr / unit (enter hours as qty)",
  },
];

/** Strip UI-only fields for Prisma create/update */
export function toProductionRateRow(r: InteriorProductionRateConfig) {
  return {
    surfaceType: r.surfaceType,
    method: r.method,
    measurementType: r.measurementType,
    ratePerManHour: r.ratePerManHour,
    firstCoatRate: r.firstCoatRate ?? null,
    additionalCoatRate: r.additionalCoatRate ?? null,
    effective2CoatRate: r.effective2CoatRate ?? null,
    defaultCoats: r.defaultCoats,
    notes: r.notes ?? null,
    sortOrder: r.sortOrder,
  };
}
