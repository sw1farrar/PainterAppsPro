"use client";

import { useMemo } from "react";
import { Plus, Trash2, Copy } from "lucide-react";
import {
  EXTERIOR_HEIGHT_PRESETS,
  OPENING_SIZE_PRESETS,
  calculateExteriorHouseMetrics,
  createExteriorWall,
  surfaceKindLabel,
  type ExteriorEstimateMode,
  type ExteriorSurfaceKind,
  type ExteriorTrimScope,
  type ExteriorWall,
} from "@/lib/exterior-walls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { cn } from "@/lib/utils";

function NumField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  className,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  className?: string;
  suffix?: string;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <NumberInput
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          emptyValue={min}
          onChange={(n) => onChange(n < min ? min : n)}
          className="h-8 px-2 text-[13px] font-semibold"
        />
        {suffix && (
          <span className="shrink-0 text-[11px] text-slate-400">{suffix}</span>
        )}
      </div>
    </label>
  );
}

function OpeningRow({
  label,
  count,
  avgSqft,
  presetSqft,
  onChange,
}: {
  label: string;
  count: number;
  avgSqft: number;
  presetSqft: number;
  onChange: (next: { count: number; avgSqft: number }) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <NumField
        label={label}
        value={count}
        step={1}
        className="w-[72px]"
        onChange={(n) =>
          onChange({ count: Math.max(0, Math.round(n)), avgSqft })
        }
      />
      <NumField
        label="Avg size"
        value={avgSqft}
        step={1}
        className="w-[88px]"
        suffix="sf"
        onChange={(n) => onChange({ count, avgSqft: Math.max(0, n) })}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onChange({ count, avgSqft: presetSqft })}
        className={cn(
          "mb-0.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
          avgSqft === presetSqft
            ? "border-sky-400 bg-sky-50 text-sky-800"
            : "border-slate-200 text-slate-500 hover:border-sky-300 hover:bg-sky-50/60"
        )}
      >
        {presetSqft} sf
      </button>
    </div>
  );
}

const SURFACE_OPTIONS: { value: ExteriorSurfaceKind; label: string }[] = [
  { value: "body", label: "Main walls (siding)" },
  { value: "stucco", label: "Stucco (−20% coverage)" },
  { value: "gable", label: "Gable (roof peak)" },
  { value: "accent", label: "Accent / other material" },
  { value: "custom", label: "Custom label" },
];

export function ExteriorWallsPanel({
  walls,
  trimScope,
  globalTrimLf,
  onWallsChange,
  onTrimScopeChange,
  onGlobalTrimChange,
  compact = false,
}: {
  walls: ExteriorWall[];
  trimScope: ExteriorTrimScope;
  globalTrimLf: number;
  onWallsChange: (walls: ExteriorWall[]) => void;
  onTrimScopeChange: (scope: ExteriorTrimScope) => void;
  onGlobalTrimChange: (lf: number) => void;
  compact?: boolean;
}) {
  const metrics = useMemo(
    () =>
      calculateExteriorHouseMetrics(walls, {
        trimScope,
        globalTrimLf,
      }),
    [walls, trimScope, globalTrimLf]
  );

  function patchWall(id: string, patch: Partial<ExteriorWall>) {
    onWallsChange(
      walls.map((w) => (w.id === id ? { ...w, ...patch } : w))
    );
  }

  function addWall() {
    const n = walls.length + 1;
    onWallsChange([
      ...walls,
      createExteriorWall({
        name: `Wall ${n}`,
        lengthFt: 20,
        heightFt: walls[0]?.heightFt ?? 9,
        trimLf: trimScope === "per_wall" ? 40 : null,
      }),
    ]);
  }

  function duplicateWall(wall: ExteriorWall) {
    onWallsChange([
      ...walls,
      createExteriorWall({
        ...wall,
        id: undefined,
        name: `${wall.name} copy`,
      }),
    ]);
  }

  function removeWall(id: string) {
    if (walls.length <= 1) return;
    onWallsChange(walls.filter((w) => w.id !== id));
  }

  return (
    <div className={cn("space-y-3", compact && "space-y-2.5")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] text-slate-500">
          Length × height − openings = net siding per wall
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={addWall}
        >
          <Plus className="h-3.5 w-3.5" />
          Add wall
        </Button>
      </div>

      <div className="space-y-2.5">
        {walls.map((wall, idx) => {
          const wm = metrics.walls[idx];
          return (
            <div
              key={wall.id}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="mb-2.5 flex items-start justify-between gap-2">
                <Input
                  value={wall.name}
                  onChange={(e) =>
                    patchWall(wall.id, { name: e.target.value })
                  }
                  className="h-8 max-w-[220px] border-0 bg-slate-50 px-2 text-[13px] font-semibold shadow-none focus-visible:ring-1"
                  aria-label="Wall name"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => duplicateWall(wall)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Duplicate wall"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={walls.length <= 1}
                    onClick={() => removeWall(wall.id)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    aria-label="Remove wall"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <NumField
                  label="Length"
                  value={wall.lengthFt}
                  suffix="ft"
                  className="w-[88px]"
                  onChange={(n) => patchWall(wall.id, { lengthFt: n })}
                />
                <span className="mb-2 text-slate-300">×</span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Height
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {EXTERIOR_HEIGHT_PRESETS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        tabIndex={-1}
                        onClick={() => patchWall(wall.id, { heightFt: h })}
                        className={cn(
                          "h-8 min-w-8 rounded-lg border px-2 text-[12px] font-semibold tabular-nums transition-all",
                          wall.heightFt === h
                            ? "border-sky-500 bg-sky-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-sky-300"
                        )}
                      >
                        {h}
                      </button>
                    ))}
                    <NumberInput
                      min={0}
                      step={0.5}
                      value={wall.heightFt}
                      onChange={(n) =>
                        patchWall(wall.id, { heightFt: Math.max(0, n) })
                      }
                      className="h-8 w-14 px-1.5 text-center text-[13px] font-semibold"
                      aria-label="Custom height"
                    />
                    <span className="text-[11px] text-slate-400">ft</span>
                  </div>
                </div>
                <div className="ml-auto rounded-lg bg-slate-50 px-2.5 py-1.5 text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Gross
                  </div>
                  <div className="text-[15px] font-semibold tabular-nums text-slate-800">
                    {wm?.grossSqft.toLocaleString() ?? 0}
                    <span className="ml-1 text-[11px] font-medium text-slate-400">
                      sf
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-2.5">
                <label className="flex min-w-[180px] flex-col gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Paint as
                  </span>
                  <select
                    value={wall.surfaceKind}
                    onChange={(e) =>
                      patchWall(wall.id, {
                        surfaceKind: e.target.value as ExteriorSurfaceKind,
                      })
                    }
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-800"
                    title="Split walls into separate line items when materials or rates differ. Same material? Leave all as Main walls."
                  >
                    {SURFACE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {wall.surfaceKind === "custom" && (
                  <label className="flex min-w-[140px] flex-1 flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Material / label
                    </span>
                    <Input
                      value={wall.surfaceLabel ?? ""}
                      placeholder="e.g. Board & batten"
                      onChange={(e) =>
                        patchWall(wall.id, { surfaceLabel: e.target.value })
                      }
                      className="h-8 text-[12px]"
                    />
                  </label>
                )}
                {trimScope === "per_wall" && (
                  <NumField
                    label="Trim"
                    value={wall.trimLf ?? 0}
                    suffix="LF"
                    className="w-[96px]"
                    onChange={(n) => patchWall(wall.id, { trimLf: n })}
                  />
                )}
              </div>

              <div className="mt-2.5 space-y-1.5 rounded-lg bg-slate-50/80 p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Openings (deduct from siding)
                </div>
                <OpeningRow
                  label="Windows"
                  count={wall.openings.windows.count}
                  avgSqft={wall.openings.windows.avgSqft}
                  presetSqft={OPENING_SIZE_PRESETS.window.sqft}
                  onChange={(next) =>
                    patchWall(wall.id, {
                      openings: { ...wall.openings, windows: next },
                    })
                  }
                />
                <OpeningRow
                  label="Doors"
                  count={wall.openings.doors.count}
                  avgSqft={wall.openings.doors.avgSqft}
                  presetSqft={OPENING_SIZE_PRESETS.door.sqft}
                  onChange={(next) =>
                    patchWall(wall.id, {
                      openings: { ...wall.openings, doors: next },
                    })
                  }
                />
                <OpeningRow
                  label="Garage"
                  count={wall.openings.garageDoors.count}
                  avgSqft={wall.openings.garageDoors.avgSqft}
                  presetSqft={OPENING_SIZE_PRESETS.garage.sqft}
                  onChange={(next) =>
                    patchWall(wall.id, {
                      openings: { ...wall.openings, garageDoors: next },
                    })
                  }
                />
                {(wall.openings.other.count > 0 || !compact) && (
                  <OpeningRow
                    label={wall.openings.other.label || "Other"}
                    count={wall.openings.other.count}
                    avgSqft={wall.openings.other.avgSqft}
                    presetSqft={15}
                    onChange={(next) =>
                      patchWall(wall.id, {
                        openings: {
                          ...wall.openings,
                          other: { ...wall.openings.other, ...next },
                        },
                      })
                    }
                  />
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <span className="tabular-nums text-slate-500">
                  −{wm?.openingsSqft.toLocaleString() ?? 0} sf openings
                </span>
                <span className="font-semibold tabular-nums text-slate-900">
                  Net {wm?.netSqft.toLocaleString() ?? 0} sf
                  <span className="ml-1.5 font-normal text-slate-400">
                    · {surfaceKindLabel(wall.surfaceKind, wall.surfaceLabel)}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_55%)] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Trim
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {(
              [
                ["global", "Global LF"],
                ["per_wall", "Per wall"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onTrimScopeChange(value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  trimScope === value
                    ? "bg-sky-600 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {trimScope === "global" ? (
          <NumField
            label="Total trim"
            value={globalTrimLf}
            suffix="LF"
            className="max-w-[160px]"
            onChange={onGlobalTrimChange}
          />
        ) : (
          <p className="text-[12px] text-slate-500">
            Trim is entered on each wall and summed below.
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <TotalChip
            label="Net siding"
            value={`${metrics.netSqft.toLocaleString()} sf`}
            hint={`${metrics.grossSqft.toLocaleString()} gross − ${metrics.openingsSqft.toLocaleString()} open`}
          />
          <TotalChip
            label="Trim"
            value={`${metrics.trimLf.toLocaleString()} LF`}
          />
          <TotalChip label="Doors" value={String(metrics.doorCount)} />
          <TotalChip label="Windows" value={String(metrics.windowCount)} />
        </div>
        {metrics.garageDoorCount > 0 && (
          <div className="mt-1.5 text-[11px] text-slate-500">
            Garage doors {metrics.garageDoorCount} (deducted from siding only)
          </div>
        )}
        {metrics.bySurface.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {metrics.bySurface.map((g) => (
              <span
                key={g.key}
                className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900"
              >
                {g.label}: {g.netSqft.toLocaleString()} sf
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TotalChip({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-white px-2.5 py-2 shadow-sm ring-1 ring-slate-200/80">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-[16px] font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[10px] leading-snug text-slate-400">
          {hint}
        </div>
      )}
    </div>
  );
}

export function ExteriorModeToggle({
  mode,
  onChange,
}: {
  mode: ExteriorEstimateMode;
  onChange: (mode: ExteriorEstimateMode) => void;
}) {
  return (
    <div className="flex rounded-xl border border-slate-200 bg-white p-1">
      {(
        [
          ["simple", "Quick area"],
          ["walls", "Wall by wall"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors",
            mode === value
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
