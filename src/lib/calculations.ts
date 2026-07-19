/**
 * PainterApps Pro — Pure calculation utilities
 *
 * Formulas (transparent, overrideable):
 *   Gallons  = (paint_area × coats × (1 + waste%/100)) / spread_rating_sqft_per_gallon
 *     paint_area = sq ft for area surfaces;
 *                  LF for trim/crown (contractor convention: same spread rating);
 *                  units × paint sq ft/unit for doors/windows/cabinets
 *   Labor hrs = area/units ÷ rate (first/additional coat aware) × condition
 *   Prep hrs  = paint labor × prep%
 *   Material $ = gallons × price_per_gallon × (1 + markup%/100)
 *   Labor $    = (labor + prep) hrs × blended_labor_rate
 *   Line total = material $ + labor $
 *
 * Spread rating (coverage sq ft/gal) comes from the paint product assigned to
 * each surface. Use DEFAULT_SPREAD_RATING_SQFT_PER_GALLON when unset.
 *
 * Calibrate production rates to YOUR crew — industry averages are starting points only.
 */

export type MeasurementType = "area" | "unit";
export type RoomKind = "interior" | "exterior";
export type RoomCondition = "easy" | "medium" | "hard";
export type ExtraAmountType = "fixed" | "percent_of_subtotal";

/** Industry-standard default spread rating (sq ft per gallon). */
export const DEFAULT_SPREAD_RATING_SQFT_PER_GALLON = 375;

/**
 * Stucco texture uses more paint: effective spread = product rating × this factor
 * (20% lower coverage → ~25% more gallons than the same product on smooth siding).
 */
export const STUCCO_COVERAGE_FACTOR = 0.8;

export function isStuccoSurface(surfaceType?: string | null): boolean {
  if (!surfaceType) return false;
  return surfaceType.toLowerCase().includes("stucco");
}

/** Product can rating, adjusted for stucco when applicable. */
export function effectiveCoverageSqftPerGallon(
  productCoverageSqftPerGallon: number | null | undefined,
  surfaceType?: string | null
): number {
  const base =
    productCoverageSqftPerGallon && productCoverageSqftPerGallon > 0
      ? productCoverageSqftPerGallon
      : DEFAULT_SPREAD_RATING_SQFT_PER_GALLON;
  if (isStuccoSurface(surfaceType)) {
    return roundQty(base * STUCCO_COVERAGE_FACTOR);
  }
  return base;
}

/** Paint sq ft per interior/exterior door (both faces ≈ 3×7×2). */
export const DEFAULT_DOOR_PAINT_SQFT = 40;

/** Paint sq ft per window sash unit (casing LF is counted under trim). */
export const DEFAULT_WINDOW_PAINT_SQFT = 10;

/** Paint sq ft per cabinet door/drawer face. */
export const DEFAULT_CABINET_PAINT_SQFT = 8;

export const CONDITION_MULTIPLIERS: Record<RoomCondition, number> = {
  easy: 0.9,
  medium: 1.0,
  hard: 1.25,
};

export interface WallSegment {
  id: string;
  label?: string;
  lengthFt: number;
  heightFt: number;
}

export interface Opening {
  id: string;
  type: "door" | "window" | "other";
  widthFt: number;
  heightFt: number;
  count: number;
}

export interface WallCalculatorInput {
  walls: WallSegment[];
  openings: Opening[];
}

/** Typical interior window casing perimeter (average window) */
export const DEFAULT_WINDOW_CASING_LF = 16;

export interface InteriorRoomMetricsInput {
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  doorCount: number;
  windowCount: number;
  /** Blank wall holes — deduct paint area only, no trim/paint surfaces */
  openingCount?: number;
  doorDeductionSqft?: number;
  windowDeductionSqft?: number;
  /** Sq ft deducted per blank opening (defaults to window deduction) */
  openingDeductionSqft?: number;
  /** Linear ft of casing trim per window */
  windowCasingLf?: number;
}

export interface InteriorRoomMetrics {
  perimeterFt: number;
  wallGrossSqft: number;
  openingsSqft: number;
  wallNetSqft: number;
  ceilingSqft: number;
  /** Floor-level baseboard = perimeter */
  baseboardLf: number;
  /** Casing trim around windows only */
  windowCasingLf: number;
  /** Total baseboard + window casing (not including crown) */
  trimLf: number;
  /** Crown molding LF (typically = perimeter) */
  crownLf: number;
  floorSqft: number;
  showWork: string[];
}

export interface LineItemCalcInput {
  measurementType: MeasurementType;
  inputAreaSqft?: number | null;
  quantity?: number | null;
  /** Unit measure label: lf | door | window | cabinet — drives paint-area conversion */
  unitLabel?: string | null;
  /** Catalog surface type — used to distinguish cabinet doors from room doors */
  surfaceType?: string | null;
  coats: number;
  coverageSqftPerGallon?: number | null;
  pricePerGallon?: number | null;
  productionRatePerManHour?: number | null;
  firstCoatRate?: number | null;
  additionalCoatRate?: number | null;
  effective2CoatRate?: number | null;
  wasteFactorPct: number;
  materialMarkupPct: number;
  laborRate: number;
  conditionMultiplier?: number | null;
  prepPct?: number | null;
  /** Manual overrides — when set, replace calculated values */
  gallonsOverride?: number | null;
  laborHoursOverride?: number | null;
  materialCostOverride?: number | null;
  laborCostOverride?: number | null;
  lineTotalOverride?: number | null;
  surfaceLabel?: string | null;
}

/**
 * Convert a unit quantity into paint area for the gallons formula.
 * - LF (trim/crown): quantity used directly (same spread rating as sq ft — common estimating practice)
 * - door / window / cabinet: quantity × typical paint sq ft per unit
 * - Explicit inputAreaSqft on the line item wins when set (> 0)
 */
export function paintAreaSqftForLineItem(input: {
  measurementType: MeasurementType | string;
  inputAreaSqft?: number | null;
  quantity?: number | null;
  unitLabel?: string | null;
  surfaceType?: string | null;
  surfaceLabel?: string | null;
}): number {
  if (input.measurementType === "area") {
    return input.inputAreaSqft ?? 0;
  }

  // Manual coverage area on a unit line (rare override)
  if ((input.inputAreaSqft ?? 0) > 0) {
    return input.inputAreaSqft ?? 0;
  }

  const qty = input.quantity ?? 0;
  if (qty <= 0) return 0;

  const label = (input.unitLabel || "").toLowerCase().trim();
  const surface = `${input.surfaceType || ""} ${input.surfaceLabel || ""}`.toLowerCase();

  if (surface.includes("cabinet") || label === "cabinet" || label === "cab") {
    return roundQty(qty * DEFAULT_CABINET_PAINT_SQFT);
  }
  if (
    label === "lf" ||
    label === "lin ft" ||
    label === "linear ft" ||
    label === "lin. ft."
  ) {
    return qty;
  }
  if (label === "door" || label === "doors") {
    return roundQty(qty * DEFAULT_DOOR_PAINT_SQFT);
  }
  if (label === "window" || label === "windows") {
    return roundQty(qty * DEFAULT_WINDOW_PAINT_SQFT);
  }
  return 0;
}

export interface LineItemCalcResult {
  gallons: number;
  laborHours: number;
  prepHours: number;
  materialCost: number;
  laborCost: number;
  lineTotal: number;
  /** Base quantity used (sqft or units) */
  measureValue: number;
  conditionMultiplier: number;
  formulas: {
    gallons: string;
    laborHours: string;
    prepHours: string;
    materialCost: string;
    laborCost: string;
  };
  showWork: string[];
}

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function roundQty(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function conditionMultiplier(condition: string | null | undefined): number {
  const key = (condition || "medium") as RoomCondition;
  return CONDITION_MULTIPLIERS[key] ?? 1;
}

/** Net wall area from segments minus openings */
export function calculateWallArea(input: WallCalculatorInput): {
  grossSqft: number;
  openingsSqft: number;
  netSqft: number;
} {
  const grossSqft = input.walls.reduce(
    (sum, w) => sum + (w.lengthFt || 0) * (w.heightFt || 0),
    0
  );
  const openingsSqft = input.openings.reduce(
    (sum, o) => sum + (o.widthFt || 0) * (o.heightFt || 0) * (o.count || 1),
    0
  );
  const netSqft = Math.max(0, grossSqft - openingsSqft);
  return {
    grossSqft: roundQty(grossSqft),
    openingsSqft: roundQty(openingsSqft),
    netSqft: roundQty(netSqft),
  };
}

/**
 * Rectangular room metrics.
 * - Doors & windows: deduct wall paint area; windows also add casing trim LF
 * - Blank openings: deduct wall paint only (no trim, no paint surfaces)
 * - Trim total = baseboard (perimeter) + window casing
 */
export function calculateInteriorRoomMetrics(
  input: InteriorRoomMetricsInput
): InteriorRoomMetrics {
  const L = input.lengthFt || 0;
  const W = input.widthFt || 0;
  const H = input.heightFt || 0;
  const doors = input.doorCount || 0;
  const windows = input.windowCount || 0;
  const blanks = input.openingCount || 0;
  const doorDeduct = input.doorDeductionSqft ?? 20;
  const windowDeduct = input.windowDeductionSqft ?? 15;
  const blankDeduct = input.openingDeductionSqft ?? windowDeduct;
  const casingPerWindow = input.windowCasingLf ?? DEFAULT_WINDOW_CASING_LF;

  const perimeterFt = roundQty(2 * (L + W));
  const wallGrossSqft = roundQty(perimeterFt * H);
  const openingsSqft = roundQty(
    doors * doorDeduct + windows * windowDeduct + blanks * blankDeduct
  );
  const wallNetSqft = roundQty(Math.max(0, wallGrossSqft - openingsSqft));
  const ceilingSqft = roundQty(L * W);
  const baseboardLf = perimeterFt;
  const windowCasingLf = roundQty(windows * casingPerWindow);
  const trimLf = roundQty(baseboardLf + windowCasingLf);
  const crownLf = perimeterFt;
  const floorSqft = ceilingSqft;

  const showWork = [
    `Perimeter = 2 × (${L} + ${W}) = ${perimeterFt} LF`,
    `Wall gross = ${perimeterFt} LF × ${H} ft = ${wallGrossSqft} sq ft`,
    `Wall deductions = ${doors} doors × ${doorDeduct} + ${windows} windows × ${windowDeduct} + ${blanks} openings × ${blankDeduct} = ${openingsSqft} sq ft`,
    `Wall net = ${wallGrossSqft} − ${openingsSqft} = ${wallNetSqft} sq ft`,
    `Ceiling = ${L} × ${W} = ${ceilingSqft} sq ft`,
    `Baseboard = perimeter = ${baseboardLf} LF`,
    `Window casing = ${windows} × ${casingPerWindow} LF = ${windowCasingLf} LF`,
    `Trim (base + casing) = ${baseboardLf} + ${windowCasingLf} = ${trimLf} LF`,
    `Crown = perimeter = ${crownLf} LF`,
  ];

  return {
    perimeterFt,
    wallGrossSqft,
    openingsSqft,
    wallNetSqft,
    ceilingSqft,
    baseboardLf,
    windowCasingLf,
    trimLf,
    crownLf,
    floorSqft,
    showWork,
  };
}

export type RoomSurfaceKey =
  | "walls_smooth"
  | "walls_textured"
  | "ceiling"
  | "trim"
  | "crown"
  | "doors"
  | "windows"
  | "cabinets"
  | "closet"
  | "closet_ceiling"
  | "closet_trim"
  | "exterior_siding"
  | "exterior_gable"
  | "exterior_accent"
  | "exterior_stucco"
  | "exterior_trim"
  | "exterior_doors"
  | "exterior_windows";

/** Walk-in / reach-in closet: walls from W×D×H minus door opening */
export function calculateClosetMetrics(input: {
  widthFt: number;
  depthFt: number;
  heightFt: number;
  doorDeductionSqft?: number;
}): {
  wallNetSqft: number;
  ceilingSqft: number;
  /** Baseboard LF = full closet perimeter */
  baseboardLf: number;
  showWork: string[];
} {
  const W = input.widthFt || 0;
  const D = input.depthFt || 0;
  const H = input.heightFt || 0;
  const door = input.doorDeductionSqft ?? 15;
  const perimeter = 2 * (W + D);
  const baseboardLf = roundQty(perimeter);
  const wallGross = perimeter * H;
  const wallNetSqft = roundQty(Math.max(0, wallGross - door));
  const ceilingSqft = roundQty(W * D);
  return {
    wallNetSqft,
    ceilingSqft,
    baseboardLf,
    showWork: [
      `Closet perimeter = 2 × (${W} + ${D}) = ${baseboardLf} LF`,
      `Closet walls = ${baseboardLf} × ${H} − ${door} door = ${wallNetSqft} sq ft`,
      `Closet ceiling = ${W} × ${D} = ${ceilingSqft} sq ft`,
      `Closet baseboards = perimeter = ${baseboardLf} LF`,
    ],
  };
}

export interface ExpandedSurfaceDraft {
  key: RoomSurfaceKey;
  description: string;
  surfaceType: string;
  measurementType: MeasurementType;
  inputAreaSqft: number | null;
  quantity: number | null;
  unitLabel: string | null;
  coats: number;
  method: string;
  showWork: string[];
}

export function expandRoomSurfaces(input: {
  roomName: string;
  kind: RoomKind;
  selected: RoomSurfaceKey[];
  metrics?: InteriorRoomMetrics | null;
  exteriorAreaSqft?: number | null;
  exteriorLinearFt?: number | null;
  doorCount?: number;
  windowCount?: number;
  coats?: number;
  /** Optional closet dims when selected includes closet */
  closet?: { widthFt: number; depthFt: number; heightFt: number } | null;
}): ExpandedSurfaceDraft[] {
  const coats = input.coats ?? 2;
  const name = input.roomName || "Room";
  const out: ExpandedSurfaceDraft[] = [];

  for (const key of input.selected) {
    switch (key) {
      case "walls_smooth":
        out.push({
          key,
          description: `${name} — Walls (smooth)`,
          surfaceType: "Interior Walls Smooth",
          measurementType: "area",
          inputAreaSqft: input.metrics?.wallNetSqft ?? 0,
          quantity: null,
          unitLabel: null,
          coats,
          method: "Brush/Roll",
          showWork: input.metrics?.showWork ?? [],
        });
        break;
      case "walls_textured":
        out.push({
          key,
          description: `${name} — Walls (textured)`,
          surfaceType: "Interior Walls Textured",
          measurementType: "area",
          inputAreaSqft: input.metrics?.wallNetSqft ?? 0,
          quantity: null,
          unitLabel: null,
          coats,
          method: "Brush/Roll",
          showWork: input.metrics?.showWork ?? [],
        });
        break;
      case "ceiling":
        out.push({
          key,
          description: `${name} — Ceiling`,
          surfaceType: "Interior Ceilings",
          measurementType: "area",
          inputAreaSqft: input.metrics?.ceilingSqft ?? 0,
          quantity: null,
          unitLabel: null,
          coats,
          method: "Brush/Roll",
          showWork: [
            `Ceiling = length × width = ${input.metrics?.ceilingSqft ?? 0} sq ft`,
          ],
        });
        break;
      case "trim":
        out.push({
          key,
          description: `${name} — Trim & baseboards`,
          surfaceType: "Interior Trim / Baseboards",
          measurementType: "unit",
          inputAreaSqft: null,
          quantity: input.metrics?.trimLf ?? input.metrics?.baseboardLf ?? 0,
          unitLabel: "lf",
          coats,
          method: "Brush",
          showWork: [
            `Trim & baseboards = baseboard ${input.metrics?.baseboardLf ?? 0} LF + window casing ${input.metrics?.windowCasingLf ?? 0} LF = ${input.metrics?.trimLf ?? 0} LF`,
          ],
        });
        break;
      case "crown":
        out.push({
          key,
          description: `${name} — Crown molding`,
          surfaceType: "Interior Crown Molding",
          measurementType: "unit",
          inputAreaSqft: null,
          quantity: input.metrics?.crownLf ?? input.metrics?.perimeterFt ?? 0,
          unitLabel: "lf",
          coats,
          method: "Brush",
          showWork: [
            `Crown = perimeter = ${input.metrics?.crownLf ?? 0} LF`,
          ],
        });
        break;
      case "doors":
        out.push({
          key,
          description: `${name} — Doors`,
          surfaceType: "Interior Doors (both sides)",
          measurementType: "unit",
          inputAreaSqft: null,
          quantity: input.doorCount ?? 0,
          unitLabel: "door",
          coats,
          method: "Brush/Roll",
          showWork: [`Doors = ${input.doorCount ?? 0} units (both sides)`],
        });
        break;
      case "windows":
        out.push({
          key,
          description: `${name} — Windows`,
          surfaceType: "Interior Windows",
          measurementType: "unit",
          inputAreaSqft: null,
          quantity: input.windowCount ?? 0,
          unitLabel: "window",
          coats,
          method: "Brush",
          showWork: [`Windows = ${input.windowCount ?? 0} units`],
        });
        break;
      case "cabinets":
        out.push({
          key,
          description: `${name} — Cabinets`,
          surfaceType: "Cabinet Boxes (per door)",
          measurementType: "unit",
          inputAreaSqft: null,
          quantity: 0,
          unitLabel: "cabinet",
          coats,
          method: "Spray",
          showWork: ["Enter cabinet door/drawer count"],
        });
        break;
      case "closet": {
        const c = input.closet ?? { widthFt: 4, depthFt: 2, heightFt: 8 };
        const cm = calculateClosetMetrics(c);
        out.push({
          key,
          description: `${name} — Closet walls`,
          surfaceType: "Closets",
          measurementType: "area",
          inputAreaSqft: cm.wallNetSqft,
          quantity: null,
          unitLabel: null,
          coats,
          method: "Brush/Roll",
          showWork: cm.showWork,
        });
        break;
      }
      case "closet_ceiling": {
        const c = input.closet ?? { widthFt: 4, depthFt: 2, heightFt: 8 };
        const cm = calculateClosetMetrics(c);
        out.push({
          key,
          description: `${name} — Closet ceiling`,
          surfaceType: "Closet Ceilings",
          measurementType: "area",
          inputAreaSqft: cm.ceilingSqft,
          quantity: null,
          unitLabel: null,
          coats,
          method: "Brush/Roll",
          showWork: [
            `Closet ceiling = ${c.widthFt} × ${c.depthFt} = ${cm.ceilingSqft} sq ft`,
          ],
        });
        break;
      }
      case "closet_trim": {
        const c = input.closet ?? { widthFt: 4, depthFt: 2, heightFt: 8 };
        const cm = calculateClosetMetrics(c);
        out.push({
          key,
          description: `${name} — Closet trim & baseboards`,
          surfaceType: "Interior Trim / Baseboards",
          measurementType: "unit",
          inputAreaSqft: null,
          quantity: cm.baseboardLf,
          unitLabel: "lf",
          coats,
          method: "Brush",
          showWork: [
            `Closet baseboards = perimeter 2 × (${c.widthFt} + ${c.depthFt}) = ${cm.baseboardLf} LF`,
          ],
        });
        break;
      }
      case "exterior_siding":
        out.push({
          key,
          description: `${name} — Exterior Siding`,
          surfaceType: "Exterior Siding",
          measurementType: "area",
          inputAreaSqft: input.exteriorAreaSqft ?? 0,
          quantity: null,
          unitLabel: null,
          coats,
          method: "Brush/Roll",
          showWork: [`Exterior area = ${input.exteriorAreaSqft ?? 0} sq ft`],
        });
        break;
      case "exterior_gable":
        out.push({
          key,
          description: `${name} — Gable (roof peak)`,
          surfaceType: "Exterior Siding",
          measurementType: "area",
          inputAreaSqft: 0,
          quantity: null,
          unitLabel: null,
          coats,
          method: "Brush/Roll",
          showWork: [
            "Gable = triangular wall under the roof peak (from wall-by-wall)",
          ],
        });
        break;
      case "exterior_accent":
        out.push({
          key,
          description: `${name} — Accent`,
          surfaceType: "Exterior Siding",
          measurementType: "area",
          inputAreaSqft: 0,
          quantity: null,
          unitLabel: null,
          coats,
          method: "Brush/Roll",
          showWork: [
            "Accent / different material from main walls (from wall-by-wall)",
          ],
        });
        break;
      case "exterior_stucco":
        out.push({
          key,
          description: `${name} — Stucco`,
          surfaceType: "Exterior Stucco",
          measurementType: "area",
          inputAreaSqft: input.exteriorAreaSqft ?? 0,
          quantity: null,
          unitLabel: null,
          coats,
          method: "Brush/Roll",
          showWork: [
            `Stucco area = ${input.exteriorAreaSqft ?? 0} sq ft`,
            `Spread = product rating × ${STUCCO_COVERAGE_FACTOR} (−20% coverage vs same paint on siding)`,
          ],
        });
        break;
      case "exterior_trim":
        out.push({
          key,
          description: `${name} — Exterior Trim`,
          surfaceType: "Exterior Trim",
          measurementType: "unit",
          inputAreaSqft: null,
          quantity: input.exteriorLinearFt ?? 0,
          unitLabel: "lf",
          coats,
          method: "Brush",
          showWork: [`Exterior trim = ${input.exteriorLinearFt ?? 0} LF`],
        });
        break;
      case "exterior_doors":
        out.push({
          key,
          description: `${name} — Exterior Doors`,
          surfaceType: "Exterior Doors",
          measurementType: "unit",
          inputAreaSqft: null,
          quantity: input.doorCount ?? 0,
          unitLabel: "door",
          coats,
          method: "Brush",
          showWork: [`Exterior doors = ${input.doorCount ?? 0}`],
        });
        break;
      case "exterior_windows":
        out.push({
          key,
          description: `${name} — Exterior Windows`,
          surfaceType: "Exterior Windows",
          measurementType: "unit",
          inputAreaSqft: null,
          quantity: input.windowCount ?? 0,
          unitLabel: "window",
          coats,
          method: "Brush",
          showWork: [`Exterior windows = ${input.windowCount ?? 0}`],
        });
        break;
    }
  }
  return out;
}

/** Compute labor hours from coats + optional first/additional/effective rates */
export function calculateLaborHours(input: {
  measureValue: number;
  coats: number;
  ratePerManHour: number;
  firstCoatRate?: number | null;
  additionalCoatRate?: number | null;
  effective2CoatRate?: number | null;
  conditionMultiplier?: number;
}): { laborHours: number; formula: string } {
  const coats = Math.max(1, input.coats || 1);
  const m = input.measureValue || 0;
  const cond = input.conditionMultiplier ?? 1;
  if (m <= 0) return { laborHours: 0, formula: "0 (no measure)" };

  const first = input.firstCoatRate;
  const add = input.additionalCoatRate;
  const eff2 = input.effective2CoatRate;
  const fallback = input.ratePerManHour || 100;

  let hours = 0;
  let formula = "";

  if (first != null && first > 0 && add != null && add > 0) {
    const firstHrs = m / first;
    const addHrs = coats > 1 ? ((coats - 1) * m) / add : 0;
    hours = (firstHrs + addHrs) * cond;
    formula = `(${m} ÷ ${first}/hr first${
      coats > 1 ? ` + ${coats - 1} × ${m} ÷ ${add}/hr add` : ""
    }) × ${cond} condition = ${roundQty(hours)} hrs`;
  } else if (eff2 != null && eff2 > 0 && coats === 2) {
    hours = (m / eff2) * cond;
    formula = `${m} ÷ ${eff2} sf/hr (2-coat effective) × ${cond} = ${roundQty(hours)} hrs`;
  } else if (eff2 != null && eff2 > 0 && coats !== 2) {
    // Scale effective 2-coat rate proportionally when coats != 2
    hours = ((m * coats) / (eff2 * 2)) * cond;
    formula = `(${m} × ${coats} coats) ÷ (${eff2}×2) × ${cond} = ${roundQty(hours)} hrs`;
  } else {
    hours = ((m * coats) / fallback) * cond;
    formula = `(${m} × ${coats} coats) ÷ ${fallback}/hr × ${cond} = ${roundQty(hours)} hrs`;
  }

  return { laborHours: roundQty(hours), formula };
}

export function calculateLineItem(input: LineItemCalcInput): LineItemCalcResult {
  const coats = Math.max(1, input.coats || 1);
  const waste = (input.wasteFactorPct ?? 0) / 100;
  const markup = (input.materialMarkupPct ?? 0) / 100;
  const productCoverage =
    input.coverageSqftPerGallon || DEFAULT_SPREAD_RATING_SQFT_PER_GALLON;
  const coverage = effectiveCoverageSqftPerGallon(
    productCoverage,
    input.surfaceType
  );
  const stuccoAdjusted =
    isStuccoSurface(input.surfaceType) && coverage !== productCoverage;
  const rate = input.productionRatePerManHour || 100;
  const laborRate = input.laborRate || 55;
  const cond = input.conditionMultiplier ?? 1;
  const prepPct = input.prepPct ?? 0;
  const label = input.surfaceLabel || "Surface";

  const measureValue =
    input.measurementType === "unit"
      ? input.quantity ?? 0
      : input.inputAreaSqft ?? 0;

  const paintAreaSqft = paintAreaSqftForLineItem(input);
  let gallons = 0;
  if (paintAreaSqft > 0) {
    gallons = (paintAreaSqft * coats * (1 + waste)) / coverage;
  }

  const labor = calculateLaborHours({
    measureValue,
    coats,
    ratePerManHour: rate,
    firstCoatRate: input.firstCoatRate,
    additionalCoatRate: input.additionalCoatRate,
    effective2CoatRate: input.effective2CoatRate,
    conditionMultiplier: cond,
  });

  let laborHours = labor.laborHours;
  let prepHours = roundQty(laborHours * (prepPct / 100));

  const price = input.pricePerGallon ?? 0;
  let materialCost = gallons * price * (1 + markup);
  let laborCost = (laborHours + prepHours) * laborRate;
  let lineTotal = materialCost + laborCost;

  // Apply overrides
  if (input.gallonsOverride != null) gallons = input.gallonsOverride;
  if (input.laborHoursOverride != null) {
    laborHours = input.laborHoursOverride;
    prepHours = roundQty(laborHours * (prepPct / 100));
  }
  if (input.materialCostOverride != null) {
    materialCost = input.materialCostOverride;
  } else if (input.gallonsOverride != null) {
    materialCost = gallons * price * (1 + markup);
  }
  if (input.laborCostOverride != null) {
    laborCost = input.laborCostOverride;
  } else if (input.laborHoursOverride != null) {
    laborCost = (laborHours + prepHours) * laborRate;
  }
  if (input.lineTotalOverride != null) {
    lineTotal = input.lineTotalOverride;
  } else {
    lineTotal = materialCost + laborCost;
  }

  const wastePct = input.wasteFactorPct ?? 0;
  const markupPct = input.materialMarkupPct ?? 0;
  const unitLabel = (input.unitLabel || "units").toLowerCase();
  const measureUnit =
    input.measurementType === "unit"
      ? unitLabel === "lf"
        ? "LF"
        : unitLabel
      : "sq ft";

  const showWork: string[] = [
    `${label}: ${measureValue} ${measureUnit}, ${coats} coats, condition ×${cond}`,
    labor.formula,
  ];
  if (
    input.measurementType === "unit" &&
    paintAreaSqft > 0 &&
    paintAreaSqft !== measureValue
  ) {
    showWork.push(
      `Paint area = ${measureValue} ${measureUnit} → ${paintAreaSqft} sq ft`
    );
  }
  if (prepHours > 0) {
    showWork.push(`Prep = ${laborHours} paint hrs × ${prepPct}% = ${prepHours} hrs`);
  }
  if (gallons > 0) {
    if (stuccoAdjusted) {
      showWork.push(
        `Stucco spread = ${productCoverage} product × ${STUCCO_COVERAGE_FACTOR} (−20%) = ${coverage} sf/gal`
      );
    }
    showWork.push(
      `Gallons = (${paintAreaSqft} × ${coats} × (1 + ${wastePct}%)) ÷ ${coverage} spread = ${roundQty(gallons, 2)} gal`
    );
  }
  showWork.push(
    `Material = ${roundQty(gallons, 2)} gal × $${price}/gal × (1 + ${markupPct}%) = $${roundMoney(materialCost).toFixed(2)}`
  );
  showWork.push(
    `Labor $ = (${laborHours} + ${prepHours} prep) × $${laborRate}/hr = $${roundMoney(laborCost).toFixed(2)}`
  );

  return {
    gallons: roundQty(gallons, 2),
    laborHours: roundQty(laborHours, 2),
    prepHours: roundQty(prepHours, 2),
    materialCost: roundMoney(materialCost),
    laborCost: roundMoney(laborCost),
    lineTotal: roundMoney(lineTotal),
    measureValue,
    conditionMultiplier: cond,
    formulas: {
      gallons: `(${paintAreaSqft} paint units × ${coats} coats × (1 + ${wastePct}%)) ÷ ${coverage} sf/gal spread`,
      laborHours: labor.formula,
      prepHours: `${laborHours} hrs × ${prepPct}% prep`,
      materialCost: `${roundQty(gallons, 2)} gal × $${price}/gal × (1 + ${markupPct}%)`,
      laborCost: `(${roundQty(laborHours, 2)} + ${roundQty(prepHours, 2)} prep) × $${laborRate}/hr`,
    },
    showWork,
  };
}

export interface EstimateExtraInput {
  category: string;
  label: string;
  amountType: ExtraAmountType | string;
  amount: number;
}

export interface EstimateTotalsInput {
  lineTotals: number[];
  materialCosts: number[];
  laborCosts: number[];
  laborHours?: number[];
  prepHours?: number[];
  taxRatePct: number;
  extras?: EstimateExtraInput[];
  discountPct?: number | null;
  discountAmount?: number | null;
  /**
   * Paint can packaging: replace continuous paint material $ with per-room
   * rounded purchase $, then apply efficiencyDiscount for project pooling.
   */
  paintPackaging?: {
    rawMaterialTotal: number;
    roomMaterialTotal: number;
    efficiencyDiscount: number;
  } | null;
  /** Cost basis for profit margin (materials + labor before markup is already in line costs) */
  costBasis?: number | null;
}

export interface EstimateTotals {
  materials: number;
  labor: number;
  paintLaborHours: number;
  prepHours: number;
  totalHours: number;
  extrasTotal: number;
  extrasBreakdown: { category: string; label: string; amount: number }[];
  subtotalBeforeDiscount: number;
  /** Manual % / $ discount */
  discount: number;
  /** Paint efficiency (shared cans across rooms) */
  paintEfficiencyDiscount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  salesRate: number;
  profitMarginPct: number;
}

export function calculateEstimateTotals(input: EstimateTotalsInput): EstimateTotals {
  let materials = roundMoney(input.materialCosts.reduce((a, b) => a + b, 0));
  const labor = roundMoney(input.laborCosts.reduce((a, b) => a + b, 0));
  const paintLaborHours = roundQty(
    (input.laborHours ?? []).reduce((a, b) => a + b, 0)
  );
  const prepHours = roundQty((input.prepHours ?? []).reduce((a, b) => a + b, 0));
  const totalHours = roundQty(paintLaborHours + prepHours);

  let lineSub = roundMoney(
    input.lineTotals.length
      ? input.lineTotals.reduce((a, b) => a + b, 0)
      : materials + labor
  );

  // Swap continuous paint material for per-room can-rounded material
  let paintEfficiencyDiscount = 0;
  const pack = input.paintPackaging;
  if (pack && pack.roomMaterialTotal >= 0 && pack.rawMaterialTotal >= 0) {
    const delta = roundMoney(pack.roomMaterialTotal - pack.rawMaterialTotal);
    materials = roundMoney(materials + delta);
    lineSub = roundMoney(lineSub + delta);
    paintEfficiencyDiscount = roundMoney(Math.max(0, pack.efficiencyDiscount));
  }

  const extrasBreakdown = (input.extras ?? []).map((e) => {
    const amount =
      e.amountType === "percent_of_subtotal"
        ? roundMoney(lineSub * ((e.amount || 0) / 100))
        : roundMoney(e.amount || 0);
    return { category: e.category, label: e.label, amount };
  });
  const extrasTotal = roundMoney(
    extrasBreakdown.reduce((a, b) => a + b.amount, 0)
  );

  const subtotalBeforeDiscount = roundMoney(lineSub + extrasTotal);

  let discount = 0;
  if (input.discountAmount != null && input.discountAmount > 0) {
    discount = roundMoney(input.discountAmount);
  } else if (input.discountPct != null && input.discountPct > 0) {
    discount = roundMoney(subtotalBeforeDiscount * (input.discountPct / 100));
  }
  discount = Math.min(discount, subtotalBeforeDiscount);

  const afterManual = roundMoney(subtotalBeforeDiscount - discount);
  paintEfficiencyDiscount = Math.min(paintEfficiencyDiscount, afterManual);
  const subtotal = roundMoney(afterManual - paintEfficiencyDiscount);
  const taxAmount = roundMoney(subtotal * ((input.taxRatePct ?? 0) / 100));
  const total = roundMoney(subtotal + taxAmount);
  const salesRate = totalHours > 0 ? roundMoney(total / totalHours) : 0;

  const costBasis =
    input.costBasis != null
      ? input.costBasis
      : materials + labor; // approximate; markup already in materials
  const profitMarginPct =
    total > 0 ? roundQty(((total - costBasis) / total) * 100, 1) : 0;

  return {
    materials,
    labor,
    paintLaborHours,
    prepHours,
    totalHours,
    extrasTotal,
    extrasBreakdown,
    subtotalBeforeDiscount,
    discount,
    paintEfficiencyDiscount,
    subtotal,
    taxAmount,
    total,
    salesRate,
    profitMarginPct,
  };
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function formatNumber(n: number | null | undefined, decimals = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
