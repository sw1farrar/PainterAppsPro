"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  formatProjectColorLabel,
  isProjectColorComplete,
  resolveProjectColor,
  type ProjectColor,
} from "@/lib/project-colors";
import { AddProjectColorModal } from "@/components/estimator/add-project-color-modal";
import { cn } from "@/lib/utils";

function ColorChip({
  color,
  selected,
  onClick,
}: {
  color: ProjectColor;
  selected: boolean;
  onClick: () => void;
}) {
  const label = formatProjectColorLabel(color);
  return (
    <button
      type="button"
      onClick={onClick}
      title={[label, color.notes?.trim()].filter(Boolean).join(" · ")}
      className={cn(
        "inline-flex h-8 max-w-[240px] items-center gap-1.5 rounded-lg border px-2.5 text-left transition-all",
        selected
          ? "border-sky-500 bg-sky-600 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50"
      )}
    >
      <span
        className={cn(
          "min-w-0 truncate text-[12px] font-semibold",
          selected ? "text-white" : "text-slate-800"
        )}
      >
        {label || "Untitled"}
      </span>
      {color.notes?.trim() ? (
        <span
          className={cn(
            "shrink-0 truncate text-[10px] font-medium",
            selected ? "text-sky-100" : "text-slate-400"
          )}
        >
          {color.notes.trim()}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Pick a project color (or create one) for a surface.
 * Value is the project color id stored on the line item.
 */
export function ProjectColorField({
  value,
  projectColors,
  onProjectColorsChange,
  onChange,
}: {
  value: string | null | undefined;
  projectColors: ProjectColor[];
  onProjectColorsChange: (colors: ProjectColor[]) => void;
  onChange: (colorId: string | null) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const currentId = value?.trim() || "";
  const current = resolveProjectColor(currentId, projectColors);

  const colors = [...projectColors].sort((a, b) =>
    formatProjectColorLabel(a).localeCompare(
      formatProjectColorLabel(b),
      undefined,
      { numeric: true }
    )
  );

  return (
    <div className="space-y-2">
      {current && isProjectColorComplete(current) ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 text-[12px]">
          <span className="font-semibold text-emerald-900">
            {formatProjectColorLabel(current)}
          </span>
          {current.notes?.trim() ? (
            <span className="mt-0.5 block text-[11px] text-emerald-700/80">
              {current.notes.trim()}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <ColorChip
            key={c.id}
            color={c}
            selected={currentId === c.id}
            onClick={() => onChange(c.id)}
          />
        ))}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 text-[12px] font-semibold text-slate-600 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-800"
        >
          <Plus className="h-3.5 w-3.5" />
          New color
        </button>
        {currentId ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="h-8 rounded-lg px-2 text-[11px] font-medium text-slate-400 hover:text-slate-700"
          >
            Clear
          </button>
        ) : null}
      </div>

      {colors.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Add a color — it will apply to this surface. Same color + product +
          sheen share gallons across rooms.
        </p>
      ) : null}

      <AddProjectColorModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(color) => {
          // Assign to this surface first, then add to the project palette.
          onChange(color.id);
          const exists = projectColors.some((c) => c.id === color.id);
          onProjectColorsChange(
            exists
              ? projectColors.map((c) => (c.id === color.id ? color : c))
              : [...projectColors, color]
          );
        }}
      />
    </div>
  );
}

export function ColorSwatch({
  colorId,
  projectColors,
  className,
}: {
  colorId?: string | null;
  projectColors?: ProjectColor[];
  className?: string;
}) {
  const color = resolveProjectColor(colorId, projectColors ?? []);
  if (!color && !colorId) return null;
  const label = formatProjectColorLabel(color);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 truncate text-[11px] text-slate-600",
        className
      )}
      title={[label, color?.notes?.trim()].filter(Boolean).join(" · ") || undefined}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10 bg-stone-300" />
      <span className="truncate text-slate-800">
        {label || colorId || "—"}
      </span>
    </span>
  );
}
