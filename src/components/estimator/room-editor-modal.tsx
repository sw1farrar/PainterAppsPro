"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DoorOpen,
  Square,
  Layers,
  PanelTop,
  AppWindow,
  Boxes,
  Archive,
  Plus,
  Trash2,
  Save,
  X,
  Check,
  Crown,
  Pencil,
  Palette,
} from "lucide-react";
import type { RoomTypePreset } from "./room-type-picker";
import {
  calculateInteriorRoomMetrics,
  calculateClosetMetrics,
  calculateLineItem,
  conditionMultiplier,
  expandRoomSurfaces,
  formatCurrency,
  formatNumber,
  roundMoney,
  type RoomSurfaceKey,
} from "@/lib/calculations";
import {
  calculateExteriorHouseMetrics,
  defaultWholeHouseWalls,
  exteriorGroupCatalog,
  exteriorGroupFeatureKey,
  findExteriorWallsMetaInSurfaces,
  mergeExteriorWallsIntoDimensionsJson,
  type ExteriorCladding,
  type ExteriorEstimateMode,
  type ExteriorTrimScope,
  type ExteriorWall,
} from "@/lib/exterior-walls";
import {
  ExteriorModeToggle,
  ExteriorWallsPanel,
} from "@/components/estimator/exterior-walls-panel";
import { ProjectColorField } from "@/components/estimator/paint-color-field";
import { QuickAssignPaintModal } from "@/components/estimator/quick-assign-paint-modal";
import {
  formatProjectColorLabel,
  resolveProjectColor,
  type ProjectColor,
} from "@/lib/project-colors";
import {
  resolveDefaultPaint,
  type SurfaceProductDefaultsMap,
} from "@/lib/surface-product-defaults";
import {
  calculatePaintPackaging,
  roomPurchaseMaterialDeltaByKey,
} from "@/lib/paint-packaging";
import { cn } from "@/lib/utils";
import { uniqueRoomName } from "@/lib/room-names";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type EditorSurface = {
  _key: string;
  featureKey?: RoomSurfaceKey | null;
  description: string;
  surfaceType: string | null;
  measurementType: string;
  inputAreaSqft: number | null;
  quantity: number | null;
  unitLabel: string | null;
  dimensionsJson: string | null;
  coats: number;
  method: string | null;
  paintProductId: string | null;
  /** Selected sheen for the chosen product */
  sheen: string | null;
  /** Project color id (Estimate.project colors / colorAssignmentsJson) */
  colorName: string | null;
  /** @deprecated Unused */
  colorHex: string | null;
  productionRateId: string | null;
  productionRateOverride: number | null;
  sortOrder: number;
  /** When true, measure updates when room dims / openings change */
  autoLinked?: boolean;
};

export type EditorRoom = {
  _key: string;
  name: string;
  kind: "interior" | "exterior";
  lengthFt: number | null;
  widthFt: number | null;
  heightFt: number | null;
  doorCount: number;
  windowCount: number;
  openingCount: number;
  inputAreaSqft: number | null;
  inputLinearFt: number | null;
  condition: string;
  prepPct: number | null;
  notes: string | null;
  sortOrder: number;
  surfaces: EditorSurface[];
  closetWidthFt?: number;
  closetDepthFt?: number;
  closetHeightFt?: number;
  /** null = auto from room size / openings */
  trimBaseboardLf?: number | null;
  trimWindowCasingLf?: number | null;
  crownLf?: number | null;
  /** Exterior: quick area vs wall-by-wall */
  exteriorMode?: ExteriorEstimateMode;
  exteriorTrimScope?: ExteriorTrimScope;
  exteriorWalls?: ExteriorWall[];
  /** Quick-area cladding — drives Exterior Siding vs Exterior Stucco + spread */
  exteriorCladding?: ExteriorCladding;
};

type Product = {
  id: string;
  name: string;
  brand?: string;
  coverageSqftPerGallon: number;
  pricePerGallon: number;
  sheen?: string | null;
  defaultSurfaceType?: string | null;
  sheens?: Array<{ id?: string; name: string; sortOrder?: number }>;
};

type Rate = {
  id: string;
  surfaceType: string;
  method: string;
  measurementType: string;
  ratePerManHour: number;
  firstCoatRate?: number | null;
  additionalCoatRate?: number | null;
  effective2CoatRate?: number | null;
  defaultCoats: number;
};

const INTERIOR_FEATURES: {
  key: RoomSurfaceKey;
  label: string;
  hint: string;
  icon: typeof Square;
}[] = [
  { key: "walls_smooth", label: "Walls", hint: "Smooth finish", icon: Square },
  {
    key: "walls_textured",
    label: "Textured walls",
    hint: "Orange peel / knockdown",
    icon: Layers,
  },
  { key: "ceiling", label: "Ceiling", hint: "L × W", icon: PanelTop },
  {
    key: "trim",
    label: "Trim & baseboards",
    hint: "Base + casing",
    icon: Layers,
  },
  { key: "crown", label: "Crown", hint: "Crown molding LF", icon: Crown },
  { key: "doors", label: "Doors", hint: "Both sides", icon: DoorOpen },
  { key: "windows", label: "Windows", hint: "Per unit", icon: AppWindow },
  { key: "closet", label: "Closet", hint: "Walk-in / reach-in", icon: Archive },
  { key: "cabinets", label: "Cabinets", hint: "Per door", icon: Boxes },
];

const EXTERIOR_FEATURES: {
  key: RoomSurfaceKey;
  label: string;
  hint: string;
  icon: typeof Square;
}[] = [
  { key: "exterior_siding", label: "Siding", hint: "Main walls", icon: Square },
  { key: "exterior_trim", label: "Trim", hint: "Linear ft", icon: Layers },
  { key: "exterior_doors", label: "Doors", hint: "Per unit", icon: DoorOpen },
  {
    key: "exterior_windows",
    label: "Windows",
    hint: "Per unit",
    icon: AppWindow,
  },
];

let keySeq = 0;
function newKey() {
  return `re-${++keySeq}-${Date.now()}`;
}

function findRate(
  rates: Rate[],
  surfaceType: string | null | undefined,
  method?: string | null
) {
  if (!surfaceType) return undefined;
  if (method) {
    const exact = rates.find(
      (r) => r.surfaceType === surfaceType && r.method === method
    );
    if (exact) return exact;
  }
  return rates.find((r) => r.surfaceType === surfaceType);
}

function parseMeta(json: string | null | undefined): {
  autoLinked?: boolean;
  featureKey?: RoomSurfaceKey;
  closet?: { widthFt: number; depthFt: number; heightFt: number };
  exteriorMode?: ExteriorEstimateMode;
  trimScope?: ExteriorTrimScope;
  exteriorSurfaceGroup?: string;
  showWork?: string[];
} {
  if (!json) return {};
  try {
    return JSON.parse(json) as ReturnType<typeof parseMeta>;
  } catch {
    return {};
  }
}

function blankInteriorRoom(): EditorRoom {
  return {
    _key: newKey(),
    name: "New Room",
    kind: "interior",
    lengthFt: 12,
    widthFt: 15,
    heightFt: 8,
    doorCount: 2,
    windowCount: 2,
    openingCount: 0,
    inputAreaSqft: null,
    inputLinearFt: null,
    condition: "medium",
    prepPct: null,
    notes: null,
    sortOrder: 0,
    surfaces: [],
    closetWidthFt: 4,
    closetDepthFt: 2,
    closetHeightFt: 8,
    trimBaseboardLf: null,
    trimWindowCasingLf: null,
    crownLf: null,
  };
}

function blankExteriorRoom(): EditorRoom {
  return {
    _key: newKey(),
    name: "Exterior",
    kind: "exterior",
    lengthFt: null,
    widthFt: null,
    heightFt: null,
    doorCount: 1,
    windowCount: 0,
    openingCount: 0,
    inputAreaSqft: 0,
    inputLinearFt: 0,
    condition: "medium",
    prepPct: null,
    notes: null,
    sortOrder: 0,
    surfaces: [],
    trimBaseboardLf: null,
    trimWindowCasingLf: null,
    crownLf: null,
    exteriorMode: "simple",
    exteriorTrimScope: "global",
    exteriorWalls: [],
    exteriorCladding: "siding",
  };
}

function snapshot(room: EditorRoom) {
  return JSON.stringify(room);
}

/** Surfaces that should follow room / exterior size when dimensions change */
const ROOM_DERIVED_FEATURES = new Set<RoomSurfaceKey>([
  "walls_smooth",
  "walls_textured",
  "ceiling",
  "trim",
  "crown",
  "doors",
  "windows",
  "closet",
  "closet_ceiling",
  "closet_trim",
  "exterior_siding",
  "exterior_gable",
  "exterior_accent",
  "exterior_stucco",
  "exterior_trim",
  "exterior_doors",
  "exterior_windows",
]);

function exteriorWallsMetaFromRoom(room: EditorRoom) {
  return {
    exteriorMode: room.exteriorMode ?? "simple",
    trimScope: room.exteriorTrimScope ?? "global",
    cladding: room.exteriorCladding ?? "siding",
    walls: room.exteriorWalls ?? [],
  } as const;
}

/** Roll wall-by-wall totals onto room fields (siding, trim, door/window counts). */
function withExteriorWallTotals(room: EditorRoom): EditorRoom {
  if (room.kind !== "exterior" || room.exteriorMode !== "walls") return room;
  const walls = room.exteriorWalls ?? [];
  if (walls.length === 0) return room;
  const m = calculateExteriorHouseMetrics(walls, {
    trimScope: room.exteriorTrimScope ?? "global",
    globalTrimLf: room.inputLinearFt ?? 0,
  });
  return {
    ...room,
    inputAreaSqft: m.netSqft,
    inputLinearFt: m.trimLf,
    doorCount: m.doorCount,
    windowCount: m.windowCount,
  };
}

function applyRoomMetricsToSurfaces(
  room: EditorRoom,
  doorDeduct: number,
  windowDeduct: number,
  opts?: { forceDerived?: boolean }
): EditorSurface[] {
  const roomForMetrics = withExteriorWallTotals(room);
  const metrics =
    roomForMetrics.kind === "interior"
      ? calculateInteriorRoomMetrics({
          lengthFt: roomForMetrics.lengthFt ?? 0,
          widthFt: roomForMetrics.widthFt ?? 0,
          heightFt: roomForMetrics.heightFt ?? 0,
          doorCount: roomForMetrics.doorCount,
          windowCount: roomForMetrics.windowCount,
          openingCount: roomForMetrics.openingCount ?? 0,
          doorDeductionSqft: doorDeduct,
          windowDeductionSqft: windowDeduct,
        })
      : null;

  const closet = calculateClosetMetrics({
    widthFt: roomForMetrics.closetWidthFt ?? 4,
    depthFt: roomForMetrics.closetDepthFt ?? 2,
    heightFt: roomForMetrics.closetHeightFt ?? roomForMetrics.heightFt ?? 8,
    doorDeductionSqft: 15,
  });

  const wallMode =
    roomForMetrics.kind === "exterior" &&
    roomForMetrics.exteriorMode === "walls" &&
    (roomForMetrics.exteriorWalls?.length ?? 0) > 0;
  const houseMetrics = wallMode
    ? calculateExteriorHouseMetrics(roomForMetrics.exteriorWalls ?? [], {
        trimScope: roomForMetrics.exteriorTrimScope ?? "global",
        globalTrimLf: roomForMetrics.inputLinearFt ?? 0,
      })
    : null;
  const wallsMeta = exteriorWallsMetaFromRoom(roomForMetrics);

  return roomForMetrics.surfaces.map((s) => {
    const meta = parseMeta(s.dimensionsJson);
    const feature = s.featureKey ?? meta.featureKey;
    const groupKey = meta.exteriorSurfaceGroup;
    const isDerived =
      (!!feature && ROOM_DERIVED_FEATURES.has(feature)) || !!groupKey;
    const linked =
      (opts?.forceDerived && isDerived) ||
      (s.autoLinked ?? meta.autoLinked ?? true);
    if (!linked || (!feature && !groupKey)) return s;

    let patch: Partial<EditorSurface> = {};
    switch (feature) {
      case "walls_smooth":
      case "walls_textured":
        if (!metrics) return s;
        patch = {
          inputAreaSqft: metrics.wallNetSqft,
          measurementType: "area",
          dimensionsJson: JSON.stringify({
            ...meta,
            autoLinked: true,
            featureKey: feature,
            roomMetrics: metrics,
            showWork: metrics.showWork,
          }),
        };
        break;
      case "ceiling":
        if (!metrics) return s;
        patch = {
          inputAreaSqft: metrics.ceilingSqft,
          measurementType: "area",
          dimensionsJson: JSON.stringify({
            ...meta,
            autoLinked: true,
            featureKey: feature,
            showWork: [`Ceiling = ${metrics.ceilingSqft} sq ft`],
          }),
        };
        break;
      case "trim": {
        if (!metrics) return s;
        const base =
          roomForMetrics.trimBaseboardLf != null
            ? roomForMetrics.trimBaseboardLf
            : metrics.baseboardLf;
        const casing =
          roomForMetrics.trimWindowCasingLf != null
            ? roomForMetrics.trimWindowCasingLf
            : metrics.windowCasingLf;
        const trimTotal = Math.round((base + casing) * 100) / 100;
        patch = {
          quantity: trimTotal,
          measurementType: "unit",
          unitLabel: "lf",
          dimensionsJson: JSON.stringify({
            ...meta,
            autoLinked: true,
            featureKey: feature,
            baseboardLf: base,
            windowCasingLf: casing,
            baseboardAuto: roomForMetrics.trimBaseboardLf == null,
            casingAuto: roomForMetrics.trimWindowCasingLf == null,
            showWork: [
              `Trim & baseboards = baseboard ${base} LF + window casing ${casing} LF = ${trimTotal} LF`,
            ],
          }),
        };
        break;
      }
      case "crown": {
        if (!metrics) return s;
        const crown =
          roomForMetrics.crownLf != null
            ? roomForMetrics.crownLf
            : metrics.crownLf;
        patch = {
          quantity: crown,
          measurementType: "unit",
          unitLabel: "lf",
          dimensionsJson: JSON.stringify({
            ...meta,
            autoLinked: true,
            featureKey: feature,
            crownLf: crown,
            crownAuto: roomForMetrics.crownLf == null,
            showWork: [`Crown = ${crown} LF`],
          }),
        };
        break;
      }
      case "doors":
      case "exterior_doors":
        patch = {
          quantity: roomForMetrics.doorCount,
          measurementType: "unit",
          unitLabel: "door",
          dimensionsJson: JSON.stringify({
            ...meta,
            autoLinked: true,
            featureKey: feature,
            ...(feature === "exterior_doors" ? wallsMeta : {}),
          }),
        };
        break;
      case "windows":
      case "exterior_windows":
        patch = {
          quantity: roomForMetrics.windowCount,
          measurementType: "unit",
          unitLabel: "window",
          dimensionsJson: JSON.stringify({
            ...meta,
            autoLinked: true,
            featureKey: feature,
          }),
        };
        break;
      case "closet":
        patch = {
          inputAreaSqft: closet.wallNetSqft,
          measurementType: "area",
          dimensionsJson: JSON.stringify({
            ...meta,
            autoLinked: true,
            featureKey: feature,
            closet: {
              widthFt: roomForMetrics.closetWidthFt ?? 4,
              depthFt: roomForMetrics.closetDepthFt ?? 2,
              heightFt: roomForMetrics.closetHeightFt ?? 8,
            },
            showWork: closet.showWork,
          }),
        };
        break;
      case "closet_ceiling":
        patch = {
          inputAreaSqft: closet.ceilingSqft,
          measurementType: "area",
          dimensionsJson: JSON.stringify({
            ...meta,
            autoLinked: true,
            featureKey: feature,
            closet: {
              widthFt: roomForMetrics.closetWidthFt ?? 4,
              depthFt: roomForMetrics.closetDepthFt ?? 2,
              heightFt: roomForMetrics.closetHeightFt ?? 8,
            },
            showWork: [
              `Closet ceiling = ${roomForMetrics.closetWidthFt ?? 4} × ${roomForMetrics.closetDepthFt ?? 2} = ${closet.ceilingSqft} sq ft`,
            ],
          }),
        };
        break;
      case "closet_trim":
        patch = {
          quantity: closet.baseboardLf,
          unitLabel: "lf",
          measurementType: "unit",
          inputAreaSqft: null,
          dimensionsJson: JSON.stringify({
            ...meta,
            autoLinked: true,
            featureKey: feature,
            closet: {
              widthFt: roomForMetrics.closetWidthFt ?? 4,
              depthFt: roomForMetrics.closetDepthFt ?? 2,
              heightFt: roomForMetrics.closetHeightFt ?? 8,
            },
            showWork: [
              `Closet baseboards = perimeter 2 × (${roomForMetrics.closetWidthFt ?? 4} + ${roomForMetrics.closetDepthFt ?? 2}) = ${closet.baseboardLf} LF`,
            ],
          }),
        };
        break;
      case "exterior_siding":
      case "exterior_gable":
      case "exterior_accent":
      case "exterior_stucco": {
        const group =
          feature === "exterior_gable"
            ? "gable"
            : feature === "exterior_accent"
              ? "accent"
              : feature === "exterior_stucco"
                ? "stucco"
                : "body";
        // Quick area: body/siding OR stucco (from cladding) gets the room total.
        // Other groups only from wall-by-wall.
        const quickCladding = roomForMetrics.exteriorCladding ?? "siding";
        const isQuickBody =
          !houseMetrics &&
          ((group === "body" && quickCladding === "siding") ||
            (group === "stucco" && quickCladding === "stucco"));
        const area = houseMetrics
          ? (houseMetrics.bySurface.find((g) => g.key === group)?.netSqft ?? 0)
          : isQuickBody
            ? (roomForMetrics.inputAreaSqft ?? 0)
            : 0;
        const catalog = exteriorGroupCatalog(group);
        const label =
          houseMetrics?.bySurface.find((g) => g.key === group)?.label ??
          (group === "stucco"
            ? "Stucco"
            : group === "body"
              ? "Exterior Siding"
              : catalog.label);
        patch = {
          inputAreaSqft: area,
          measurementType: "area",
          description: `${roomForMetrics.name} — ${label}`,
          surfaceType: catalog.surfaceType,
          dimensionsJson: mergeExteriorWallsIntoDimensionsJson(
            s.dimensionsJson,
            wallsMeta,
            {
              autoLinked: true,
              featureKey: feature,
              exteriorSurfaceGroup: group,
              showWork: houseMetrics?.showWork,
            }
          ),
        };
        break;
      }
      case "exterior_trim":
        patch = {
          quantity: roomForMetrics.inputLinearFt ?? 0,
          measurementType: "unit",
          unitLabel: "lf",
          dimensionsJson: mergeExteriorWallsIntoDimensionsJson(
            s.dimensionsJson,
            wallsMeta,
            {
              autoLinked: true,
              featureKey: feature,
              showWork: houseMetrics
                ? [`Exterior trim = ${roomForMetrics.inputLinearFt ?? 0} LF`]
                : undefined,
            }
          ),
        };
        break;
      default: {
        if (groupKey && houseMetrics) {
          const area =
            houseMetrics.bySurface.find((g) => g.key === groupKey)?.netSqft ?? 0;
          const label =
            houseMetrics.bySurface.find((g) => g.key === groupKey)?.label ??
            "Siding";
          return {
            ...s,
            inputAreaSqft: area,
            measurementType: "area",
            description: `${roomForMetrics.name} — ${label}`,
            autoLinked: true,
            dimensionsJson: mergeExteriorWallsIntoDimensionsJson(
              s.dimensionsJson,
              wallsMeta,
              {
                autoLinked: true,
                exteriorSurfaceGroup: groupKey,
                showWork: houseMetrics.showWork,
              }
            ),
          };
        }
        return s;
      }
    }
    return {
      ...s,
      ...patch,
      autoLinked: true,
    };
  });
}

/** Ensure siding group surfaces exist for wall-by-wall materials. */
function reconcileExteriorWallSurfaces(
  room: EditorRoom,
  products: Product[],
  rates: Rate[],
  doorDeduct: number,
  windowDeduct: number,
  defaultsMap: SurfaceProductDefaultsMap = {}
): EditorRoom {
  let next = withExteriorWallTotals(room);
  if (next.kind !== "exterior" || next.exteriorMode !== "walls") {
    // Collapse wall-group lines to one linked body surface (siding or stucco)
    if (next.kind === "exterior") {
      const wallsMeta = exteriorWallsMetaFromRoom(next);
      const cladding = next.exteriorCladding ?? "siding";
      const groupKey = cladding === "stucco" ? "stucco" : "body";
      const catalog = exteriorGroupCatalog(groupKey);
      const featureKey =
        exteriorGroupFeatureKey(groupKey) ?? "exterior_siding";
      const nonSiding = next.surfaces.filter((s) => {
        const meta = parseMeta(s.dimensionsJson);
        const fk = s.featureKey ?? meta.featureKey;
        if (
          fk === "exterior_siding" ||
          fk === "exterior_gable" ||
          fk === "exterior_accent" ||
          fk === "exterior_stucco" ||
          meta.exteriorSurfaceGroup
        ) {
          return false;
        }
        return true;
      });
      const existingBody = next.surfaces.find((s) => {
        const meta = parseMeta(s.dimensionsJson);
        const fk = s.featureKey ?? meta.featureKey;
        return fk === featureKey || meta.exteriorSurfaceGroup === groupKey;
      });
      const rate = findRate(rates, catalog.surfaceType, "Brush/Roll");
      const { product, sheen: defaultSheen } = resolveDefaultPaint({
        surfaceType: catalog.surfaceType,
        products,
        defaultsMap,
      });
      const sameCatalog =
        existingBody?.surfaceType === catalog.surfaceType;
      const body: EditorSurface = {
        _key: existingBody?._key ?? newKey(),
        featureKey,
        description: `${next.name} — ${catalog.label}`,
        surfaceType: catalog.surfaceType,
        measurementType: "area",
        inputAreaSqft: next.inputAreaSqft ?? 0,
        quantity: null,
        unitLabel: null,
        dimensionsJson: mergeExteriorWallsIntoDimensionsJson(
          existingBody?.dimensionsJson,
          wallsMeta,
          {
            autoLinked: true,
            featureKey,
            exteriorSurfaceGroup: groupKey,
          }
        ),
        coats: existingBody?.coats ?? rate?.defaultCoats ?? 2,
        method: existingBody?.method ?? rate?.method ?? "Brush/Roll",
        paintProductId: sameCatalog
          ? (existingBody?.paintProductId ?? product?.id ?? null)
          : (product?.id ?? null),
        sheen: sameCatalog
          ? (existingBody?.sheen ?? defaultSheen)
          : defaultSheen,
        colorName: existingBody?.colorName ?? null,
        colorHex: existingBody?.colorHex ?? null,
        productionRateId: sameCatalog
          ? (existingBody?.productionRateId ?? rate?.id ?? null)
          : (rate?.id ?? null),
        productionRateOverride: existingBody?.productionRateOverride ?? null,
        sortOrder: 0,
        autoLinked: true,
      };
      next = { ...next, surfaces: [body, ...nonSiding] };
    }
    return {
      ...next,
      surfaces: applyRoomMetricsToSurfaces(next, doorDeduct, windowDeduct, {
        forceDerived: true,
      }),
    };
  }

  const house = calculateExteriorHouseMetrics(next.exteriorWalls ?? [], {
    trimScope: next.exteriorTrimScope ?? "global",
    globalTrimLf: next.inputLinearFt ?? 0,
  });
  const wallsMeta = exteriorWallsMetaFromRoom(next);

  const keep = next.surfaces.filter((s) => {
    const meta = parseMeta(s.dimensionsJson);
    const fk = s.featureKey ?? meta.featureKey;
    if (fk === "exterior_trim" || fk === "exterior_doors" || fk === "exterior_windows") {
      return true;
    }
    if (
      fk === "exterior_siding" ||
      fk === "exterior_gable" ||
      fk === "exterior_accent" ||
      fk === "exterior_stucco" ||
      meta.exteriorSurfaceGroup
    ) {
      // Drop wall-derived siding; recreated below from current groups
      return !(s.autoLinked ?? meta.autoLinked ?? true);
    }
    return true;
  });

  const sidingSurfaces: EditorSurface[] = house.bySurface.map((g, i) => {
    const fk = exteriorGroupFeatureKey(g.key);
    const catalog = exteriorGroupCatalog(g.key);
    const existing = next.surfaces.find((s) => {
      const meta = parseMeta(s.dimensionsJson);
      return (
        (fk && (s.featureKey ?? meta.featureKey) === fk) ||
        meta.exteriorSurfaceGroup === g.key
      );
    });
    const rate = findRate(rates, catalog.surfaceType, "Brush/Roll");
    const { product, sheen: defaultSheen } = resolveDefaultPaint({
      surfaceType: catalog.surfaceType,
      products,
      defaultsMap,
    });
    const sameCatalog = existing?.surfaceType === catalog.surfaceType;
    return {
      _key: existing?._key ?? newKey(),
      featureKey: fk,
      description: `${next.name} — ${g.label}`,
      surfaceType: catalog.surfaceType,
      measurementType: "area",
      inputAreaSqft: g.netSqft,
      quantity: null,
      unitLabel: null,
      dimensionsJson: mergeExteriorWallsIntoDimensionsJson(
        existing?.dimensionsJson,
        wallsMeta,
        {
          autoLinked: true,
          featureKey: fk,
          exteriorSurfaceGroup: g.key,
          showWork: house.showWork,
        }
      ),
      coats: existing?.coats ?? rate?.defaultCoats ?? 2,
      method: existing?.method ?? rate?.method ?? "Brush/Roll",
      paintProductId: sameCatalog
        ? (existing?.paintProductId ?? product?.id ?? null)
        : (product?.id ?? null),
      sheen: sameCatalog
        ? (existing?.sheen ?? defaultSheen)
        : defaultSheen,
      colorName: existing?.colorName ?? null,
      colorHex: existing?.colorHex ?? null,
      productionRateId: sameCatalog
        ? (existing?.productionRateId ?? rate?.id ?? null)
        : (rate?.id ?? null),
      productionRateOverride: existing?.productionRateOverride ?? null,
      sortOrder: i,
      autoLinked: true,
    };
  });

  // Ensure trim / doors / windows exist
  let surfaces = [...sidingSurfaces, ...keep];
  const present = new Set(
    surfaces.map((s) => s.featureKey ?? parseMeta(s.dimensionsJson).featureKey)
  );
  for (const key of [
    "exterior_trim",
    "exterior_doors",
    "exterior_windows",
  ] as RoomSurfaceKey[]) {
    if (!present.has(key)) {
      const draftRoom = { ...next, surfaces };
      const added = addFeatureToRoom(
        draftRoom,
        key,
        products,
        rates,
        doorDeduct,
        windowDeduct,
        defaultsMap
      );
      surfaces = added.surfaces;
    }
  }

  next = { ...next, surfaces };
  return {
    ...next,
    surfaces: applyRoomMetricsToSurfaces(next, doorDeduct, windowDeduct, {
      forceDerived: true,
    }),
  };
}

export function RoomEditorModal({
  open,
  onOpenChange,
  initialRoom,
  kind,
  preset,
  products,
  rates,
  doorDeductionSqft,
  windowDeductionSqft,
  wasteFactorPct,
  materialMarkupPct,
  laborRate,
  prepPct,
  defaultCoverageSqftPerGallon = 375,
  projectColors = [],
  onProjectColorsChange = () => {},
  surfaceProductDefaults = {},
  existingRoomNames = [],
  excludeRoomIndex = null,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRoom?: EditorRoom | null;
  kind: "interior" | "exterior";
  preset?: RoomTypePreset | null;
  products: Product[];
  rates: Rate[];
  doorDeductionSqft: number;
  windowDeductionSqft: number;
  wasteFactorPct: number;
  materialMarkupPct: number;
  laborRate: number;
  prepPct: number;
  /** Company standard spread rating when a surface has no product */
  defaultCoverageSqftPerGallon?: number;
  projectColors?: ProjectColor[];
  onProjectColorsChange?: (colors: ProjectColor[]) => void;
  /** Company defaults: surface type → product + sheen */
  surfaceProductDefaults?: SurfaceProductDefaultsMap;
  /** Names of rooms already on the estimate (for duplicate naming) */
  existingRoomNames?: string[];
  /** When editing, index of the room being edited (excluded from name conflicts) */
  excludeRoomIndex?: number | null;
  onSave: (room: EditorRoom) => void;
}) {
  const [draft, setDraft] = useState<EditorRoom>(blankInteriorRoom);
  const [baseline, setBaseline] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [closetDialogOpen, setClosetDialogOpen] = useState(false);
  const [quickAssignOpen, setQuickAssignOpen] = useState(false);
  const [surfaceEditKey, setSurfaceEditKey] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [productListOpen, setProductListOpen] = useState(false);
  const [closetForm, setClosetForm] = useState({
    widthFt: 4,
    depthFt: 2,
    heightFt: 8,
    includeCeiling: true,
    includeBaseboards: true,
  });

  // Initialize draft only when the modal opens (not on every parent re-render)
  useEffect(() => {
    if (!open) return;
    let room: EditorRoom;
    if (initialRoom) {
      room = structuredClone(initialRoom);
    } else if (preset) {
      room = roomFromPreset(
        preset,
        products,
        rates,
        doorDeductionSqft,
        windowDeductionSqft,
        surfaceProductDefaults
      );
    } else {
      room =
        kind === "interior" ? blankInteriorRoom() : blankExteriorRoom();
      if (kind === "interior") {
        for (const key of ["walls_smooth", "ceiling", "trim"] as const) {
          room = addFeatureToRoom(
            room,
            key,
            products,
            rates,
            doorDeductionSqft,
            windowDeductionSqft,
            surfaceProductDefaults
          );
        }
      }
    }
    // Restore wall-by-wall meta from surface JSON when editing a saved room
    if (room.kind === "exterior") {
      const fromSurfaces = findExteriorWallsMetaInSurfaces(room.surfaces);
      if (fromSurfaces) {
        room = {
          ...room,
          exteriorMode: fromSurfaces.exteriorMode,
          exteriorTrimScope: fromSurfaces.trimScope,
          exteriorWalls: fromSurfaces.walls,
          exteriorCladding: fromSurfaces.cladding ?? "siding",
        };
      }
      // Always reconcile exterior: fixes stray Gable/Accent lines in quick area
      room = reconcileExteriorWallSurfaces(
        room,
        products,
        rates,
        doorDeductionSqft,
        windowDeductionSqft,
        surfaceProductDefaults
      );
    } else {
      room = {
        ...room,
        surfaces: applyRoomMetricsToSurfaces(
          room,
          doorDeductionSqft,
          windowDeductionSqft
        ),
      };
    }
    // New rooms: auto-suffix duplicates (Bedroom → Bedroom 2)
    if (!initialRoom) {
      room = {
        ...room,
        name: uniqueRoomName(room.name, existingRoomNames, excludeRoomIndex),
      };
    }
    setDraft(room);
    setBaseline(snapshot(room));
    setSelectedKey(room.surfaces[0]?._key ?? null);
    setSurfaceEditKey(null);
    setProductQuery("");
    setProductListOpen(false);
    setConfirmOpen(false);
    setQuickAssignOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init on open only
  }, [open]);

  const dirty = snapshot(draft) !== baseline;

  const metrics = useMemo(() => {
    if (draft.kind !== "interior") return null;
    return calculateInteriorRoomMetrics({
      lengthFt: draft.lengthFt ?? 0,
      widthFt: draft.widthFt ?? 0,
      heightFt: draft.heightFt ?? 0,
      doorCount: draft.doorCount,
      windowCount: draft.windowCount,
      openingCount: draft.openingCount ?? 0,
      doorDeductionSqft,
      windowDeductionSqft,
    });
  }, [draft, doorDeductionSqft, windowDeductionSqft]);

  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products]
  );
  const rateMap = useMemo(
    () => Object.fromEntries(rates.map((r) => [r.id, r])),
    [rates]
  );

  const surfaceCalcs = useMemo(() => {
    const cond = conditionMultiplier(draft.condition);
    const roomPrep = draft.prepPct ?? prepPct;
    return draft.surfaces.map((li) => {
      const product = li.paintProductId ? productMap[li.paintProductId] : null;
      const rate = li.productionRateId ? rateMap[li.productionRateId] : null;
      const calc = calculateLineItem({
        measurementType: (li.measurementType as "area" | "unit") || "area",
        inputAreaSqft: li.inputAreaSqft,
        quantity: li.quantity,
        unitLabel: li.unitLabel,
        surfaceType: li.surfaceType,
        coats: li.coats,
        coverageSqftPerGallon:
          product?.coverageSqftPerGallon ?? defaultCoverageSqftPerGallon,
        pricePerGallon: product?.pricePerGallon,
        productionRatePerManHour:
          li.productionRateOverride ?? rate?.ratePerManHour ?? null,
        firstCoatRate: rate?.firstCoatRate,
        additionalCoatRate: rate?.additionalCoatRate,
        effective2CoatRate: rate?.effective2CoatRate,
        wasteFactorPct,
        materialMarkupPct,
        laborRate,
        conditionMultiplier: cond,
        prepPct: roomPrep,
        surfaceLabel: li.description,
      });
      return { li, calc };
    });
  }, [
    draft,
    productMap,
    rateMap,
    wasteFactorPct,
    materialMarkupPct,
    laborRate,
    prepPct,
    defaultCoverageSqftPerGallon,
  ]);

  const roomTotal = useMemo(() => {
    const continuous = surfaceCalcs.reduce((s, x) => s + x.calc.lineTotal, 0);
    const packaging = calculatePaintPackaging(
      surfaceCalcs.map(({ li, calc }) => {
        const product = li.paintProductId
          ? productMap[li.paintProductId]
          : null;
        return {
          roomKey: draft._key,
          roomName: draft.name,
          surfaceKey: li._key,
          description: li.description,
          paintProductId: li.paintProductId,
          productName: product?.name ?? "Paint",
          pricePerGallon: product?.pricePerGallon ?? 0,
          sheen: li.sheen,
          colorName: li.colorName,
          colorHex: li.colorHex,
          rawGallons: calc.gallons,
          materialMarkupPct,
        };
      })
    );
    const delta =
      roomPurchaseMaterialDeltaByKey(packaging).get(draft._key) ?? 0;
    return roundMoney(continuous + delta);
  }, [
    surfaceCalcs,
    productMap,
    draft._key,
    draft.name,
    materialMarkupPct,
  ]);

  const featureCatalog =
    draft.kind === "interior" ? INTERIOR_FEATURES : EXTERIOR_FEATURES;
  const presentKeys = new Set(
    draft.surfaces
      .map((s) => s.featureKey ?? parseMeta(s.dimensionsJson).featureKey)
      .filter(Boolean)
  );

  function patchRoom(patch: Partial<EditorRoom>) {
    setDraft((prev) => {
      let next = { ...prev, ...patch };
      if (patch.name != null && patch.name !== prev.name) {
        const oldPrefix = `${prev.name} — `;
        const newPrefix = `${patch.name} — `;
        next = {
          ...next,
          surfaces: next.surfaces.map((s) => ({
            ...s,
            description: s.description.startsWith(oldPrefix)
              ? newPrefix + s.description.slice(oldPrefix.length)
              : s.description,
          })),
        };
      }
      const wallChanged = [
        "exteriorMode",
        "exteriorTrimScope",
        "exteriorWalls",
        "exteriorCladding",
      ].some((k) => k in patch);
      const dimChanged =
        wallChanged ||
        [
          "lengthFt",
          "widthFt",
          "heightFt",
          "doorCount",
          "windowCount",
          "openingCount",
          "inputAreaSqft",
          "inputLinearFt",
          "closetWidthFt",
          "closetDepthFt",
          "closetHeightFt",
          "trimBaseboardLf",
          "trimWindowCasingLf",
          "crownLf",
        ].some((k) => k in patch);

      if (wallChanged || next.exteriorMode === "walls") {
        if (
          patch.exteriorMode === "walls" &&
          (!next.exteriorWalls || next.exteriorWalls.length === 0)
        ) {
          next = {
            ...next,
            exteriorWalls: defaultWholeHouseWalls(),
            exteriorTrimScope: next.exteriorTrimScope ?? "global",
          };
        }
        return reconcileExteriorWallSurfaces(
          next,
          products,
          rates,
          doorDeductionSqft,
          windowDeductionSqft,
          surfaceProductDefaults
        );
      }

      return {
        ...next,
        surfaces: applyRoomMetricsToSurfaces(
          next,
          doorDeductionSqft,
          windowDeductionSqft,
          { forceDerived: dimChanged }
        ),
      };
    });
  }

  function patchSurface(idx: number, patch: Partial<EditorSurface>) {
    setDraft((prev) => {
      const surfaces = [...prev.surfaces];
      const cur = { ...surfaces[idx], ...patch };
      // Manual measure edit breaks auto-link
      if (
        (patch.inputAreaSqft != null || patch.quantity != null) &&
        patch.autoLinked !== true
      ) {
        const meta = parseMeta(cur.dimensionsJson);
        cur.autoLinked = false;
        cur.dimensionsJson = JSON.stringify({
          ...meta,
          autoLinked: false,
          featureKey: cur.featureKey ?? meta.featureKey,
        });
      }
      if (patch.autoLinked === true) {
        cur.autoLinked = true;
        const meta = parseMeta(cur.dimensionsJson);
        cur.dimensionsJson = JSON.stringify({
          ...meta,
          autoLinked: true,
          featureKey: cur.featureKey ?? meta.featureKey,
        });
      }
      if (patch.surfaceType || patch.method) {
        const match = findRate(
          rates,
          cur.surfaceType,
          patch.method ?? cur.method
        );
        if (match) {
          cur.productionRateId = match.id;
          cur.measurementType = match.measurementType;
          if (patch.surfaceType) {
            cur.coats = match.defaultCoats;
            cur.method = match.method;
          }
        }
      }
      surfaces[idx] = cur;
      const next = { ...prev, surfaces };
      if (patch.autoLinked === true) {
        return {
          ...next,
          surfaces: applyRoomMetricsToSurfaces(
            next,
            doorDeductionSqft,
            windowDeductionSqft
          ),
        };
      }
      return next;
    });
  }

  function featureKeyOf(s: EditorSurface): RoomSurfaceKey | undefined {
    return (
      s.featureKey ?? parseMeta(s.dimensionsJson).featureKey ?? undefined
    );
  }

  function isClosetSurface(s: EditorSurface) {
    const k = featureKeyOf(s);
    return k === "closet" || k === "closet_ceiling" || k === "closet_trim";
  }

  function removeSurfacesByKeys(keys: Set<RoomSurfaceKey>) {
    const removedSelected = draft.surfaces.some((s) => {
      const k = featureKeyOf(s);
      return s._key === selectedKey && k != null && keys.has(k);
    });
    const surfaces = draft.surfaces.filter((s) => {
      const k = featureKeyOf(s);
      return !k || !keys.has(k);
    });
    setDraft({ ...draft, surfaces });
    if (removedSelected) {
      setSelectedKey(surfaces[0]?._key ?? null);
    }
  }

  function toggleFeature(key: RoomSurfaceKey) {
    if (key === "closet") {
      const closetSurfaces = draft.surfaces.filter(isClosetSurface);
      if (closetSurfaces.length > 0) {
        removeSurfacesByKeys(
          new Set(["closet", "closet_ceiling", "closet_trim"])
        );
        return;
      }
      setClosetForm({
        widthFt: draft.closetWidthFt ?? 4,
        depthFt: draft.closetDepthFt ?? 2,
        heightFt: draft.closetHeightFt ?? draft.heightFt ?? 8,
        includeCeiling: true,
        includeBaseboards: true,
      });
      setClosetDialogOpen(true);
      return;
    }

    const matching = draft.surfaces.filter((s) => featureKeyOf(s) === key);
    if (matching.length > 0) {
      removeSurfacesByKeys(new Set([key]));
      return;
    }
    const next = addFeatureToRoom(
      draft,
      key,
      products,
      rates,
      doorDeductionSqft,
      windowDeductionSqft,
      surfaceProductDefaults
    );
    setDraft(next);
    setSelectedKey(next.surfaces[next.surfaces.length - 1]?._key ?? null);
  }

  function confirmCloset() {
    let next: EditorRoom = {
      ...draft,
      closetWidthFt: closetForm.widthFt,
      closetDepthFt: closetForm.depthFt,
      closetHeightFt: closetForm.heightFt,
    };
    // Replace any existing closet surfaces
    next = {
      ...next,
      surfaces: next.surfaces.filter((s) => !isClosetSurface(s)),
    };
    next = addFeatureToRoom(
      next,
      "closet",
      products,
      rates,
      doorDeductionSqft,
      windowDeductionSqft,
      surfaceProductDefaults
    );
    if (closetForm.includeCeiling) {
      next = addFeatureToRoom(
        next,
        "closet_ceiling",
        products,
        rates,
        doorDeductionSqft,
        windowDeductionSqft,
        surfaceProductDefaults
      );
    }
    if (closetForm.includeBaseboards) {
      next = addFeatureToRoom(
        next,
        "closet_trim",
        products,
        rates,
        doorDeductionSqft,
        windowDeductionSqft,
        surfaceProductDefaults
      );
    }
    setDraft(next);
    const closetWall = next.surfaces.find((s) => featureKeyOf(s) === "closet");
    setSelectedKey(closetWall?._key ?? null);
    setClosetDialogOpen(false);
  }

  function setClosetCeilingEnabled(enabled: boolean) {
    if (enabled) {
      if (presentKeys.has("closet_ceiling")) return;
      const next = addFeatureToRoom(
        draft,
        "closet_ceiling",
        products,
        rates,
        doorDeductionSqft,
        windowDeductionSqft,
        surfaceProductDefaults
      );
      setDraft(next);
      return;
    }
    removeSurfacesByKeys(new Set(["closet_ceiling"]));
  }

  function setClosetBaseboardsEnabled(enabled: boolean) {
    if (enabled) {
      if (presentKeys.has("closet_trim")) return;
      const next = addFeatureToRoom(
        draft,
        "closet_trim",
        products,
        rates,
        doorDeductionSqft,
        windowDeductionSqft,
        surfaceProductDefaults
      );
      setDraft(next);
      return;
    }
    removeSurfacesByKeys(new Set(["closet_trim"]));
  }

  function removeSurface(idx: number) {
    const removed = draft.surfaces[idx];
    const surfaces = draft.surfaces.filter((_, i) => i !== idx);
    setDraft({ ...draft, surfaces });
    if (removed && selectedKey === removed._key) {
      setSelectedKey(surfaces[Math.max(0, idx - 1)]?._key ?? null);
    }
  }

  function surfaceIndexForFeature(key: RoomSurfaceKey) {
    return draft.surfaces.findIndex((s) => featureKeyOf(s) === key);
  }

  function saveAndClose() {
    onSave({
      ...draft,
      surfaces: applyRoomMetricsToSurfaces(
        draft,
        doorDeductionSqft,
        windowDeductionSqft
      ),
    });
    setBaseline(snapshot(draft));
    setConfirmOpen(false);
    onOpenChange(false);
  }

  function discardAndClose() {
    setConfirmOpen(false);
    onOpenChange(false);
  }

  function requestClose() {
    if (dirty) {
      setConfirmOpen(true);
      return;
    }
    onOpenChange(false);
  }

  const hasCloset = draft.surfaces.some(isClosetSurface);
  const hasClosetCeiling = presentKeys.has("closet_ceiling");
  const hasClosetTrim = presentKeys.has("closet_trim");
  const hasTrim = presentKeys.has("trim");
  const hasCrown = presentKeys.has("crown");
  const effectiveBaseboard =
    draft.trimBaseboardLf != null
      ? draft.trimBaseboardLf
      : (metrics?.baseboardLf ?? 0);
  const effectiveCasing =
    draft.trimWindowCasingLf != null
      ? draft.trimWindowCasingLf
      : (metrics?.windowCasingLf ?? 0);
  const effectiveCrown =
    draft.crownLf != null ? draft.crownLf : (metrics?.crownLf ?? 0);
  const effectiveTrimTotal =
    Math.round((effectiveBaseboard + effectiveCasing) * 100) / 100;
  const linkedCount = draft.surfaces.filter((s) => {
    const meta = parseMeta(s.dimensionsJson);
    return s.autoLinked ?? meta.autoLinked ?? false;
  }).length;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex h-[min(94vh,920px)] w-[min(1280px,calc(100vw-200px-1.5rem))] max-w-none flex-col gap-0 overflow-hidden p-0 left-[calc(50%+100px)] sm:max-w-none"
        >
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Header + dimensions — compact single band */}
          <div className="shrink-0 border-b bg-background">
            <DialogHeader className="sr-only">
              <DialogTitle>
                {initialRoom ? "Edit room" : "Add room"}
              </DialogTitle>
              <DialogDescription>
                Set room size and manage linked surfaces.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-4 py-2">
              <span className="shrink-0 text-[13px] font-semibold tracking-tight">
                {initialRoom ? "Edit room" : "Add room"}
              </span>
              <Input
                value={draft.name}
                onChange={(e) => patchRoom({ name: e.target.value })}
                className="h-7 w-[160px] border-slate-200 text-[13px] font-medium"
                placeholder="Room name"
                aria-label="Room name"
              />
              <select
                className="flex h-7 shrink-0 rounded-md border border-slate-200 bg-background px-2 text-[12px]"
                value={draft.condition}
                onChange={(e) => patchRoom({ condition: e.target.value })}
                aria-label="Condition"
              >
                <option value="easy">Easy (×0.9)</option>
                <option value="medium">Medium (×1.0)</option>
                <option value="hard">Hard (×1.25)</option>
              </select>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="text-right leading-none">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Total
                  </div>
                  <div className="text-[16px] font-semibold tabular-nums tracking-tight">
                    {formatCurrency(roomTotal)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={requestClose}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-0 border-t bg-slate-50/90">
              {draft.kind === "interior" ? (
                <>
                  {/* Row 1: room size + openings + live metrics */}
                  <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5 px-4 py-1.5">
                    <DimField
                      label="L"
                      unit="ft"
                      size="sm"
                      value={draft.lengthFt ?? 0}
                      onChange={(n) => patchRoom({ lengthFt: n })}
                    />
                    <span className="mb-1.5 text-sm text-slate-300">×</span>
                    <DimField
                      label="W"
                      unit="ft"
                      size="sm"
                      value={draft.widthFt ?? 0}
                      onChange={(n) => patchRoom({ widthFt: n })}
                    />
                    <span className="mb-1.5 text-sm text-slate-300">×</span>
                    <DimField
                      label="H"
                      unit="ft"
                      size="sm"
                      value={draft.heightFt ?? 0}
                      onChange={(n) => patchRoom({ heightFt: n })}
                    />
                    <div className="mx-0.5 mb-1 hidden h-7 w-px bg-slate-200 sm:block" />
                    <DimField
                      label="Doors"
                      unit="count"
                      size="sm"
                      step={1}
                      value={draft.doorCount}
                      onChange={(n) =>
                        patchRoom({ doorCount: Math.max(0, Math.round(n)) })
                      }
                    />
                    <DimField
                      label="Windows"
                      unit="count"
                      size="sm"
                      step={1}
                      value={draft.windowCount}
                      onChange={(n) =>
                        patchRoom({
                          windowCount: Math.max(0, Math.round(n)),
                        })
                      }
                    />
                    <DimField
                      label="Openings"
                      unit="count"
                      size="sm"
                      step={1}
                      value={draft.openingCount ?? 0}
                      onChange={(n) =>
                        patchRoom({
                          openingCount: Math.max(0, Math.round(n)),
                        })
                      }
                    />
                    {metrics && (
                      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 pb-1 text-[11px] tabular-nums text-slate-600">
                        <span className="whitespace-nowrap">
                          <span className="text-slate-400">Walls </span>
                          <span className="font-semibold text-slate-800">
                            {formatNumber(metrics.wallNetSqft, 0)} sf
                          </span>
                        </span>
                        <span className="whitespace-nowrap">
                          <span className="text-slate-400">Ceiling </span>
                          <span className="font-semibold text-slate-800">
                            {formatNumber(metrics.ceilingSqft, 0)} sf
                          </span>
                        </span>
                        <span className="whitespace-nowrap">
                          <span className="text-slate-400">Trim </span>
                          <span className="font-semibold text-slate-800">
                            {formatNumber(effectiveTrimTotal, 0)} LF
                          </span>
                        </span>
                        {hasCrown && (
                          <span className="whitespace-nowrap">
                            <span className="text-slate-400">Crown </span>
                            <span className="font-semibold text-slate-800">
                              {formatNumber(effectiveCrown, 0)} LF
                            </span>
                          </span>
                        )}
                        {linkedCount > 0 && (
                          <span className="whitespace-nowrap rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                            {linkedCount} linked
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Row 2: trim/crown + closet side-by-side */}
                  {(hasTrim || hasCrown || hasCloset) && (
                    <div className="flex flex-wrap items-end gap-x-3 gap-y-1.5 border-t border-slate-200/80 px-4 py-1.5">
                      {(hasTrim || hasCrown) && (
                        <div className="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
                          <span className="mb-1.5 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Trim & baseboards
                          </span>
                          {hasTrim && (
                            <>
                              <DimField
                                label="Baseboard"
                                unit="LF"
                                size="sm"
                                value={effectiveBaseboard}
                                onChange={(n) =>
                                  patchRoom({ trimBaseboardLf: n })
                                }
                              />
                              <DimField
                                label="Window casing"
                                unit="LF"
                                size="sm"
                                value={effectiveCasing}
                                onChange={(n) =>
                                  patchRoom({ trimWindowCasingLf: n })
                                }
                              />
                              {(draft.trimBaseboardLf != null ||
                                draft.trimWindowCasingLf != null) && (
                                <button
                                  type="button"
                                  className="mb-1.5 whitespace-nowrap text-[11px] font-medium text-sky-700 hover:underline"
                                  onClick={() =>
                                    patchRoom({
                                      trimBaseboardLf: null,
                                      trimWindowCasingLf: null,
                                    })
                                  }
                                >
                                  Re-sync trim
                                </button>
                              )}
                            </>
                          )}
                          {hasCrown && (
                            <>
                              <DimField
                                label="Crown"
                                unit="LF"
                                size="sm"
                                value={effectiveCrown}
                                onChange={(n) => patchRoom({ crownLf: n })}
                              />
                              {draft.crownLf != null && (
                                <button
                                  type="button"
                                  className="mb-1.5 whitespace-nowrap text-[11px] font-medium text-sky-700 hover:underline"
                                  onClick={() => patchRoom({ crownLf: null })}
                                >
                                  Re-sync crown
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {hasCloset && (hasTrim || hasCrown) && (
                        <div className="mb-1 hidden h-7 w-px bg-slate-200 lg:block" />
                      )}

                      {hasCloset && (
                        <div className="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
                          <span className="mb-1.5 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Closet
                          </span>
                          <DimField
                            label="W"
                            unit="ft"
                            size="sm"
                            value={draft.closetWidthFt ?? 4}
                            onChange={(n) => patchRoom({ closetWidthFt: n })}
                          />
                          <span className="mb-1.5 text-sm text-slate-300">×</span>
                          <DimField
                            label="D"
                            unit="ft"
                            size="sm"
                            value={draft.closetDepthFt ?? 2}
                            onChange={(n) => patchRoom({ closetDepthFt: n })}
                          />
                          <span className="mb-1.5 text-sm text-slate-300">×</span>
                          <DimField
                            label="H"
                            unit="ft"
                            size="sm"
                            value={draft.closetHeightFt ?? 8}
                            onChange={(n) => patchRoom({ closetHeightFt: n })}
                          />
                          <label className="mb-1.5 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 select-none">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-sky-600"
                              checked={hasClosetCeiling}
                              onChange={(e) =>
                                setClosetCeilingEnabled(e.target.checked)
                              }
                            />
                            Ceiling
                          </label>
                          <label className="mb-1.5 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 select-none">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-sky-600"
                              checked={hasClosetTrim}
                              onChange={(e) =>
                                setClosetBaseboardsEnabled(e.target.checked)
                              }
                            />
                            Baseboards
                          </label>
                          <button
                            type="button"
                            className="mb-1.5 whitespace-nowrap text-[11px] font-medium text-sky-700 hover:underline"
                            onClick={() => {
                              setClosetForm({
                                widthFt: draft.closetWidthFt ?? 4,
                                depthFt: draft.closetDepthFt ?? 2,
                                heightFt: draft.closetHeightFt ?? 8,
                                includeCeiling: hasClosetCeiling,
                                includeBaseboards: hasClosetTrim,
                              });
                              setClosetDialogOpen(true);
                            }}
                          >
                            Edit size
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-0">
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 px-4 py-2">
                    <div className="min-w-[220px] flex-1 sm:max-w-[280px]">
                      <ExteriorModeToggle
                        mode={draft.exteriorMode ?? "simple"}
                        onChange={(mode) => patchRoom({ exteriorMode: mode })}
                      />
                    </div>
                    {(draft.exteriorMode ?? "simple") === "simple" && (
                      <div className="flex rounded-xl border border-slate-200 bg-white p-1">
                        {(
                          [
                            ["siding", "Siding"],
                            ["stucco", "Stucco"],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              patchRoom({ exteriorCladding: value })
                            }
                            className={cn(
                              "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                              (draft.exteriorCladding ?? "siding") === value
                                ? "bg-slate-800 text-white"
                                : "text-slate-600 hover:bg-slate-50"
                            )}
                            title={
                              value === "stucco"
                                ? "Exterior Stucco: product coverage × 0.8 (−20% spread → more gallons)"
                                : "Exterior Siding: full product coverage rating"
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="ml-auto flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] tabular-nums text-slate-600">
                      <span className="whitespace-nowrap">
                        <span className="text-slate-400">Siding </span>
                        <span className="font-semibold text-slate-800">
                          {(draft.inputAreaSqft ?? 0).toLocaleString()} sf
                        </span>
                      </span>
                      <span className="whitespace-nowrap">
                        <span className="text-slate-400">Trim </span>
                        <span className="font-semibold text-slate-800">
                          {(draft.inputLinearFt ?? 0).toLocaleString()} LF
                        </span>
                      </span>
                      <span className="whitespace-nowrap">
                        <span className="text-slate-400">Doors </span>
                        <span className="font-semibold text-slate-800">
                          {draft.doorCount}
                        </span>
                      </span>
                      <span className="whitespace-nowrap">
                        <span className="text-slate-400">Windows </span>
                        <span className="font-semibold text-slate-800">
                          {draft.windowCount}
                        </span>
                      </span>
                      {linkedCount > 0 && (
                        <span className="whitespace-nowrap rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                          {linkedCount} linked
                        </span>
                      )}
                    </div>
                  </div>

                  {(draft.exteriorMode ?? "simple") === "simple" ? (
                    <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5 px-4 py-1.5">
                      <DimField
                        label="Siding"
                        unit="sq ft"
                        size="sm"
                        value={draft.inputAreaSqft ?? 0}
                        onChange={(n) => patchRoom({ inputAreaSqft: n })}
                      />
                      <DimField
                        label="Trim"
                        unit="LF"
                        size="sm"
                        value={draft.inputLinearFt ?? 0}
                        onChange={(n) => patchRoom({ inputLinearFt: n })}
                      />
                      <div className="mx-0.5 mb-1 hidden h-7 w-px bg-slate-200 sm:block" />
                      <DimField
                        label="Doors"
                        unit="count"
                        size="sm"
                        step={1}
                        value={draft.doorCount}
                        onChange={(n) =>
                          patchRoom({
                            doorCount: Math.max(0, Math.round(n)),
                          })
                        }
                      />
                      <DimField
                        label="Windows"
                        unit="count"
                        size="sm"
                        step={1}
                        value={draft.windowCount}
                        onChange={(n) =>
                          patchRoom({
                            windowCount: Math.max(0, Math.round(n)),
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div className="max-h-[min(42vh,380px)] overflow-y-auto px-4 py-2.5">
                      <ExteriorWallsPanel
                        walls={draft.exteriorWalls ?? []}
                        trimScope={draft.exteriorTrimScope ?? "global"}
                        globalTrimLf={draft.inputLinearFt ?? 0}
                        onWallsChange={(exteriorWalls) =>
                          patchRoom({ exteriorWalls })
                        }
                        onTrimScopeChange={(exteriorTrimScope) =>
                          patchRoom({ exteriorTrimScope })
                        }
                        onGlobalTrimChange={(inputLinearFt) =>
                          patchRoom({ inputLinearFt })
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Body: left nav + surface detail */}
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col border-b bg-[#f4f7fa] lg:border-b-0 lg:border-r lg:border-slate-200">
              <div className="shrink-0 px-4 pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Surfaces & features
                  </h3>
                  <span className="text-[11px] tabular-nums text-slate-400">
                    {draft.surfaces.length}
                  </span>
                </div>
              </div>
              <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
                {featureCatalog.map((f) => {
                  const Icon = f.icon;
                  const on =
                    f.key === "closet"
                      ? hasCloset
                      : presentKeys.has(f.key);
                  const sIdx = surfaceIndexForFeature(f.key);
                  const rowKey =
                    sIdx >= 0 ? draft.surfaces[sIdx]._key : null;
                  const selectedFeature =
                    selectedKey != null
                      ? featureKeyOf(
                          draft.surfaces.find((s) => s._key === selectedKey) ??
                            draft.surfaces[0]
                        )
                      : null;
                  const active =
                    f.key === "closet"
                      ? selectedFeature === "closet" ||
                        selectedFeature === "closet_ceiling" ||
                        selectedFeature === "closet_trim"
                      : rowKey != null && selectedKey === rowKey;
                  const lineTotal =
                    f.key === "closet"
                      ? surfaceCalcs
                          .filter(({ li }) => isClosetSurface(li))
                          .reduce((sum, x) => sum + x.calc.lineTotal, 0)
                      : sIdx >= 0
                        ? surfaceCalcs[sIdx]?.calc.lineTotal
                        : null;
                  const hint =
                    f.key === "closet" && on
                      ? [
                          "Walls",
                          hasClosetCeiling ? "ceiling" : null,
                          hasClosetTrim ? "baseboards" : null,
                        ]
                          .filter(Boolean)
                          .join(" + ")
                      : f.hint;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => toggleFeature(f.key)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                        on
                          ? active
                            ? "bg-white text-slate-900 shadow-sm ring-1 ring-sky-200"
                            : "bg-white/80 text-slate-800 ring-1 ring-emerald-200/80 hover:bg-white"
                          : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
                      )}
                      title={
                        on
                          ? f.key === "closet"
                            ? "Remove closet"
                            : `Remove ${f.label}`
                          : f.key === "closet"
                            ? "Add closet — enter dimensions"
                            : `Add ${f.label}`
                      }
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          on
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200/70 text-slate-500"
                        )}
                      >
                        {on ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">
                          {f.label}
                        </span>
                        {on && hint !== f.hint && (
                          <span className="block truncate text-[11px] text-slate-400">
                            {hint}
                          </span>
                        )}
                      </span>
                      {on && lineTotal != null && lineTotal > 0 ? (
                        <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-600">
                          {formatCurrency(lineTotal)}
                        </span>
                      ) : !on ? (
                        <Plus className="h-3.5 w-3.5 shrink-0 opacity-40" />
                      ) : null}
                    </button>
                  );
                })}
              </nav>
            </aside>

            <div className="flex min-h-0 flex-col overflow-hidden bg-background">
              <div className="min-h-0 flex-1 overflow-auto p-5">
                {surfaceCalcs.length === 0 ? (
                  <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center text-[13px] text-muted-foreground">
                    Choose a surface from the left menu to add it to this room.
                  </div>
                ) : (
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[12px] text-muted-foreground">
                        Click a row to edit, or assign colors &amp; sheens for
                        all surfaces at once.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setQuickAssignOpen(true)}
                      >
                        <Palette className="mr-1.5 h-3.5 w-3.5" />
                        Quick assign
                      </Button>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                      <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                        <thead>
                          <tr className="border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <th className="px-3 py-2">Surface</th>
                            <th className="px-3 py-2 w-[100px]">Measure</th>
                            <th className="px-3 py-2 w-[56px]">Coats</th>
                            <th className="px-3 py-2 w-[110px]">Method</th>
                            <th className="px-3 py-2 min-w-[120px]">Product</th>
                            <th className="px-3 py-2 min-w-[140px]">Color</th>
                            <th className="px-3 py-2 w-[88px] text-right">
                              Total
                            </th>
                            <th className="px-3 py-2 w-[40px]" />
                          </tr>
                        </thead>
                        <tbody>
                          {surfaceCalcs.map(({ li, calc }) => {
                            const meta = parseMeta(li.dimensionsJson);
                            const linked =
                              li.autoLinked ?? meta.autoLinked ?? true;
                            const measureUnit =
                              li.measurementType === "unit"
                                ? li.unitLabel || "ea"
                                : "sf";
                            const measureValue =
                              li.measurementType === "unit"
                                ? (li.quantity ?? 0)
                                : (li.inputAreaSqft ?? 0);
                            const shortLabel = shortSurfaceLabel(
                              li.description,
                              draft.name
                            );
                            const active = li._key === selectedKey;
                            const productName =
                              productMap[li.paintProductId ?? ""]?.name ??
                              "None";
                            const projectColor = resolveProjectColor(
                              li.colorName,
                              projectColors
                            );
                            const hasColor = Boolean(li.colorName?.trim());
                            const colorLabel = formatProjectColorLabel(
                              projectColor
                            );
                            return (
                              <tr
                                key={li._key}
                                onClick={() => {
                                  setSelectedKey(li._key);
                                  setProductQuery("");
                                  setProductListOpen(false);
                                  setSurfaceEditKey(li._key);
                                }}
                                className={cn(
                                  "cursor-pointer border-b last:border-b-0 transition-colors",
                                  active
                                    ? "bg-sky-50/70"
                                    : "hover:bg-muted/30"
                                )}
                              >
                                <td className="px-3 py-2.5 align-middle">
                                  <div className="font-medium text-slate-900">
                                    {shortLabel}
                                  </div>
                                  {!linked && (
                                    <div className="text-[10px] font-medium text-amber-700">
                                      Measure override
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 align-middle tabular-nums text-slate-700">
                                  {formatNumber(measureValue, 0)}{" "}
                                  <span className="text-muted-foreground">
                                    {measureUnit}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 align-middle tabular-nums">
                                  {li.coats}
                                </td>
                                <td className="px-3 py-2.5 align-middle text-slate-600">
                                  {li.method || "—"}
                                </td>
                                <td className="px-3 py-2.5 align-middle text-slate-600">
                                  <span className="line-clamp-1">
                                    {productName}
                                  </span>
                                  {li.sheen ? (
                                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                      {li.sheen}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2.5 align-middle">
                                  {hasColor ? (
                                    <div
                                      className="min-w-0"
                                      title={
                                        [
                                          colorLabel,
                                          projectColor?.notes?.trim(),
                                        ]
                                          .filter(Boolean)
                                          .join(" · ") || undefined
                                      }
                                    >
                                      <div className="truncate text-[12px] font-semibold text-emerald-800">
                                        {colorLabel || "Color set"}
                                      </div>
                                      {projectColor?.notes?.trim() ? (
                                        <div className="truncate text-[11px] text-emerald-700/70">
                                          {projectColor.notes.trim()}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 border-amber-300 bg-amber-50 px-2 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setQuickAssignOpen(true);
                                      }}
                                    >
                                      <Palette className="mr-1 h-3 w-3" />
                                      Assign
                                    </Button>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 align-middle text-right font-semibold tabular-nums">
                                  {formatCurrency(calc.lineTotal)}
                                </td>
                                <td className="px-2 py-2.5 align-middle text-slate-400">
                                  <Pencil className="mx-auto h-3.5 w-3.5" />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          <QuickAssignPaintModal
            open={quickAssignOpen}
            roomName={draft.name}
            projectColors={projectColors}
            onProjectColorsChange={onProjectColorsChange}
            surfaces={draft.surfaces.map((s) => {
              const product = s.paintProductId
                ? productMap[s.paintProductId]
                : null;
              return {
                _key: s._key,
                label: shortSurfaceLabel(s.description, draft.name),
                surfaceType: s.surfaceType,
                featureKey: featureKeyOf(s),
                paintProductId: s.paintProductId,
                productName: product?.name ?? null,
                sheen: s.sheen,
                colorName: s.colorName,
                sheenOptions: sheenOptionsForProduct(product),
              };
            })}
            onClose={() => setQuickAssignOpen(false)}
            onApply={(updates) => {
              const byKey = new Map(updates.map((u) => [u._key, u]));
              setDraft((prev) => ({
                ...prev,
                surfaces: prev.surfaces.map((s) => {
                  const u = byKey.get(s._key);
                  if (!u) return s;
                  return {
                    ...s,
                    sheen: u.sheen,
                    colorName: u.colorName,
                    colorHex: null,
                  };
                }),
              }));
              setQuickAssignOpen(false);
            }}
          />

          {/* Footer */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-6 py-3.5">
            <div className="text-[13px] text-muted-foreground">
              {dirty ? (
                <span className="font-medium text-amber-700">
                  Unsaved changes
                </span>
              ) : (
                "No unsaved changes"
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="default" onClick={requestClose}>
                Close
              </Button>
              <Button size="default" onClick={saveAndClose}>
                <Save className="mr-1.5 h-4 w-4" />
                Save & close
              </Button>
            </div>
          </div>

          {surfaceEditKey && (() => {
            const idx = draft.surfaces.findIndex((s) => s._key === surfaceEditKey);
            const row = idx >= 0 ? surfaceCalcs[idx] : null;
            if (!row) return null;
            const { li, calc } = row;
            const meta = parseMeta(li.dimensionsJson);
            const linked = li.autoLinked ?? meta.autoLinked ?? true;
            const measureUnit =
              li.measurementType === "unit" ? li.unitLabel || "ea" : "sf";
            const shortLabel = shortSurfaceLabel(li.description, draft.name);
            const methods = Array.from(
              new Set(
                rates
                  .filter((r) => r.surfaceType === li.surfaceType)
                  .map((r) => r.method)
              )
            );
            const spread =
              productMap[li.paintProductId ?? ""]?.coverageSqftPerGallon ??
              defaultCoverageSqftPerGallon;
            return (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[2px]">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="surface-edit-title"
                  className="flex max-h-[min(88vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-background shadow-xl"
                >
                  <div className="shrink-0 border-b px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2
                          id="surface-edit-title"
                          className="text-lg font-semibold tracking-tight"
                        >
                          Edit surface
                        </h2>
                        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                          {shortLabel}
                          {li.surfaceType ? ` · ${li.surfaceType}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSurfaceEditKey(null)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
                    <div>
                      <Label className="text-[12px]">Name</Label>
                      <Input
                        className="mt-1 h-9"
                        value={shortLabel}
                        onChange={(e) =>
                          patchSurface(idx, {
                            description: fullSurfaceLabel(
                              e.target.value,
                              draft.name
                            ),
                          })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                      <div>
                        <Label className="text-[12px]">
                          Measure ({measureUnit})
                        </Label>
                        {li.measurementType === "unit" ? (
                          <NumberInput
                            min={0}
                            step={0.1}
                            className="mt-1 h-9"
                            value={li.quantity ?? 0}
                            onChange={(quantity) =>
                              patchSurface(idx, {
                                quantity,
                                autoLinked: false,
                              })
                            }
                          />
                        ) : (
                          <NumberInput
                            min={0}
                            step={0.1}
                            className="mt-1 h-9"
                            value={li.inputAreaSqft ?? 0}
                            onChange={(inputAreaSqft) =>
                              patchSurface(idx, {
                                inputAreaSqft,
                                autoLinked: false,
                              })
                            }
                          />
                        )}
                      </div>
                      <span className="mb-2 text-[13px] text-muted-foreground">
                        {measureUnit}
                      </span>
                    </div>

                    {linked ? (
                      <p className="text-[12px] text-sky-800">
                        Linked to room size — changing measure will unlock it.
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="text-[12px] font-medium text-sky-700 hover:underline"
                        onClick={() =>
                          patchSurface(idx, { autoLinked: true })
                        }
                      >
                        Re-link to room size
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[12px]">Coats</Label>
                        <select
                          className="mt-1 flex h-9 w-full rounded-md border bg-background px-2 text-[13px]"
                          value={li.coats}
                          onChange={(e) =>
                            patchSurface(idx, {
                              coats: parseInt(e.target.value) || 1,
                            })
                          }
                        >
                          {[1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-[12px]">Method</Label>
                        <select
                          className="mt-1 flex h-9 w-full rounded-md border bg-background px-2 text-[13px]"
                          value={li.method ?? ""}
                          onChange={(e) =>
                            patchSurface(idx, { method: e.target.value })
                          }
                        >
                          {methods.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                          {!li.method && <option value="">Select…</option>}
                          {li.method && !methods.includes(li.method) && (
                            <option value={li.method}>{li.method}</option>
                          )}
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[12px]">Product</Label>
                      <Input
                        className="mt-1 h-9"
                        placeholder={
                          li.paintProductId
                            ? productMap[li.paintProductId]?.name ??
                              "Search products…"
                            : "Search products…"
                        }
                        value={productQuery}
                        onChange={(e) => {
                          setProductQuery(e.target.value);
                          setProductListOpen(true);
                        }}
                        onFocus={() => {
                          setProductListOpen(true);
                        }}
                        onBlur={() => {
                          // Allow list mousedown to fire before closing
                          window.setTimeout(
                            () => setProductListOpen(false),
                            180
                          );
                        }}
                      />
                      {productListOpen && (
                        <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              patchSurface(idx, {
                                paintProductId: null,
                                sheen: null,
                              });
                              setProductQuery("");
                              setProductListOpen(false);
                            }}
                            className={cn(
                              "flex w-full px-3 py-2 text-left text-[13px] hover:bg-slate-50",
                              !li.paintProductId &&
                                "bg-sky-50 font-medium text-sky-900"
                            )}
                          >
                            None
                          </button>
                          {products
                            .filter((p) => {
                              const q = productQuery.trim().toLowerCase();
                              if (!q) return true;
                              return (
                                p.name.toLowerCase().includes(q) ||
                                (p.brand ?? "").toLowerCase().includes(q)
                              );
                            })
                            .map((p) => {
                              const selected = li.paintProductId === p.id;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    const options = sheenOptionsForProduct(p);
                                    patchSurface(idx, {
                                      paintProductId: p.id,
                                      sheen:
                                        options.includes(li.sheen ?? "")
                                          ? li.sheen
                                          : (options[0] ?? p.sheen ?? null),
                                    });
                                    setProductQuery("");
                                    setProductListOpen(false);
                                  }}
                                  className={cn(
                                    "flex w-full flex-col px-3 py-2 text-left hover:bg-sky-50",
                                    selected && "bg-sky-50"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "text-[13px]",
                                      selected && "font-medium text-sky-900"
                                    )}
                                  >
                                    {p.name}
                                  </span>
                                  {p.brand ? (
                                    <span className="text-[11px] text-muted-foreground">
                                      {p.brand}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                        </div>
                      )}
                      {li.paintProductId && !productListOpen ? (
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {productMap[li.paintProductId]?.brand
                            ? `${productMap[li.paintProductId]?.brand} · `
                            : ""}
                          {spread} sf/gal
                        </p>
                      ) : null}
                    </div>

                    {(() => {
                      const selectedProduct = li.paintProductId
                        ? productMap[li.paintProductId]
                        : null;
                      const sheenOpts = sheenOptionsForProduct(selectedProduct);
                      if (!selectedProduct || sheenOpts.length === 0) {
                        return null;
                      }
                      return (
                        <div>
                          <Label className="text-[12px]">Sheen</Label>
                          <select
                            className="mt-1 flex h-9 w-full rounded-md border bg-background px-2 text-[13px]"
                            value={li.sheen ?? ""}
                            onChange={(e) =>
                              patchSurface(idx, {
                                sheen: e.target.value || null,
                              })
                            }
                          >
                            {sheenOpts.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })()}

                    {li.paintProductId ? (
                      <div>
                        <Label className="text-[12px]">Color</Label>
                        <div className="mt-1.5">
                          <ProjectColorField
                            value={li.colorName}
                            projectColors={projectColors}
                            onProjectColorsChange={onProjectColorsChange}
                            onChange={(colorId) =>
                              patchSurface(idx, {
                                colorName: colorId,
                                colorHex: null,
                              })
                            }
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-[12px] tabular-nums sm:grid-cols-4">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Gallons
                        </div>
                        <div className="mt-0.5 font-semibold">
                          {formatNumber(calc.gallons)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Hours
                        </div>
                        <div className="mt-0.5 font-semibold">
                          {formatNumber(calc.laborHours + calc.prepHours)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Material
                        </div>
                        <div className="mt-0.5 font-semibold">
                          {formatCurrency(calc.materialCost)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Line total
                        </div>
                        <div className="mt-0.5 font-semibold">
                          {formatCurrency(calc.lineTotal)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-5 py-3">
                    <Button
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        removeSurface(idx);
                        setSurfaceEditKey(null);
                      }}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                    <Button onClick={() => setSurfaceEditKey(null)}>Done</Button>
                  </div>
                </div>
              </div>
            );
          })()}

          {closetDialogOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[2px]">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="closet-dims-title"
                className="w-full max-w-lg overflow-hidden rounded-2xl border bg-background shadow-xl"
              >
                <div className="border-b bg-[linear-gradient(145deg,#f7fafc_0%,#eef5fa_48%,#e7f0f7_100%)] px-5 py-4">
                  <h2
                    id="closet-dims-title"
                    className="text-lg font-semibold tracking-tight"
                  >
                    Closet dimensions
                  </h2>
                  <p className="mt-1 text-[13px] text-slate-600">
                    Tap a size — same as rooms. Ceiling and baseboards are on
                    by default.
                  </p>
                </div>
                <div className="max-h-[min(60vh,420px)] space-y-4 overflow-y-auto px-5 py-4">
                  <ClosetDimRow
                    label="Width"
                    options={CLOSET_WIDTH_OPTIONS}
                    value={closetForm.widthFt}
                    onChange={(n) =>
                      setClosetForm((f) => ({ ...f, widthFt: n }))
                    }
                  />
                  <ClosetDimRow
                    label="Depth"
                    options={CLOSET_DEPTH_OPTIONS}
                    value={closetForm.depthFt}
                    onChange={(n) =>
                      setClosetForm((f) => ({ ...f, depthFt: n }))
                    }
                  />
                  <ClosetDimRow
                    label="Height"
                    options={CLOSET_HEIGHT_OPTIONS}
                    value={closetForm.heightFt}
                    onChange={(n) =>
                      setClosetForm((f) => ({ ...f, heightFt: n }))
                    }
                  />

                  {(() => {
                    const cm = calculateClosetMetrics({
                      widthFt: closetForm.widthFt,
                      depthFt: closetForm.depthFt,
                      heightFt: closetForm.heightFt,
                    });
                    return (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/80">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Walls
                          </div>
                          <div className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight text-slate-900">
                            {formatNumber(cm.wallNetSqft, 0)}
                            <span className="ml-1 text-[12px] font-medium text-slate-400">
                              sq ft
                            </span>
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/80">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Ceiling
                          </div>
                          <div className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight text-slate-900">
                            {closetForm.includeCeiling
                              ? formatNumber(cm.ceilingSqft, 0)
                              : "—"}
                            {closetForm.includeCeiling && (
                              <span className="ml-1 text-[12px] font-medium text-slate-400">
                                sq ft
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/80">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Baseboards
                          </div>
                          <div className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight text-slate-900">
                            {closetForm.includeBaseboards
                              ? formatNumber(cm.baseboardLf, 0)
                              : "—"}
                            {closetForm.includeBaseboards && (
                              <span className="ml-1 text-[12px] font-medium text-slate-400">
                                LF
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-3.5 py-3 select-none hover:border-sky-300 hover:bg-sky-50/40">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-sky-600"
                      checked={closetForm.includeCeiling}
                      onChange={(e) =>
                        setClosetForm((f) => ({
                          ...f,
                          includeCeiling: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="block text-[13px] font-medium">
                        Include closet ceiling
                      </span>
                      <span className="mt-0.5 block text-[12px] text-muted-foreground">
                        Adds{" "}
                        {formatNumber(
                          (closetForm.widthFt || 0) *
                            (closetForm.depthFt || 0),
                          0
                        )}{" "}
                        sq ft (W × D). Turn off for walls only.
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-3.5 py-3 select-none hover:border-sky-300 hover:bg-sky-50/40">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-sky-600"
                      checked={closetForm.includeBaseboards}
                      onChange={(e) =>
                        setClosetForm((f) => ({
                          ...f,
                          includeBaseboards: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="block text-[13px] font-medium">
                        Include baseboards
                      </span>
                      <span className="mt-0.5 block text-[12px] text-muted-foreground">
                        Adds{" "}
                        {formatNumber(
                          calculateClosetMetrics({
                            widthFt: closetForm.widthFt,
                            depthFt: closetForm.depthFt,
                            heightFt: closetForm.heightFt,
                          }).baseboardLf,
                          0
                        )}{" "}
                        LF (closet perimeter). Uses trim production rates.
                      </span>
                    </span>
                  </label>
                </div>
                <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-5 py-3">
                  <span className="text-[12px] tabular-nums text-slate-500">
                    {closetForm.widthFt} × {closetForm.depthFt} ×{" "}
                    {closetForm.heightFt} ft
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setClosetDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={confirmCloset}>
                      {hasCloset ? "Update closet" : "Add closet"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="left-[calc(50%+100px)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits to this room. Save them, discard, or keep
              editing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-end">
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <Button variant="outline" onClick={discardAndClose}>
              Discard
            </Button>
            <AlertDialogAction onClick={saveAndClose}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function roomFromPreset(
  preset: RoomTypePreset,
  products: Product[],
  rates: Rate[],
  doorDeduct: number,
  windowDeduct: number,
  defaultsMap: SurfaceProductDefaultsMap = {}
): EditorRoom {
  let room: EditorRoom =
    preset.kind === "exterior"
      ? {
          ...blankExteriorRoom(),
          name: preset.name,
          doorCount: preset.doorCount ?? 1,
          windowCount: preset.windowCount ?? 0,
          openingCount: preset.openingCount ?? 0,
          inputAreaSqft: preset.inputAreaSqft ?? 0,
          inputLinearFt: preset.inputLinearFt ?? 0,
          exteriorMode: preset.exteriorMode ?? "simple",
          exteriorTrimScope: preset.exteriorTrimScope ?? "global",
          exteriorWalls: preset.exteriorWalls ?? [],
          exteriorCladding: preset.exteriorCladding ?? "siding",
        }
      : {
          ...blankInteriorRoom(),
          name: preset.id === "custom" ? "New Room" : preset.name,
          lengthFt: preset.lengthFt ?? 12,
          widthFt: preset.widthFt ?? 12,
          heightFt: preset.heightFt ?? 8,
          doorCount: preset.doorCount ?? 1,
          windowCount: preset.windowCount ?? 1,
          openingCount: preset.openingCount ?? 0,
        };

  const surfaceKeys =
    preset.kind === "exterior" && preset.exteriorMode === "walls"
      ? preset.surfaces.filter(
          (k) =>
            k !== "exterior_siding" &&
            k !== "exterior_gable" &&
            k !== "exterior_accent" &&
            k !== "exterior_stucco"
        )
      : preset.surfaces;

  for (const key of surfaceKeys) {
    room = addFeatureToRoom(
      room,
      key,
      products,
      rates,
      doorDeduct,
      windowDeduct,
      defaultsMap
    );
  }

  if (room.kind === "exterior") {
    if (room.exteriorMode === "walls" && !room.exteriorWalls?.length) {
      room = { ...room, exteriorWalls: defaultWholeHouseWalls() };
    }
    // Applies cladding (siding vs stucco product/spread) or wall groups
    room = reconcileExteriorWallSurfaces(
      room,
      products,
      rates,
      doorDeduct,
      windowDeduct,
      defaultsMap
    );
  }
  return room;
}

function addFeatureToRoom(
  room: EditorRoom,
  key: RoomSurfaceKey,
  products: Product[],
  rates: Rate[],
  doorDeduct: number,
  windowDeduct: number,
  defaultsMap: SurfaceProductDefaultsMap = {}
): EditorRoom {
  const metrics =
    room.kind === "interior"
      ? calculateInteriorRoomMetrics({
          lengthFt: room.lengthFt ?? 0,
          widthFt: room.widthFt ?? 0,
          heightFt: room.heightFt ?? 0,
          doorCount: room.doorCount,
          windowCount: room.windowCount,
          openingCount: room.openingCount ?? 0,
          doorDeductionSqft: doorDeduct,
          windowDeductionSqft: windowDeduct,
        })
      : null;

  const drafts = expandRoomSurfaces({
    roomName: room.name,
    kind: room.kind,
    selected: [key],
    metrics,
    exteriorAreaSqft: room.inputAreaSqft,
    exteriorLinearFt: room.inputLinearFt,
    doorCount: room.doorCount,
    windowCount: room.windowCount,
    coats: 2,
    closet: {
      widthFt: room.closetWidthFt ?? 4,
      depthFt: room.closetDepthFt ?? 2,
      heightFt: room.closetHeightFt ?? room.heightFt ?? 8,
    },
  });

  const d = drafts[0];
  if (!d) return room;
  const rate = findRate(rates, d.surfaceType, d.method);
  const { product, sheen } = resolveDefaultPaint({
    surfaceType: d.surfaceType,
    products,
    defaultsMap,
  });

  const surface: EditorSurface = {
    _key: newKey(),
    featureKey: key,
    description: d.description,
    surfaceType: d.surfaceType,
    measurementType: d.measurementType,
    inputAreaSqft: d.inputAreaSqft,
    quantity: d.quantity,
    unitLabel: d.unitLabel,
    dimensionsJson: JSON.stringify({
      autoLinked: true,
      featureKey: key,
      showWork: d.showWork,
      closet:
        key === "closet" ||
        key === "closet_ceiling" ||
        key === "closet_trim"
          ? {
              widthFt: room.closetWidthFt ?? 4,
              depthFt: room.closetDepthFt ?? 2,
              heightFt: room.closetHeightFt ?? 8,
            }
          : undefined,
    }),
    coats: d.coats,
    method: d.method,
    paintProductId: product?.id ?? null,
    sheen,
    colorName: null,
    colorHex: null,
    productionRateId: rate?.id ?? null,
    productionRateOverride: null,
    sortOrder: room.surfaces.length,
    autoLinked: true,
  };

  const next = {
    ...room,
    surfaces: [...room.surfaces, surface],
  };
  return {
    ...next,
    surfaces: applyRoomMetricsToSurfaces(next, doorDeduct, windowDeduct),
  };
}

function shortSurfaceLabel(description: string, roomName: string) {
  const prefix = `${roomName} — `;
  if (description.startsWith(prefix)) return description.slice(prefix.length);
  const i = description.indexOf(" — ");
  return i >= 0 ? description.slice(i + 3) : description;
}

function sheenOptionsForProduct(
  product?: Product | null
): string[] {
  if (!product) return [];
  if (product.sheens?.length) {
    return product.sheens.map((s) => s.name);
  }
  return product.sheen ? [product.sheen] : [];
}

function fullSurfaceLabel(short: string, roomName: string) {
  const trimmed = short.trim();
  if (!trimmed) return `${roomName} — Surface`;
  if (trimmed.includes(" — ")) return trimmed;
  return `${roomName} — ${trimmed}`;
}

const CLOSET_WIDTH_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 10];
const CLOSET_DEPTH_OPTIONS = [2, 2.5, 3, 4, 5, 6, 8];
const CLOSET_HEIGHT_OPTIONS = [7, 8, 9, 10];

/** Chip picker matching the room size step */
function ClosetDimRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (n: number) => void;
}) {
  const [customText, setCustomText] = useState(
    options.includes(value) ? "" : String(value)
  );
  const isCustom = !options.includes(value);
  const optionsKey = options.join(",");

  useEffect(() => {
    if (options.includes(value)) setCustomText("");
    else setCustomText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from value / option set
  }, [value, optionsKey]);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          {label}
        </span>
        <span className="text-[13px] font-semibold tabular-nums text-slate-800">
          {value} ft
        </span>
      </div>
      <div className="flex w-full flex-nowrap items-stretch gap-1">
        {options.map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              tabIndex={-1}
              onClick={() => {
                setCustomText("");
                onChange(n);
              }}
              className={cn(
                "h-9 min-w-0 flex-1 rounded-lg border px-0.5 text-[12px] font-semibold tabular-nums transition-all sm:text-[13px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50",
                selected
                  ? "border-sky-500 bg-sky-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50"
              )}
            >
              {n}
            </button>
          );
        })}
        <div
          className={cn(
            "flex h-9 shrink-0 items-center gap-1 rounded-lg border bg-white pl-2 pr-1.5 transition-all",
            isCustom
              ? "border-sky-500 ring-2 ring-sky-400/30"
              : "border-dashed border-slate-300 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/30"
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Custom
          </span>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="—"
            value={customText}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
              setCustomText(raw);
              const n = parseFloat(raw);
              if (Number.isFinite(n) && n >= 0) onChange(n);
            }}
            onFocus={() => {
              if (customText.trim() === "") setCustomText(String(value));
            }}
            onBlur={() => {
              if (customText.trim() === "") setCustomText("");
            }}
            className={cn(
              "h-7 w-[48px] border-0 bg-transparent px-0.5 text-[13px] font-semibold tabular-nums shadow-none focus-visible:ring-0",
              isCustom && "text-sky-800"
            )}
            aria-label={`Custom ${label.toLowerCase()}`}
          />
          <span className="text-[10px] text-slate-400">ft</span>
        </div>
      </div>
    </div>
  );
}

function DimField({
  label,
  value,
  onChange,
  step = 0.1,
  unit,
  size = "md",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  unit?: string;
  size?: "sm" | "md" | "lg";
}) {
  // Width on the input only — labels stay full so text is never clipped
  const inputWidth =
    size === "sm"
      ? unit === "count"
        ? "w-[52px]"
        : unit === "sq ft"
          ? "w-[88px]"
          : unit === "LF"
            ? "w-[76px]"
            : "w-[72px]"
      : undefined;

  return (
    <div className="min-w-0">
      <Label
        className={cn(
          "block whitespace-nowrap text-muted-foreground",
          size === "sm" ? "text-[10px] leading-tight" : "text-[11px]"
        )}
      >
        {label}
      </Label>
      <div
        className={cn(
          "flex items-center gap-1",
          size === "sm" ? "mt-0.5" : "mt-1"
        )}
      >
        <NumberInput
          min={0}
          step={step}
          value={value}
          onChange={onChange}
          className={cn(
            size === "lg" && "h-11 px-2.5 text-[15px] font-medium",
            size === "md" && "h-9 px-2.5 text-[13px]",
            size === "sm" && "h-8 px-2 text-[13px] font-medium",
            inputWidth
          )}
        />
        {unit && unit !== "count" && (
          <span
            className={cn(
              "shrink-0 text-muted-foreground",
              size === "sm" ? "text-[11px]" : "text-[12px]"
            )}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
