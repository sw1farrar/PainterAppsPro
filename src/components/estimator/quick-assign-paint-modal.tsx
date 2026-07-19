"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Palette } from "lucide-react";
import type { ProjectColor } from "@/lib/project-colors";
import { ProjectColorField } from "@/components/estimator/paint-color-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QuickAssignSurface = {
  _key: string;
  label: string;
  surfaceType: string | null;
  featureKey?: string | null;
  paintProductId: string | null;
  productName: string | null;
  sheen: string | null;
  /** Project color id */
  colorName: string | null;
  sheenOptions: string[];
};

type DraftRow = {
  sheen: string | null;
  colorName: string | null;
};

/**
 * Bulk-assign sheen + project colors for every surface in a room.
 */
export function QuickAssignPaintModal({
  open,
  surfaces,
  projectColors,
  onProjectColorsChange,
  roomName,
  stepLabel,
  nextRoomName,
  primaryLabel = "Apply to surfaces",
  onApply,
  onClose,
}: {
  open: boolean;
  surfaces: QuickAssignSurface[];
  projectColors: ProjectColor[];
  onProjectColorsChange: (colors: ProjectColor[]) => void;
  roomName?: string;
  stepLabel?: string;
  nextRoomName?: string;
  primaryLabel?: string;
  onApply: (
    updates: Array<{ _key: string; sheen: string | null; colorName: string | null }>
  ) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  // Stable while editing one room — don't reset drafts when projectColors updates
  // (that remounts `surfaces` and was wiping a newly assigned color).
  const surfaceKeys = surfaces.map((s) => s._key).join("|");

  useEffect(() => {
    if (!open) return;
    const next: Record<string, DraftRow> = {};
    for (const s of surfaces) {
      next[s._key] = {
        sheen: s.sheen,
        colorName: s.colorName,
      };
    }
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init on open / room change only
  }, [open, surfaceKeys]);

  function patchRow(key: string, patch: Partial<DraftRow>) {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { sheen: null, colorName: null }), ...patch },
    }));
  }

  function fillSheens() {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const s of surfaces) {
        const cur = next[s._key] ?? { sheen: null, colorName: null };
        let sheen = cur.sheen;
        if (!sheen && s.sheenOptions.length > 0) {
          sheen = s.sheenOptions[0];
        }
        next[s._key] = { ...cur, sheen };
      }
      return next;
    });
  }

  function handleApply() {
    onApply(
      surfaces.map((s) => ({
        _key: s._key,
        sheen: drafts[s._key]?.sheen ?? null,
        colorName: drafts[s._key]?.colorName ?? null,
      }))
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-assign-paint-title"
        className="flex max-h-[min(85vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-background shadow-xl"
      >
        <div className="shrink-0 border-b bg-[linear-gradient(145deg,#f7fafc_0%,#eef5fa_48%,#e7f0f7_100%)] px-5 py-4">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Palette className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h2
                  id="quick-assign-paint-title"
                  className="text-xl font-semibold tracking-tight text-slate-900"
                >
                  {roomName || "Quick assign"}
                </h2>
                {stepLabel ? (
                  <div className="rounded-md bg-sky-100/80 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-sky-800">
                    {stepLabel}
                  </div>
                ) : null}
              </div>
              <p className="mt-0.5 text-[12px] font-medium text-slate-500">
                Quick assign colors & sheens
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                {roomName
                  ? `Set sheen and color for every surface in ${roomName}.`
                  : "Set sheen and color for every surface in this room."}{" "}
                Colors are shared across the project for gallon packaging.
                {nextRoomName ? (
                  <>
                    {" "}
                    <span className="font-semibold text-slate-700">
                      Next: {nextRoomName}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {surfaces.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Add surfaces first, then assign colors and sheens.
            </p>
          ) : (
            surfaces.map((s) => {
              const draft = drafts[s._key] ?? {
                sheen: s.sheen,
                colorName: s.colorName,
              };
              const colorSet = Boolean(draft.colorName?.trim());
              const sheenSet =
                s.sheenOptions.length === 0 || Boolean(draft.sheen);
              const assigned = colorSet && sheenSet;
              return (
                <div
                  key={s._key}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm"
                >
                  <div className="mb-2 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-slate-900">
                        {s.label}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
                        {s.productName || "No product"}
                      </div>
                    </div>
                    {assigned ? (
                      <CheckCircle2
                        className="mt-0.5 h-7 w-7 shrink-0 text-emerald-600"
                        aria-label="Assigned"
                        strokeWidth={2.25}
                      />
                    ) : null}
                  </div>

                  <div className="mb-3">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Sheen
                    </div>
                    {s.sheenOptions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {s.sheenOptions.map((name) => {
                          const selected = draft.sheen === name;
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() =>
                                patchRow(s._key, {
                                  sheen: selected ? null : name,
                                })
                              }
                              className={cn(
                                "h-8 rounded-lg border px-2.5 text-[12px] font-semibold transition-all",
                                selected
                                  ? "border-sky-500 bg-sky-600 text-white shadow-sm"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                              )}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        No sheen options
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Color
                    </div>
                    <ProjectColorField
                      value={draft.colorName}
                      projectColors={projectColors}
                      onProjectColorsChange={onProjectColorsChange}
                      onChange={(colorId) =>
                        patchRow(s._key, { colorName: colorId })
                      }
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-5 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={surfaces.length === 0}
            onClick={fillSheens}
          >
            Fill sheens
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={surfaces.length === 0}
              onClick={handleApply}
            >
              {primaryLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
