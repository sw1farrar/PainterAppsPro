"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  BedDouble,
  Bath,
  CookingPot,
  Sofa,
  UtensilsCrossed,
  DoorOpen,
  Briefcase,
  LayoutGrid,
  Home,
  Warehouse,
  Building2,
  ArrowLeft,
  AppWindow,
  SquareDashed,
  type LucideIcon,
} from "lucide-react";
import {
  calculateInteriorRoomMetrics,
  formatNumber,
  type RoomSurfaceKey,
} from "@/lib/calculations";
import {
  calculateExteriorHouseMetrics,
  defaultWholeHouseWalls,
  type ExteriorCladding,
  type ExteriorEstimateMode,
  type ExteriorTrimScope,
  type ExteriorWall,
} from "@/lib/exterior-walls";
import {
  ExteriorModeToggle,
  ExteriorWallsPanel,
} from "@/components/estimator/exterior-walls-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const INTERIOR_COUNT_OPTIONS = [0, 1, 2];
const EXTERIOR_DOOR_OPTIONS = [1, 2, 3, 4];
const EXTERIOR_WINDOW_OPTIONS = [2, 4, 6, 8, 10, 12, 16];

export type RoomTypePreset = {
  id: string;
  name: string;
  blurb: string;
  kind: "interior" | "exterior";
  icon: LucideIcon;
  lengthFt?: number;
  widthFt?: number;
  heightFt?: number;
  doorCount?: number;
  windowCount?: number;
  /** Blank wall holes — paint deduction only */
  openingCount?: number;
  includeCrown?: boolean;
  inputAreaSqft?: number;
  inputLinearFt?: number;
  exteriorMode?: ExteriorEstimateMode;
  exteriorTrimScope?: ExteriorTrimScope;
  exteriorWalls?: ExteriorWall[];
  exteriorCladding?: ExteriorCladding;
  surfaces: RoomSurfaceKey[];
};

type DimChoices = {
  lengths: number[];
  widths: number[];
  heights: number[];
};

const DEFAULT_HEIGHTS = [7, 8, 9, 10, 11, 12];

/** Common individual dimensions by room type */
const DIM_CHOICES: Record<string, DimChoices> = {
  bedroom: {
    lengths: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20],
    widths: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20],
    heights: DEFAULT_HEIGHTS,
  },
  bathroom: {
    lengths: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    widths: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    heights: DEFAULT_HEIGHTS,
  },
  kitchen: {
    lengths: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20],
    widths: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20],
    heights: DEFAULT_HEIGHTS,
  },
  living: {
    lengths: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24],
    widths: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24],
    heights: DEFAULT_HEIGHTS,
  },
  dining: {
    lengths: [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20],
    widths: [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20],
    heights: DEFAULT_HEIGHTS,
  },
  hallway: {
    lengths: [3, 3.5, 4, 4.5, 5, 6, 7, 8],
    widths: [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32],
    heights: DEFAULT_HEIGHTS,
  },
  office: {
    lengths: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18],
    widths: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18],
    heights: DEFAULT_HEIGHTS,
  },
  custom: {
    lengths: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24],
    widths: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24],
    heights: DEFAULT_HEIGHTS,
  },
};

const EXTERIOR_AREA_OPTIONS = [1200, 1500, 1800, 2100, 2400, 2800, 3200];
const EXTERIOR_TRIM_OPTIONS = [280, 340, 400, 460, 520, 600, 680];

export const ROOM_TYPE_PRESETS: RoomTypePreset[] = [
  {
    id: "bedroom",
    name: "Bedroom",
    blurb: "Walls, ceiling, trim",
    kind: "interior",
    icon: BedDouble,
    lengthFt: 12,
    widthFt: 14,
    heightFt: 8,
    doorCount: 1,
    windowCount: 2,
    surfaces: ["walls_smooth", "ceiling", "trim"],
  },
  {
    id: "bathroom",
    name: "Bathroom",
    blurb: "Walls, ceiling, trim",
    kind: "interior",
    icon: Bath,
    lengthFt: 8,
    widthFt: 5,
    heightFt: 8,
    doorCount: 1,
    windowCount: 1,
    surfaces: ["walls_smooth", "ceiling", "trim"],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    blurb: "Walls, ceiling, trim",
    kind: "interior",
    icon: CookingPot,
    lengthFt: 12,
    widthFt: 14,
    heightFt: 9,
    doorCount: 1,
    windowCount: 2,
    surfaces: ["walls_smooth", "ceiling", "trim"],
  },
  {
    id: "living",
    name: "Living room",
    blurb: "Walls, ceiling, trim",
    kind: "interior",
    icon: Sofa,
    lengthFt: 16,
    widthFt: 18,
    heightFt: 9,
    doorCount: 2,
    windowCount: 3,
    surfaces: ["walls_smooth", "ceiling", "trim"],
  },
  {
    id: "dining",
    name: "Dining room",
    blurb: "Walls, ceiling, trim",
    kind: "interior",
    icon: UtensilsCrossed,
    lengthFt: 12,
    widthFt: 12,
    heightFt: 9,
    doorCount: 1,
    windowCount: 2,
    surfaces: ["walls_smooth", "ceiling", "trim"],
  },
  {
    id: "hallway",
    name: "Hallway",
    blurb: "Walls, ceiling, trim",
    kind: "interior",
    icon: DoorOpen,
    lengthFt: 4,
    widthFt: 12,
    heightFt: 8,
    doorCount: 2,
    windowCount: 0,
    surfaces: ["walls_smooth", "ceiling", "trim"],
  },
  {
    id: "office",
    name: "Office",
    blurb: "Walls, ceiling, trim",
    kind: "interior",
    icon: Briefcase,
    lengthFt: 10,
    widthFt: 12,
    heightFt: 8,
    doorCount: 1,
    windowCount: 1,
    surfaces: ["walls_smooth", "ceiling", "trim"],
  },
  {
    id: "custom",
    name: "Custom room",
    blurb: "Any space — set size next",
    kind: "interior",
    icon: LayoutGrid,
    lengthFt: 12,
    widthFt: 12,
    heightFt: 8,
    doorCount: 1,
    windowCount: 1,
    surfaces: ["walls_smooth", "ceiling", "trim"],
  },
  {
    id: "exterior_house",
    name: "Whole house",
    blurb: "Wall-by-wall or quick area",
    kind: "exterior",
    icon: Home,
    inputAreaSqft: 1800,
    inputLinearFt: 400,
    doorCount: 2,
    windowCount: 8,
    exteriorMode: "walls",
    exteriorTrimScope: "global",
    surfaces: [
      "exterior_siding",
      "exterior_trim",
      "exterior_doors",
      "exterior_windows",
    ],
  },
  {
    id: "exterior_front",
    name: "Front elevation",
    blurb: "Street-facing siding & trim",
    kind: "exterior",
    icon: Building2,
    inputAreaSqft: 900,
    inputLinearFt: 220,
    doorCount: 1,
    windowCount: 4,
    surfaces: [
      "exterior_siding",
      "exterior_trim",
      "exterior_doors",
      "exterior_windows",
    ],
  },
  {
    id: "exterior_garage",
    name: "Garage / shed",
    blurb: "Outbuilding siding & trim",
    kind: "exterior",
    icon: Warehouse,
    inputAreaSqft: 600,
    inputLinearFt: 160,
    doorCount: 1,
    windowCount: 2,
    surfaces: [
      "exterior_siding",
      "exterior_trim",
      "exterior_doors",
      "exterior_windows",
    ],
  },
  {
    id: "exterior_custom",
    name: "Custom exterior",
    blurb: "Enter your own sizes",
    kind: "exterior",
    icon: LayoutGrid,
    inputAreaSqft: 1500,
    inputLinearFt: 340,
    doorCount: 2,
    windowCount: 6,
    surfaces: [
      "exterior_siding",
      "exterior_trim",
      "exterior_doors",
      "exterior_windows",
    ],
  },
];

const EXTERIOR_AREA_BY_PRESET: Record<string, number[]> = {
  exterior_house: [1200, 1500, 1800, 2100, 2400, 2800, 3200],
  exterior_front: [600, 750, 900, 1100, 1300, 1500, 1800],
  exterior_garage: [400, 500, 600, 750, 900, 1100, 1400],
  exterior_custom: EXTERIOR_AREA_OPTIONS,
};

const EXTERIOR_TRIM_BY_PRESET: Record<string, number[]> = {
  exterior_house: [280, 340, 400, 460, 520, 600, 680],
  exterior_front: [140, 180, 220, 260, 300, 360, 420],
  exterior_garage: [100, 130, 160, 200, 240, 280, 340],
  exterior_custom: EXTERIOR_TRIM_OPTIONS,
};

function finishPreset(
  type: RoomTypePreset,
  size: {
    lengthFt?: number;
    widthFt?: number;
    heightFt?: number;
    doorCount?: number;
    windowCount?: number;
    openingCount?: number;
    includeCrown?: boolean;
    inputAreaSqft?: number;
    inputLinearFt?: number;
    exteriorMode?: ExteriorEstimateMode;
    exteriorTrimScope?: ExteriorTrimScope;
    exteriorWalls?: ExteriorWall[];
    exteriorCladding?: ExteriorCladding;
  }
): RoomTypePreset {
  const includeCrown = size.includeCrown ?? type.includeCrown ?? false;
  const doorCount = size.doorCount ?? type.doorCount ?? 0;
  const windowCount = size.windowCount ?? type.windowCount ?? 0;
  const surfaces = [...type.surfaces];

  // Mirror picker choices onto selected features so the room editor opens with them on
  if (includeCrown && !surfaces.includes("crown")) {
    surfaces.push("crown");
  }
  if (type.kind === "interior") {
    if (doorCount > 0 && !surfaces.includes("doors")) {
      surfaces.push("doors");
    }
    if (windowCount > 0 && !surfaces.includes("windows")) {
      surfaces.push("windows");
    }
  } else {
    if (doorCount > 0 && !surfaces.includes("exterior_doors")) {
      surfaces.push("exterior_doors");
    }
    if (windowCount > 0 && !surfaces.includes("exterior_windows")) {
      surfaces.push("exterior_windows");
    }
  }

  const exteriorWalls = size.exteriorWalls
    ? size.exteriorWalls.map((w) => ({
        ...w,
        openings: { ...w.openings },
      }))
    : type.exteriorWalls?.map((w) => ({
        ...w,
        openings: { ...w.openings },
      }));

  return {
    ...type,
    ...size,
    includeCrown,
    exteriorWalls,
    surfaces,
    blurb:
      type.kind === "exterior"
        ? `${size.inputAreaSqft ?? type.inputAreaSqft} sq ft siding`
        : `${size.lengthFt}×${size.widthFt}×${size.heightFt}`,
  };
}

function CountRow({
  label,
  icon: Icon,
  value,
  onChange,
  options = INTERIOR_COUNT_OPTIONS,
  inputRef,
  onTabNext,
  onTabPrev,
}: {
  label: string;
  icon: LucideIcon;
  value: number;
  onChange: (n: number) => void;
  options?: number[];
  inputRef?: RefObject<HTMLInputElement | null>;
  onTabNext?: () => void;
  onTabPrev?: () => void;
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
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex flex-nowrap items-center gap-1">
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
                "flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border px-1 text-[13px] font-semibold tabular-nums transition-all",
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
            "flex h-9 shrink-0 items-center gap-1 rounded-lg border bg-white px-1.5 transition-all",
            isCustom
              ? "border-sky-500 ring-2 ring-sky-400/30"
              : "border-dashed border-slate-300 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/30"
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Custom
          </span>
          <Input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            placeholder="#"
            value={customText}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw !== "" && !/^\d*$/.test(raw)) return;
              setCustomText(raw);
              const n = parseInt(raw, 10);
              if (Number.isFinite(n) && n >= 0) onChange(n);
            }}
            onFocus={() => {
              if (customText.trim() === "") setCustomText(String(value));
            }}
            onKeyDown={(e) => {
              if (e.key === "Tab" && !e.shiftKey && onTabNext) {
                e.preventDefault();
                onTabNext();
                return;
              }
              if (e.key === "Tab" && e.shiftKey && onTabPrev) {
                e.preventDefault();
                onTabPrev();
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                onTabNext?.();
              }
            }}
            className="h-7 w-10 border-0 bg-transparent px-1 text-center text-[14px] font-semibold tabular-nums shadow-none focus-visible:ring-0"
            aria-label={`Custom ${label.toLowerCase()} count`}
          />
        </div>
      </div>
    </div>
  );
}

function focusAndSelect(ref: RefObject<HTMLInputElement | null>) {
  const el = ref.current;
  if (!el) return;
  el.focus();
  el.select();
}

function DimRow({
  label,
  unit,
  options,
  value,
  onChange,
  inputRef,
  onTabNext,
  onTabPrev,
}: {
  label: string;
  unit: string;
  options: number[];
  value: number;
  onChange: (n: number) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  onTabNext?: () => void;
  onTabPrev?: () => void;
}) {
  const [customText, setCustomText] = useState(
    options.includes(value) ? "" : String(value)
  );
  const isCustom = !options.includes(value);

  const optionsKey = options.join(",");
  useEffect(() => {
    if (options.includes(value)) {
      setCustomText("");
    } else {
      setCustomText(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from value / option set
  }, [value, optionsKey]);

  function applyCustom(raw: string) {
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n < 0) return;
    onChange(n);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          {label}
        </span>
        <span className="text-[13px] font-semibold tabular-nums text-slate-800">
          {unit === "sq ft" || unit === "LF"
            ? value.toLocaleString()
            : value}{" "}
          {unit}
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
              {unit === "sq ft" || unit === "LF" ? n.toLocaleString() : n}
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
            ref={inputRef}
            type="text"
            inputMode="decimal"
            placeholder="—"
            value={customText}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
              setCustomText(raw);
              applyCustom(raw);
            }}
            onFocus={() => {
              if (customText.trim() === "") setCustomText(String(value));
            }}
            onBlur={() => {
              if (customText.trim() !== "") applyCustom(customText);
            }}
            onKeyDown={(e) => {
              if (e.key === "Tab" && !e.shiftKey && onTabNext) {
                e.preventDefault();
                if (customText.trim() !== "") applyCustom(customText);
                onTabNext();
                return;
              }
              if (e.key === "Tab" && e.shiftKey && onTabPrev) {
                e.preventDefault();
                if (customText.trim() !== "") applyCustom(customText);
                onTabPrev();
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (customText.trim() !== "") applyCustom(customText);
                if (onTabNext) onTabNext();
                else (e.target as HTMLInputElement).blur();
              }
            }}
            className={cn(
              "h-7 border-0 bg-transparent px-0.5 text-[13px] font-semibold tabular-nums shadow-none focus-visible:ring-0",
              unit === "sq ft" || unit === "LF" ? "w-[64px]" : "w-[52px]",
              isCustom && "text-sky-800"
            )}
            aria-label={`Custom ${label.toLowerCase()}`}
          />
          <span className="text-[10px] text-slate-400">{unit}</span>
        </div>
      </div>
    </div>
  );
}

export function RoomTypePicker({
  open,
  onOpenChange,
  onSelect,
  kindFilter = null,
  doorDeductionSqft = 20,
  windowDeductionSqft = 15,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (preset: RoomTypePreset) => void;
  /** When set, only show presets of this kind (from new-estimate setup). */
  kindFilter?: "interior" | "exterior" | null;
  doorDeductionSqft?: number;
  windowDeductionSqft?: number;
}) {
  const [step, setStep] = useState<"type" | "size">("type");
  const [selectedType, setSelectedType] = useState<RoomTypePreset | null>(null);
  const [lengthFt, setLengthFt] = useState(12);
  const [widthFt, setWidthFt] = useState(12);
  const [heightFt, setHeightFt] = useState(8);
  const [doorCount, setDoorCount] = useState(1);
  const [windowCount, setWindowCount] = useState(1);
  const [openingCount, setOpeningCount] = useState(0);
  const [includeCrown, setIncludeCrown] = useState(false);
  const [areaSqft, setAreaSqft] = useState(1800);
  const [trimLf, setTrimLf] = useState(400);
  const [exteriorMode, setExteriorMode] =
    useState<ExteriorEstimateMode>("simple");
  const [exteriorTrimScope, setExteriorTrimScope] =
    useState<ExteriorTrimScope>("global");
  const [exteriorWalls, setExteriorWalls] = useState<ExteriorWall[]>([]);
  const [exteriorCladding, setExteriorCladding] =
    useState<ExteriorCladding>("siding");
  const lengthInputRef = useRef<HTMLInputElement>(null);
  const widthInputRef = useRef<HTMLInputElement>(null);
  const heightInputRef = useRef<HTMLInputElement>(null);
  const doorInputRef = useRef<HTMLInputElement>(null);
  const windowInputRef = useRef<HTMLInputElement>(null);
  const openingInputRef = useRef<HTMLInputElement>(null);
  const areaInputRef = useRef<HTMLInputElement>(null);
  const trimInputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      setStep("type");
      setSelectedType(null);
    }
  }, [open]);

  function pickType(preset: RoomTypePreset) {
    setSelectedType(preset);
    setLengthFt(preset.lengthFt ?? 12);
    setWidthFt(preset.widthFt ?? 12);
    setHeightFt(preset.heightFt ?? 8);
    setDoorCount(preset.doorCount ?? 1);
    setWindowCount(preset.windowCount ?? 1);
    setOpeningCount(preset.openingCount ?? 0);
    setIncludeCrown(preset.includeCrown ?? false);
    setAreaSqft(preset.inputAreaSqft ?? 1800);
    setTrimLf(preset.inputLinearFt ?? 400);
    const mode = preset.exteriorMode ?? "simple";
    setExteriorMode(mode);
    setExteriorTrimScope(preset.exteriorTrimScope ?? "global");
    setExteriorCladding(preset.exteriorCladding ?? "siding");
    setExteriorWalls(
      mode === "walls"
        ? (preset.exteriorWalls ?? defaultWholeHouseWalls()).map((w) => ({
            ...w,
            openings: { ...w.openings },
          }))
        : []
    );
    setStep("size");
  }

  function continueWithSize() {
    if (!selectedType) return;
    if (selectedType.kind === "exterior") {
      const wallTotals =
        exteriorMode === "walls"
          ? calculateExteriorHouseMetrics(exteriorWalls, {
              trimScope: exteriorTrimScope,
              globalTrimLf: trimLf,
            })
          : null;
      onSelect(
        finishPreset(selectedType, {
          inputAreaSqft: wallTotals?.netSqft ?? areaSqft,
          inputLinearFt: wallTotals?.trimLf ?? trimLf,
          doorCount: wallTotals?.doorCount ?? doorCount,
          windowCount: wallTotals?.windowCount ?? windowCount,
          openingCount: 0,
          includeCrown: false,
          exteriorMode,
          exteriorTrimScope,
          exteriorCladding,
          exteriorWalls:
            exteriorMode === "walls" ? exteriorWalls : undefined,
        })
      );
    } else {
      onSelect(
        finishPreset(selectedType, {
          lengthFt,
          widthFt,
          heightFt,
          doorCount,
          windowCount,
          openingCount,
          includeCrown,
        })
      );
    }
    onOpenChange(false);
  }

  const dims =
    selectedType != null
      ? (DIM_CHOICES[selectedType.id] ?? DIM_CHOICES.custom)
      : DIM_CHOICES.custom;

  const TypeIcon = selectedType?.icon;
  const metrics = calculateInteriorRoomMetrics({
    lengthFt,
    widthFt,
    heightFt,
    doorCount,
    windowCount,
    openingCount,
    doorDeductionSqft,
    windowDeductionSqft,
  });
  const exteriorHouse =
    selectedType?.kind === "exterior" && exteriorMode === "walls"
      ? calculateExteriorHouseMetrics(exteriorWalls, {
          trimScope: exteriorTrimScope,
          globalTrimLf: trimLf,
        })
      : null;
  const exteriorSummary = {
    siding: exteriorHouse?.netSqft ?? areaSqft,
    trim: exteriorHouse?.trimLf ?? trimLf,
    doors: exteriorHouse?.doorCount ?? doorCount,
    windows: exteriorHouse?.windowCount ?? windowCount,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="left-[calc(50%+100px)] w-[min(720px,calc(100vw-200px-2rem))] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        {step === "type" ? (
          <>
            <div className="relative border-b bg-[linear-gradient(145deg,#f7fafc_0%,#eef5fa_48%,#e7f0f7_100%)] px-6 py-5">
              <div className="mb-3 flex gap-1.5">
                <span className="h-1.5 w-8 rounded-full bg-sky-500" />
                <span className="h-1.5 w-8 rounded-full bg-slate-200" />
              </div>
              <DialogHeader className="gap-1.5">
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  {kindFilter === "interior"
                    ? "Which room?"
                    : kindFilter === "exterior"
                      ? "Which exterior?"
                      : "What are you painting?"}
                </DialogTitle>
                <DialogDescription className="text-[13px] text-slate-600">
                  {kindFilter === "interior"
                    ? "Pick a room type — next you’ll set the size."
                    : kindFilter === "exterior"
                      ? "Pick an exterior scope — next you’ll set the size."
                      : "Pick a room or exterior type — next you’ll set the size."}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="grid max-h-[min(62vh,520px)] grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3">
              {ROOM_TYPE_PRESETS.filter(
                (p) => !kindFilter || p.kind === kindFilter
              ).map((preset) => {
                const Icon = preset.icon;
                const isExterior = preset.kind === "exterior";
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => pickType(preset)}
                    className={cn(
                      "group flex min-h-[118px] flex-col items-start gap-3 rounded-2xl border bg-background p-4 text-left transition-all",
                      "hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/70 hover:shadow-md",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50",
                      isExterior &&
                        "border-slate-200 bg-slate-50/40 hover:border-slate-400 hover:bg-slate-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
                        isExterior
                          ? "bg-slate-800 text-white group-hover:bg-slate-900"
                          : "bg-sky-100 text-sky-800 group-hover:bg-sky-200"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="space-y-0.5">
                      <span className="block text-[15px] font-semibold tracking-tight">
                        {preset.name}
                      </span>
                      <span className="block text-[12px] leading-snug text-muted-foreground">
                        {preset.blurb}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="relative border-b bg-[linear-gradient(145deg,#f7fafc_0%,#eef5fa_48%,#e7f0f7_100%)] px-6 py-5">
              <div className="mb-3 flex gap-1.5">
                <span className="h-1.5 w-8 rounded-full bg-sky-500/40" />
                <span className="h-1.5 w-8 rounded-full bg-sky-500" />
              </div>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setStep("type")}
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Back to room type"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <DialogHeader className="gap-1">
                    <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                      {TypeIcon && (
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
                          <TypeIcon className="h-4 w-4" />
                        </span>
                      )}
                      Set the size
                    </DialogTitle>
                    <DialogDescription className="text-[13px] text-slate-600">
                      {selectedType?.kind === "exterior"
                        ? exteriorMode === "walls"
                          ? "Add each wall (L × H), deduct openings, and set trim. Net siding and door/window counts update live."
                          : "Tap a size for siding and trim, then set door and window counts. Or switch to wall-by-wall."
                        : "Doors & windows deduct wall paint; windows add casing trim. Blank openings deduct paint only."}
                    </DialogDescription>
                  </DialogHeader>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "space-y-4 overflow-y-auto px-5 py-4",
                selectedType?.kind === "exterior" && exteriorMode === "walls"
                  ? "max-h-[min(52vh,480px)]"
                  : "max-h-[min(42vh,360px)]"
              )}
            >
              {selectedType?.kind === "interior" ? (
                <>
                  <DimRow
                    label="Length"
                    unit="ft"
                    options={dims.lengths}
                    value={lengthFt}
                    onChange={setLengthFt}
                    inputRef={lengthInputRef}
                    onTabNext={() => focusAndSelect(widthInputRef)}
                  />
                  <DimRow
                    label="Width"
                    unit="ft"
                    options={dims.widths}
                    value={widthFt}
                    onChange={setWidthFt}
                    inputRef={widthInputRef}
                    onTabNext={() => focusAndSelect(heightInputRef)}
                    onTabPrev={() => focusAndSelect(lengthInputRef)}
                  />
                  <DimRow
                    label="Height"
                    unit="ft"
                    options={dims.heights}
                    value={heightFt}
                    onChange={setHeightFt}
                    inputRef={heightInputRef}
                    onTabNext={() => focusAndSelect(doorInputRef)}
                    onTabPrev={() => focusAndSelect(widthInputRef)}
                  />
                </>
              ) : (
                <>
                  <ExteriorModeToggle
                    mode={exteriorMode}
                    onChange={(mode) => {
                      setExteriorMode(mode);
                      if (
                        mode === "walls" &&
                        exteriorWalls.length === 0
                      ) {
                        setExteriorWalls(defaultWholeHouseWalls());
                      }
                    }}
                  />
                  {exteriorMode === "walls" ? (
                    <ExteriorWallsPanel
                      walls={exteriorWalls}
                      trimScope={exteriorTrimScope}
                      globalTrimLf={trimLf}
                      onWallsChange={setExteriorWalls}
                      onTrimScopeChange={setExteriorTrimScope}
                      onGlobalTrimChange={setTrimLf}
                      compact
                    />
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Material
                        </span>
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
                              onClick={() => setExteriorCladding(value)}
                              className={cn(
                                "rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors",
                                exteriorCladding === value
                                  ? "bg-slate-800 text-white"
                                  : "text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {exteriorCladding === "stucco" && (
                          <span className="text-[11px] text-amber-700">
                            Product coverage × 0.8 (−20%)
                          </span>
                        )}
                      </div>
                      <DimRow
                        label={
                          exteriorCladding === "stucco"
                            ? "Stucco area"
                            : "Siding area"
                        }
                        unit="sq ft"
                        options={
                          EXTERIOR_AREA_BY_PRESET[selectedType?.id ?? ""] ??
                          EXTERIOR_AREA_OPTIONS
                        }
                        value={areaSqft}
                        onChange={setAreaSqft}
                        inputRef={areaInputRef}
                        onTabNext={() => focusAndSelect(trimInputRef)}
                      />
                      <DimRow
                        label="Trim"
                        unit="LF"
                        options={
                          EXTERIOR_TRIM_BY_PRESET[selectedType?.id ?? ""] ??
                          EXTERIOR_TRIM_OPTIONS
                        }
                        value={trimLf}
                        onChange={setTrimLf}
                        inputRef={trimInputRef}
                        onTabNext={() => focusAndSelect(doorInputRef)}
                        onTabPrev={() => focusAndSelect(areaInputRef)}
                      />
                    </>
                  )}
                </>
              )}
            </div>

            {/* Live setup summary — sticky bottom */}
            <div className="shrink-0 border-t bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%)]">
              {selectedType?.kind === "interior" ? (
                <div className="grid grid-cols-3 gap-2 border-b px-5 py-3">
                  <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/80">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Walls
                    </div>
                    <div className="mt-0.5 text-[20px] font-semibold tabular-nums tracking-tight text-slate-900">
                      {formatNumber(metrics.wallNetSqft, 0)}
                      <span className="ml-1 text-[12px] font-medium text-slate-400">
                        sq ft
                      </span>
                    </div>
                    {metrics.openingsSqft > 0 && (
                      <div className="mt-0.5 text-[11px] tabular-nums text-slate-400">
                        −{formatNumber(metrics.openingsSqft, 0)} openings
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/80">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Ceiling
                    </div>
                    <div className="mt-0.5 text-[20px] font-semibold tabular-nums tracking-tight text-slate-900">
                      {formatNumber(metrics.ceilingSqft, 0)}
                      <span className="ml-1 text-[12px] font-medium text-slate-400">
                        sq ft
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] tabular-nums text-slate-400">
                      floor area
                    </div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/80">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Trim
                    </div>
                    <div className="mt-0.5 text-[20px] font-semibold tabular-nums tracking-tight text-slate-900">
                      {formatNumber(metrics.trimLf, 0)}
                      <span className="ml-1 text-[12px] font-medium text-slate-400">
                        LF
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] tabular-nums text-slate-400">
                      base + {formatNumber(metrics.windowCasingLf, 0)} casing
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 border-b px-5 py-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/80">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Net siding
                    </div>
                    <div className="mt-0.5 text-[20px] font-semibold tabular-nums tracking-tight text-slate-900">
                      {exteriorSummary.siding.toLocaleString()}
                      <span className="ml-1 text-[12px] font-medium text-slate-400">
                        sq ft
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {exteriorHouse
                        ? `−${exteriorHouse.openingsSqft.toLocaleString()} openings`
                        : "body paint"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/80">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Trim
                    </div>
                    <div className="mt-0.5 text-[20px] font-semibold tabular-nums tracking-tight text-slate-900">
                      {exteriorSummary.trim.toLocaleString()}
                      <span className="ml-1 text-[12px] font-medium text-slate-400">
                        LF
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {exteriorTrimScope === "per_wall" && exteriorMode === "walls"
                        ? "sum of walls"
                        : "fascia & casing"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/80">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Doors
                    </div>
                    <div className="mt-0.5 text-[20px] font-semibold tabular-nums tracking-tight text-slate-900">
                      {exteriorSummary.doors}
                      <span className="ml-1 text-[12px] font-medium text-slate-400">
                        ea
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      paint items
                    </div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/80">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Windows
                    </div>
                    <div className="mt-0.5 text-[20px] font-semibold tabular-nums tracking-tight text-slate-900">
                      {exteriorSummary.windows}
                      <span className="ml-1 text-[12px] font-medium text-slate-400">
                        ea
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      paint items
                    </div>
                  </div>
                </div>
              )}

              {(selectedType?.kind === "interior" ||
                exteriorMode === "simple") && (
              <div className="flex flex-nowrap items-end gap-3 px-5 py-3">
                <CountRow
                  label="Doors"
                  icon={DoorOpen}
                  value={doorCount}
                  onChange={setDoorCount}
                  options={
                    selectedType?.kind === "exterior"
                      ? EXTERIOR_DOOR_OPTIONS
                      : INTERIOR_COUNT_OPTIONS
                  }
                  inputRef={doorInputRef}
                  onTabNext={() => focusAndSelect(windowInputRef)}
                  onTabPrev={() =>
                    focusAndSelect(
                      selectedType?.kind === "exterior"
                        ? trimInputRef
                        : heightInputRef
                    )
                  }
                />
                <CountRow
                  label="Windows"
                  icon={AppWindow}
                  value={windowCount}
                  onChange={setWindowCount}
                  options={
                    selectedType?.kind === "exterior"
                      ? EXTERIOR_WINDOW_OPTIONS
                      : INTERIOR_COUNT_OPTIONS
                  }
                  inputRef={windowInputRef}
                  onTabNext={() =>
                    selectedType?.kind === "interior"
                      ? focusAndSelect(openingInputRef)
                      : continueRef.current?.focus()
                  }
                  onTabPrev={() => focusAndSelect(doorInputRef)}
                />
                {selectedType?.kind === "interior" && (
                  <CountRow
                    label="Openings"
                    icon={SquareDashed}
                    value={openingCount}
                    onChange={setOpeningCount}
                    options={INTERIOR_COUNT_OPTIONS}
                    inputRef={openingInputRef}
                    onTabNext={() => continueRef.current?.focus()}
                    onTabPrev={() => focusAndSelect(windowInputRef)}
                  />
                )}
              </div>
              )}

              {selectedType?.kind === "interior" && (
                <div className="flex flex-wrap items-center gap-3 border-t px-5 py-2.5">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-800 select-none hover:border-sky-300 hover:bg-sky-50/50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-sky-600"
                      checked={includeCrown}
                      onChange={(e) => setIncludeCrown(e.target.checked)}
                    />
                    <span>Crown molding</span>
                    <span className="text-[12px] font-normal text-slate-400">
                      +{formatNumber(metrics.crownLf, 0)} LF
                    </span>
                  </label>
                  <span className="text-[12px] text-slate-400">
                    Trim & baseboards {formatNumber(metrics.trimLf, 0)} LF
                    {includeCrown
                      ? ` · Crown ${formatNumber(metrics.crownLf, 0)} LF`
                      : ""}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
                <button
                  type="button"
                  onClick={() => setStep("type")}
                  className="text-[13px] font-medium text-slate-500 hover:text-slate-800"
                >
                  Back
                </button>
                <Button
                  ref={continueRef}
                  size="default"
                  className="min-w-[200px]"
                  onClick={continueWithSize}
                >
                  {selectedType?.kind === "exterior"
                    ? `Continue · ${exteriorSummary.siding.toLocaleString()} sf · ${exteriorSummary.doors}d / ${exteriorSummary.windows}w`
                    : `Continue · ${formatNumber(metrics.wallNetSqft, 0)} sf walls`}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
