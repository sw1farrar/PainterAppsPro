/**
 * Wall-by-wall exterior estimating — net siding from L×H minus openings.
 */

export const EXTERIOR_HEIGHT_PRESETS = [8, 9, 10] as const;

export const OPENING_SIZE_PRESETS = {
  window: { label: "Standard window", sqft: 15 },
  door: { label: "Entry door", sqft: 21 },
  garage: { label: "Garage door", sqft: 100 },
} as const;

export type ExteriorSurfaceKind =
  | "body"
  | "gable"
  | "accent"
  | "stucco"
  | "custom";

/** Quick-area whole-house cladding (maps to one body surface). */
export type ExteriorCladding = "siding" | "stucco";

export type ExteriorOpeningGroup = {
  count: number;
  avgSqft: number;
};

export type ExteriorWallOpenings = {
  windows: ExteriorOpeningGroup;
  doors: ExteriorOpeningGroup;
  garageDoors: ExteriorOpeningGroup;
  other: ExteriorOpeningGroup & { label?: string };
};

export type ExteriorWall = {
  id: string;
  name: string;
  lengthFt: number;
  heightFt: number;
  surfaceKind: ExteriorSurfaceKind;
  /** Used when surfaceKind === "custom" */
  surfaceLabel?: string;
  openings: ExteriorWallOpenings;
  /** Per-wall trim LF; ignored when trimScope is global */
  trimLf: number | null;
};

export type ExteriorEstimateMode = "simple" | "walls";
export type ExteriorTrimScope = "global" | "per_wall";

export type ExteriorWallsMeta = {
  exteriorMode: ExteriorEstimateMode;
  trimScope: ExteriorTrimScope;
  walls: ExteriorWall[];
  /** Quick-area cladding; ignored in wall-by-wall (walls use surfaceKind). */
  cladding?: ExteriorCladding;
};

export type ExteriorWallMetrics = {
  grossSqft: number;
  openingsSqft: number;
  netSqft: number;
  windowCount: number;
  doorCount: number;
  garageDoorCount: number;
  otherOpeningCount: number;
  trimLf: number;
  showWork: string[];
};

export type ExteriorHouseMetrics = {
  walls: Array<ExteriorWallMetrics & { wallId: string; name: string }>;
  grossSqft: number;
  openingsSqft: number;
  netSqft: number;
  windowCount: number;
  doorCount: number;
  garageDoorCount: number;
  trimLf: number;
  /** Net sq ft grouped by surface label for line items */
  bySurface: Array<{ key: string; label: string; netSqft: number }>;
  showWork: string[];
};

let wallSeq = 0;
export function newExteriorWallId() {
  return `ew-${++wallSeq}-${Date.now()}`;
}

export function blankOpenings(
  partial?: Partial<ExteriorWallOpenings>
): ExteriorWallOpenings {
  return {
    windows: {
      count: 0,
      avgSqft: OPENING_SIZE_PRESETS.window.sqft,
      ...partial?.windows,
    },
    doors: {
      count: 0,
      avgSqft: OPENING_SIZE_PRESETS.door.sqft,
      ...partial?.doors,
    },
    garageDoors: {
      count: 0,
      avgSqft: OPENING_SIZE_PRESETS.garage.sqft,
      ...partial?.garageDoors,
    },
    other: {
      count: 0,
      avgSqft: 15,
      label: "Other",
      ...partial?.other,
    },
  };
}

export function createExteriorWall(
  partial?: Partial<ExteriorWall> & { name?: string }
): ExteriorWall {
  return {
    id: partial?.id ?? newExteriorWallId(),
    name: partial?.name ?? "Wall",
    lengthFt: partial?.lengthFt ?? 20,
    heightFt: partial?.heightFt ?? 9,
    surfaceKind: partial?.surfaceKind ?? "body",
    surfaceLabel: partial?.surfaceLabel,
    openings: blankOpenings(partial?.openings),
    trimLf: partial?.trimLf ?? null,
  };
}

/** Sensible 4-side whole-house starter (≈40×30 footprint, 9 ft). */
export function defaultWholeHouseWalls(): ExteriorWall[] {
  return [
    createExteriorWall({
      name: "Wall 1 — Front",
      lengthFt: 40,
      heightFt: 9,
      openings: blankOpenings({
        windows: { count: 3, avgSqft: OPENING_SIZE_PRESETS.window.sqft },
        doors: { count: 1, avgSqft: OPENING_SIZE_PRESETS.door.sqft },
      }),
      trimLf: 120,
    }),
    createExteriorWall({
      name: "Wall 2 — Right",
      lengthFt: 30,
      heightFt: 9,
      openings: blankOpenings({
        windows: { count: 2, avgSqft: OPENING_SIZE_PRESETS.window.sqft },
      }),
      trimLf: 90,
    }),
    createExteriorWall({
      name: "Wall 3 — Back",
      lengthFt: 40,
      heightFt: 9,
      openings: blankOpenings({
        windows: { count: 2, avgSqft: OPENING_SIZE_PRESETS.window.sqft },
        doors: { count: 1, avgSqft: OPENING_SIZE_PRESETS.door.sqft },
      }),
      trimLf: 120,
    }),
    createExteriorWall({
      name: "Wall 4 — Left",
      lengthFt: 30,
      heightFt: 9,
      openings: blankOpenings({
        windows: { count: 1, avgSqft: OPENING_SIZE_PRESETS.window.sqft },
        garageDoors: { count: 1, avgSqft: OPENING_SIZE_PRESETS.garage.sqft },
      }),
      trimLf: 90,
    }),
  ];
}

export function surfaceKindLabel(
  kind: ExteriorSurfaceKind,
  customLabel?: string
): string {
  switch (kind) {
    case "body":
      return "Main walls (siding)";
    case "gable":
      return "Gable (roof peak)";
    case "accent":
      return "Accent / trim boards";
    case "stucco":
      return "Stucco";
    case "custom":
      return customLabel?.trim() || "Custom siding";
  }
}

/** Catalog surface + product defaults for a wall-by-wall / cladding group. */
export function exteriorGroupCatalog(groupKey: string): {
  surfaceType: string;
  label: string;
  /** Prefer product whose defaultSurfaceType matches */
  productSurfaceType: string;
} {
  if (groupKey === "stucco" || groupKey.startsWith("stucco")) {
    return {
      // Surface type triggers stucco labor + 20% coverage reduction on the product
      surfaceType: "Exterior Stucco",
      label: "Stucco",
      // Prefer normal exterior paints; gallons use product × 0.8
      productSurfaceType: "Exterior Siding",
    };
  }
  if (groupKey === "gable") {
    return {
      surfaceType: "Exterior Siding",
      label: "Gable (roof peak)",
      productSurfaceType: "Exterior Siding",
    };
  }
  if (groupKey === "accent") {
    return {
      surfaceType: "Exterior Siding",
      label: "Accent / trim boards",
      productSurfaceType: "Exterior Siding",
    };
  }
  if (groupKey.startsWith("custom:")) {
    return {
      surfaceType: "Exterior Siding",
      label: groupKey.slice("custom:".length) || "Custom siding",
      productSurfaceType: "Exterior Siding",
    };
  }
  return {
    surfaceType: "Exterior Siding",
    label: "Exterior Siding",
    productSurfaceType: "Exterior Siding",
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function openingsSqft(openings: ExteriorWallOpenings): number {
  const w = (openings.windows.count || 0) * (openings.windows.avgSqft || 0);
  const d = (openings.doors.count || 0) * (openings.doors.avgSqft || 0);
  const g =
    (openings.garageDoors.count || 0) * (openings.garageDoors.avgSqft || 0);
  const o = (openings.other.count || 0) * (openings.other.avgSqft || 0);
  return round2(w + d + g + o);
}

export function calculateExteriorWall(wall: ExteriorWall): ExteriorWallMetrics {
  const grossSqft = round2((wall.lengthFt || 0) * (wall.heightFt || 0));
  const openSqft = openingsSqft(wall.openings);
  const netSqft = round2(Math.max(0, grossSqft - openSqft));
  const showWork = [
    `${wall.name}: ${wall.lengthFt} × ${wall.heightFt} = ${grossSqft} sq ft gross`,
    openSqft > 0
      ? `  − openings ${openSqft} sq ft → ${netSqft} sq ft net`
      : `  → ${netSqft} sq ft net (no openings)`,
  ];
  return {
    grossSqft,
    openingsSqft: openSqft,
    netSqft,
    windowCount: wall.openings.windows.count || 0,
    doorCount: wall.openings.doors.count || 0,
    garageDoorCount: wall.openings.garageDoors.count || 0,
    otherOpeningCount: wall.openings.other.count || 0,
    trimLf: wall.trimLf ?? 0,
    showWork,
  };
}

export function calculateExteriorHouseMetrics(
  walls: ExteriorWall[],
  opts?: { trimScope?: ExteriorTrimScope; globalTrimLf?: number }
): ExteriorHouseMetrics {
  const trimScope = opts?.trimScope ?? "global";
  const wallMetrics = walls.map((w) => ({
    wallId: w.id,
    name: w.name,
    ...calculateExteriorWall(w),
  }));

  const grossSqft = round2(wallMetrics.reduce((s, w) => s + w.grossSqft, 0));
  const openingsSqft = round2(
    wallMetrics.reduce((s, w) => s + w.openingsSqft, 0)
  );
  const netSqft = round2(wallMetrics.reduce((s, w) => s + w.netSqft, 0));
  const windowCount = wallMetrics.reduce((s, w) => s + w.windowCount, 0);
  const doorCount = wallMetrics.reduce((s, w) => s + w.doorCount, 0);
  const garageDoorCount = wallMetrics.reduce(
    (s, w) => s + w.garageDoorCount,
    0
  );

  const trimLf =
    trimScope === "per_wall"
      ? round2(wallMetrics.reduce((s, w) => s + w.trimLf, 0))
      : round2(opts?.globalTrimLf ?? 0);

  const groupMap = new Map<string, { label: string; netSqft: number }>();
  for (const wall of walls) {
    const m = calculateExteriorWall(wall);
    const label = surfaceKindLabel(wall.surfaceKind, wall.surfaceLabel);
    const key =
      wall.surfaceKind === "custom"
        ? `custom:${label.toLowerCase()}`
        : wall.surfaceKind;
    const prev = groupMap.get(key);
    if (prev) prev.netSqft = round2(prev.netSqft + m.netSqft);
    else groupMap.set(key, { label, netSqft: m.netSqft });
  }
  const bySurface = [...groupMap.entries()].map(([key, v]) => ({
    key,
    label: v.label,
    netSqft: v.netSqft,
  }));

  const showWork = [
    ...wallMetrics.flatMap((w) => w.showWork),
    `Total gross = ${grossSqft} sq ft`,
    `Total openings = ${openingsSqft} sq ft`,
    `Total net siding = ${netSqft} sq ft`,
    `Doors ${doorCount} · Windows ${windowCount}` +
      (garageDoorCount ? ` · Garage ${garageDoorCount}` : ""),
    `Trim = ${trimLf} LF (${trimScope === "per_wall" ? "sum of walls" : "global"})`,
  ];

  return {
    walls: wallMetrics,
    grossSqft,
    openingsSqft,
    netSqft,
    windowCount,
    doorCount,
    garageDoorCount,
    trimLf,
    bySurface,
    showWork,
  };
}

export function parseExteriorWallsMeta(
  json: string | null | undefined
): ExteriorWallsMeta | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Partial<ExteriorWallsMeta> & {
      exteriorWalls?: ExteriorWall[];
    };
    const walls = raw.walls ?? raw.exteriorWalls;
    if (!Array.isArray(walls) || walls.length === 0) {
      if (raw.exteriorMode === "simple" || raw.cladding) {
        return {
          exteriorMode: "simple",
          trimScope: raw.trimScope === "per_wall" ? "per_wall" : "global",
          cladding: raw.cladding === "stucco" ? "stucco" : "siding",
          walls: [],
        };
      }
      return null;
    }
    return {
      exteriorMode: raw.exteriorMode === "walls" ? "walls" : "simple",
      trimScope: raw.trimScope === "per_wall" ? "per_wall" : "global",
      cladding: raw.cladding === "stucco" ? "stucco" : "siding",
      walls: walls.map((w, i) =>
        createExteriorWall({
          ...w,
          name: w.name || `Wall ${i + 1}`,
          openings: blankOpenings(w.openings),
        })
      ),
    };
  } catch {
    return null;
  }
}

/** Merge exterior walls meta into an existing dimensionsJson object string. */
export function mergeExteriorWallsIntoDimensionsJson(
  existingJson: string | null | undefined,
  meta: ExteriorWallsMeta,
  extra?: Record<string, unknown>
): string {
  let base: Record<string, unknown> = {};
  if (existingJson) {
    try {
      base = JSON.parse(existingJson) as Record<string, unknown>;
    } catch {
      base = {};
    }
  }
  return JSON.stringify({
    ...base,
    ...extra,
    exteriorMode: meta.exteriorMode,
    trimScope: meta.trimScope,
    cladding: meta.cladding ?? "siding",
    walls: meta.walls,
  });
}

export function findExteriorWallsMetaInSurfaces(
  surfaces: Array<{ dimensionsJson: string | null | undefined }>
): ExteriorWallsMeta | null {
  for (const s of surfaces) {
    const meta = parseExteriorWallsMeta(s.dimensionsJson);
    if (meta && (meta.exteriorMode === "walls" || meta.walls.length > 0)) {
      return meta;
    }
  }
  for (const s of surfaces) {
    const meta = parseExteriorWallsMeta(s.dimensionsJson);
    if (meta) return meta;
  }
  return null;
}

/** Feature keys owned by wall-by-wall siding groups (excl. custom). */
export function exteriorGroupFeatureKey(
  groupKey: string
):
  | "exterior_siding"
  | "exterior_gable"
  | "exterior_accent"
  | "exterior_stucco"
  | null {
  if (groupKey === "body") return "exterior_siding";
  if (groupKey === "gable") return "exterior_gable";
  if (groupKey === "accent") return "exterior_accent";
  if (groupKey === "stucco") return "exterior_stucco";
  return null;
}

export function isWallDerivedSidingSurface(meta: {
  featureKey?: string | null;
  exteriorSurfaceGroup?: string | null;
  exteriorMode?: string | null;
}): boolean {
  const fk = meta.featureKey;
  if (
    fk === "exterior_siding" ||
    fk === "exterior_gable" ||
    fk === "exterior_accent" ||
    fk === "exterior_stucco"
  ) {
    return true;
  }
  return !!meta.exteriorSurfaceGroup;
}
