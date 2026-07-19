"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Info,
  Pencil,
  Clock,
  Ruler,
} from "lucide-react";
import {
  deleteProductionRate,
  upsertProductionRate,
} from "@/lib/actions";
import { formatNumber } from "@/lib/calculations";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ProductionRateRow = {
  id: string;
  surfaceType: string;
  method: string;
  measurementType: string;
  ratePerManHour: number;
  firstCoatRate?: number | null;
  additionalCoatRate?: number | null;
  effective2CoatRate?: number | null;
  defaultCoats: number;
  notes: string | null;
  isActive: boolean;
};

const METHOD_OPTIONS = [
  "Brush/Roll",
  "Brush",
  "Roll",
  "Spray",
  "Spray+Backroll",
  "Hand",
];

function rateUnit(r: Pick<ProductionRateRow, "measurementType" | "surfaceType">) {
  if (r.measurementType === "area") return "sq ft/hr";
  const s = r.surfaceType.toLowerCase();
  if (s.includes("door")) return "doors/hr";
  if (s.includes("window")) return "windows/hr";
  if (s.includes("cabinet") && s.includes("linear")) return "LF/hr";
  if (s.includes("cabinet")) return "doors/hr";
  if (s.includes("mask") || s.includes("trim") || s.includes("crown"))
    return "LF/hr";
  if (s.includes("setup")) return "hr units";
  return "units/hr";
}

function hoursPerItemLabel(r: ProductionRateRow) {
  const rate = r.effective2CoatRate ?? r.ratePerManHour;
  if (r.measurementType !== "unit" || !rate || rate <= 0) return null;
  const s = r.surfaceType.toLowerCase();
  if (s.includes("door") || s.includes("window") || s.includes("cabinet")) {
    const hrs = 1 / rate;
    const unit = s.includes("window")
      ? "window"
      : s.includes("cabinet")
        ? "cabinet door"
        : "door";
    return `${formatNumber(hrs, 2)} hrs/${unit}`;
  }
  return null;
}

function groupKey(surfaceType: string) {
  const s = surfaceType.toLowerCase();
  if (
    s.includes("prep") ||
    s.includes("mask") ||
    s.includes("setup") ||
    s.includes("wallpaper")
  )
    return "Support";
  if (s.startsWith("exterior") || s.includes("garage") || s.includes("stucco"))
    return "Exterior";
  return "Interior";
}

function Tip({ label, tip }: { label: string; tip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex items-center gap-1 border-b border-dotted border-slate-400 text-left"
      >
        {label}
        <Info className="h-3 w-3 opacity-60" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-left leading-snug">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

function blankRate(): ProductionRateRow {
  return {
    id: "",
    surfaceType: "New Surface",
    method: "Brush/Roll",
    measurementType: "area",
    ratePerManHour: 90,
    firstCoatRate: null,
    additionalCoatRate: null,
    effective2CoatRate: 90,
    defaultCoats: 2,
    notes: null,
    isActive: true,
  };
}

function previewHours(r: ProductionRateRow, measure: number, coats: number) {
  const first = r.firstCoatRate;
  const add = r.additionalCoatRate;
  const eff2 = r.effective2CoatRate;
  const fallback = r.ratePerManHour || 100;

  if (measure <= 0) return { hours: 0, formula: "Enter a sample measure" };

  if (first != null && first > 0 && add != null && add > 0) {
    const firstHrs = measure / first;
    const addHrs = coats > 1 ? ((coats - 1) * measure) / add : 0;
    const hours = firstHrs + addHrs;
    return {
      hours,
      formula: `(${measure} ÷ ${first}/hr first${
        coats > 1 ? ` + ${coats - 1} × ${measure} ÷ ${add}/hr add` : ""
      }) = ${formatNumber(hours)} hrs`,
    };
  }
  if (eff2 != null && eff2 > 0 && coats === 2) {
    const hours = measure / eff2;
    return {
      hours,
      formula: `${measure} ÷ ${eff2} (2-coat rate) = ${formatNumber(hours)} hrs`,
    };
  }
  if (eff2 != null && eff2 > 0) {
    const hours = (measure * coats) / (eff2 * 2);
    return {
      hours,
      formula: `(${measure} × ${coats} coats) ÷ (${eff2}×2) = ${formatNumber(hours)} hrs`,
    };
  }
  const hours = (measure * coats) / fallback;
  return {
    hours,
    formula: `(${measure} × ${coats}) ÷ ${fallback}/hr = ${formatNumber(hours)} hrs`,
  };
}

export function ProductionRatesPanel({
  rates: initialRates,
}: {
  rates: ProductionRateRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rates, setRates] = useState(initialRates);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<ProductionRateRow | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    setRates(initialRates);
  }, [initialRates]);

  const visible = useMemo(
    () => rates.filter((r) => showInactive || r.isActive),
    [rates, showInactive]
  );

  const groups = useMemo(() => {
    const order = ["Interior", "Exterior", "Support"] as const;
    const map = new Map<string, ProductionRateRow[]>();
    for (const key of order) map.set(key, []);
    for (const r of visible) {
      const g = groupKey(r.surfaceType);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(r);
    }
    return order
      .map((name) => ({ name, rows: map.get(name) ?? [] }))
      .filter((g) => g.rows.length > 0);
  }, [visible]);

  function openEdit(r: ProductionRateRow) {
    setIsNew(false);
    setEditing({ ...r });
  }

  function openNew() {
    setIsNew(true);
    setEditing(blankRate());
  }

  function saveEditing() {
    if (!editing) return;
    const data = editing;
    start(async () => {
      await upsertProductionRate(isNew ? null : data.id || null, {
        surfaceType: data.surfaceType.trim() || "Surface",
        method: data.method,
        measurementType: data.measurementType,
        ratePerManHour: data.ratePerManHour,
        firstCoatRate: data.firstCoatRate ?? null,
        additionalCoatRate: data.additionalCoatRate ?? null,
        effective2CoatRate: data.effective2CoatRate ?? null,
        defaultCoats: data.defaultCoats,
        notes: data.notes,
        isActive: data.isActive,
      });
      toast.success(isNew ? "Rate added" : "Rate saved");
      setEditing(null);
      router.refresh();
    });
  }

  function removeRate(r: ProductionRateRow) {
    start(async () => {
      await deleteProductionRate(r.id);
      setRates((prev) => prev.filter((x) => x.id !== r.id));
      if (editing?.id === r.id) setEditing(null);
      toast.success("Rate deleted");
      router.refresh();
    });
  }

  return (
    <TooltipProvider delay={200}>
      <div className="space-y-3">
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-[13px] text-sky-950">
          <p className="font-semibold">How production rates work</p>
          <p className="mt-1 text-[12px] leading-relaxed text-sky-900/90">
            Each row is how fast your crew finishes a surface. Labor hours =
            measure ÷ rate. Prefer setting the{" "}
            <strong>2-coat rate</strong> for your normal residential job; optional{" "}
            <strong>1st / Add</strong> rates split first vs second coat when you
            need more precision.
          </p>
          <ul className="mt-2 grid gap-1 text-[12px] text-sky-900/85 sm:grid-cols-3">
            <li>
              <span className="font-medium">Area</span> — sq ft per man-hour
              (walls, ceilings)
            </li>
            <li>
              <span className="font-medium">LF unit</span> — linear feet per
              man-hour (trim, crown, masking)
            </li>
            <li>
              <span className="font-medium">Item unit</span> — items per
              man-hour (doors, windows). Tip: 1.25 hrs/door → rate 0.8
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-muted-foreground">
            Click a row to edit. Calibrate from real crew hours — accuracy
            compounds on every estimate.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-slate-600 select-none">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-sky-600"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive
            </label>
            <Button size="sm" variant="outline" className="h-8" onClick={openNew}>
              <Plus className="size-3.5" />
              Add rate
            </Button>
          </div>
        </div>

        {groups.map((group) => (
          <section
            key={group.name}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                {group.name}
              </h3>
              <span className="text-[11px] tabular-nums text-slate-400">
                {group.rows.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5">Surface</th>
                    <th className="px-3 py-2.5">Method</th>
                    <th className="px-3 py-2.5">
                      <Tip
                        label="Type"
                        tip="Area = square feet. Unit = doors, windows, or linear feet depending on the surface."
                      />
                    </th>
                    <th className="px-3 py-2.5 text-right">
                      <Tip
                        label="Rate"
                        tip="Primary production: how much measure your crew finishes per man-hour. Used when 1st/Add/2-coat are blank, or as fallback."
                      />
                    </th>
                    <th className="px-3 py-2.5 text-right">
                      <Tip
                        label="1st"
                        tip="Optional first-coat production (same units as Rate). When both 1st and Add are set: hours = measure÷1st + (coats−1)×measure÷Add."
                      />
                    </th>
                    <th className="px-3 py-2.5 text-right">
                      <Tip
                        label="Add"
                        tip="Optional additional-coat production (coats after the first). Usually faster than the first coat."
                      />
                    </th>
                    <th className="px-3 py-2.5 text-right">
                      <Tip
                        label="2-ct"
                        tip="Blended production for a normal 2-coat job. When coats = 2: hours = measure ÷ 2-coat rate. Best field to calibrate for residential work."
                      />
                    </th>
                    <th className="px-3 py-2.5 text-right">
                      <Tip
                        label="Coats"
                        tip="Default coat count when this surface is added to a room."
                      />
                    </th>
                    <th className="w-10 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((r) => {
                    const unit = rateUnit(r);
                    const perItem = hoursPerItemLabel(r);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => openEdit(r)}
                        className={cn(
                          "cursor-pointer border-b last:border-b-0 transition-colors hover:bg-sky-50/70",
                          !r.isActive && "opacity-50"
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-900">
                            {r.surfaceType}
                          </div>
                          {r.notes ? (
                            <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                              {r.notes}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{r.method}</td>
                        <td className="px-3 py-2.5">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                            {r.measurementType}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          <div className="font-semibold">
                            {formatNumber(r.ratePerManHour, 2)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {unit}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {r.firstCoatRate != null
                            ? formatNumber(r.firstCoatRate, 2)
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {r.additionalCoatRate != null
                            ? formatNumber(r.additionalCoatRate, 2)
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {r.effective2CoatRate != null ? (
                            <>
                              <div className="font-semibold text-sky-800">
                                {formatNumber(r.effective2CoatRate, 2)}
                              </div>
                              {perItem ? (
                                <div className="text-[10px] text-muted-foreground">
                                  {perItem}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {r.defaultCoats}
                        </td>
                        <td className="px-2 py-2.5 text-slate-400">
                          <Pencil className="mx-auto h-3.5 w-3.5" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {editing && (
          <RateEditorModal
            rate={editing}
            isNew={isNew}
            pending={pending}
            onChange={setEditing}
            onClose={() => setEditing(null)}
            onSave={saveEditing}
            onDelete={
              !isNew && editing.id
                ? () => removeRate(editing)
                : undefined
            }
          />
        )}
      </div>
    </TooltipProvider>
  );
}

function RateEditorModal({
  rate,
  isNew,
  pending,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  rate: ProductionRateRow;
  isNew: boolean;
  pending: boolean;
  onChange: (r: ProductionRateRow) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const unit = rateUnit(rate);
  const sampleMeasure =
    rate.measurementType === "area"
      ? 300
      : rate.surfaceType.toLowerCase().includes("trim") ||
          rate.surfaceType.toLowerCase().includes("crown") ||
          rate.surfaceType.toLowerCase().includes("mask")
        ? 80
        : 2;
  const coats = rate.defaultCoats || 2;
  const preview = previewHours(rate, sampleMeasure, coats);
  const perItem = hoursPerItemLabel(rate);

  function patch(p: Partial<ProductionRateRow>) {
    onChange({ ...rate, ...p });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(90vh,820px)] w-[min(720px,calc(100vw-1.5rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogHeader className="shrink-0 border-b px-5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-[16px] font-semibold">
                {isNew ? "Add production rate" : "Edit production rate"}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[13px]">
                {isNew
                  ? "Define how fast your crew finishes this surface."
                  : rate.surfaceType}
              </DialogDescription>
            </div>
            <Button size="sm" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Surface name"
              tip="Must match the surface type used on estimates (e.g. Interior Walls Smooth)."
            >
              <Input
                value={rate.surfaceType}
                onChange={(e) => patch({ surfaceType: e.target.value })}
                className="h-9"
              />
            </Field>
            <Field label="Method" tip="Application method for this rate row.">
              <select
                className="flex h-9 w-full rounded-md border bg-background px-2 text-[13px]"
                value={rate.method}
                onChange={(e) => patch({ method: e.target.value })}
              >
                {METHOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                {!METHOD_OPTIONS.includes(rate.method) && (
                  <option value={rate.method}>{rate.method}</option>
                )}
              </select>
            </Field>
            <Field
              label="Measure type"
              tip="Area = sq ft. Unit = doors/windows/LF — the Rate field uses matching units."
            >
              <select
                className="flex h-9 w-full rounded-md border bg-background px-2 text-[13px]"
                value={rate.measurementType}
                onChange={(e) => patch({ measurementType: e.target.value })}
              >
                <option value="area">Area (sq ft)</option>
                <option value="unit">Unit (doors, windows, or LF)</option>
              </select>
            </Field>
            <Field
              label="Default coats"
              tip="Coat count applied when this surface is first added to a room."
            >
              <NumberInput
                integer
                min={1}
                max={6}
                className="h-9"
                value={rate.defaultCoats}
                emptyValue={1}
                onChange={(defaultCoats) =>
                  patch({ defaultCoats: Math.min(6, Math.max(1, defaultCoats)) })
                }
              />
            </Field>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              <Ruler className="h-3.5 w-3.5" />
              Production ({unit})
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={`Primary rate (${unit})`}
                tip="Fallback production per man-hour. Also used when optional coat rates are empty."
              >
                <NumberInput
                  step="0.01"
                  className="h-9"
                  value={rate.ratePerManHour}
                  onChange={(ratePerManHour) => patch({ ratePerManHour })}
                />
              </Field>
              <Field
                label={`2-coat rate (${unit})`}
                tip="Best for residential calibrating. When coats = 2: hours = measure ÷ this rate."
              >
                <NumberInput
                  nullable
                  step="0.01"
                  className="h-9"
                  value={rate.effective2CoatRate}
                  placeholder="Optional"
                  onChange={(effective2CoatRate) =>
                    patch({ effective2CoatRate })
                  }
                />
              </Field>
              <Field
                label={`1st coat rate (${unit})`}
                tip="Optional. Production for the first coat only. Requires Add rate too."
              >
                <NumberInput
                  nullable
                  step="0.01"
                  className="h-9"
                  value={rate.firstCoatRate}
                  placeholder="Optional"
                  onChange={(firstCoatRate) => patch({ firstCoatRate })}
                />
              </Field>
              <Field
                label={`Additional coat rate (${unit})`}
                tip="Optional. Production for coats after the first (usually faster)."
              >
                <NumberInput
                  nullable
                  step="0.01"
                  className="h-9"
                  value={rate.additionalCoatRate}
                  placeholder="Optional"
                  onChange={(additionalCoatRate) =>
                    patch({ additionalCoatRate })
                  }
                />
              </Field>
            </div>
            {perItem && (
              <p className="mt-2 text-[12px] text-sky-800">
                Equivalent: <strong>{perItem}</strong> at the 2-coat / primary
                rate.
              </p>
            )}
          </div>

          <Field label="Notes" tip="Shown in the rates list for your crew.">
            <Textarea
              value={rate.notes ?? ""}
              onChange={(e) => patch({ notes: e.target.value || null })}
              rows={2}
              className="text-[13px]"
              placeholder="e.g. Includes jambs; moderate cut-in"
            />
          </Field>

          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] select-none">
            <input
              type="checkbox"
              className="h-4 w-4 accent-sky-600"
              checked={rate.isActive}
              onChange={(e) => patch({ isActive: e.target.checked })}
            />
            Active (available when assigning rates on estimates)
          </label>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-emerald-800">
              <Clock className="h-3.5 w-3.5" />
              Live hours preview
            </div>
            <p className="mt-1.5 text-[13px] text-emerald-950">
              Sample:{" "}
              <strong>
                {sampleMeasure}{" "}
                {rate.measurementType === "area" ? "sq ft" : "units"}
              </strong>
              , <strong>{coats} coats</strong>
            </p>
            <p className="mt-1 font-mono text-[12px] text-emerald-900/90">
              {preview.formula}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-5 py-3">
          {onDelete ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={onDelete}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={pending} onClick={onSave}>
              {isNew ? "Add rate" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  tip,
  children,
}: {
  label: string;
  tip?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Label className="text-[12px]">{label}</Label>
        {tip ? (
          <Tooltip>
            <TooltipTrigger
              type="button"
              className="text-muted-foreground hover:text-foreground"
            >
              <Info className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-left leading-snug">
              {tip}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {children}
    </div>
  );
}
