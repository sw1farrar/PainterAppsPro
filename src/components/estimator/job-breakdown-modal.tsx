"use client";

import { useMemo } from "react";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import type { PaintPackagingResult } from "@/lib/paint-packaging";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/estimator/paint-color-field";
import type { ProjectColor } from "@/lib/project-colors";

export type BreakdownSurface = {
  description: string;
  measureLabel: string;
  coats: number;
  gallons: number;
  laborHours: number;
  prepHours: number;
  materialCost: number;
  laborCost: number;
  lineTotal: number;
  paintProductId?: string | null;
  sheen?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  productName?: string | null;
};

export type BreakdownRoom = {
  name: string;
  kind: string;
  surfaces: BreakdownSurface[];
};

type JobBreakdownModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  estimateNumber?: string | null;
  rooms: BreakdownRoom[];
  paintPackaging: PaintPackagingResult;
  projectColors?: ProjectColor[];
  jobTotals: {
    materials: number;
    labor: number;
    paintLaborHours: number;
    prepHours: number;
    totalHours: number;
    discount: number;
    paintEfficiencyDiscount: number;
    taxAmount: number;
    total: number;
  };
};

function shortLabel(description: string, roomName: string) {
  const prefix = `${roomName} — `;
  if (description.startsWith(prefix)) return description.slice(prefix.length);
  const i = description.indexOf(" — ");
  return i >= 0 ? description.slice(i + 3) : description;
}

type BreakdownLine = {
  key: string;
  productName: string;
  colorName: string | null;
  sheen: string | null;
  /** Order qty — whole gallons to buy (project packaging) */
  matQty: number;
  /** Billed cost per gallon (includes material markup) */
  costPerGallon: number | null;
  /** Material extended $ for order qty */
  matExt: number;
  /** Labor qty (hours) */
  laborQty: number;
  /** Labor extended $ */
  laborExt: number;
  detail: string;
};

function packageMatchKey(
  productId: string | null | undefined,
  sheen: string | null | undefined,
  colorName: string | null | undefined
) {
  return [
    productId ?? "",
    (sheen ?? "").trim().toLowerCase() || "—",
    (colorName ?? "").trim().toLowerCase() || "unspecified",
  ].join("||");
}

export function JobBreakdownModal({
  open,
  onOpenChange,
  title,
  estimateNumber,
  rooms,
  paintPackaging,
  projectColors = [],
  jobTotals,
}: JobBreakdownModalProps) {
  const lines = useMemo(() => {
    const laborByPackage = new Map<
      string,
      { hours: number; cost: number; details: string[] }
    >();

    for (const room of rooms) {
      for (const s of room.surfaces) {
        if (!s.paintProductId) continue;
        const key = packageMatchKey(s.paintProductId, s.sheen, s.colorName);
        const prev = laborByPackage.get(key) ?? {
          hours: 0,
          cost: 0,
          details: [],
        };
        prev.hours += s.laborHours + s.prepHours;
        prev.cost += s.laborCost;
        prev.details.push(
          `${room.name} · ${shortLabel(s.description, room.name)}`
        );
        laborByPackage.set(key, prev);
      }
    }

    const out: BreakdownLine[] = paintPackaging.projectPackages.map((pkg) => {
      const key = packageMatchKey(pkg.paintProductId, pkg.sheen, pkg.colorName);
      const labor = laborByPackage.get(key);
      const roomDetail = pkg.rooms.map((r) => r.roomName).join(", ");
      const matQty = pkg.projectPurchaseGallons;
      const matExt = pkg.projectMaterialCost;
      const costPerGallon =
        matQty > 0
          ? matExt / matQty
          : pkg.pricePerGallon > 0
            ? pkg.pricePerGallon
            : null;
      return {
        key,
        productName: pkg.productName,
        colorName: pkg.colorName,
        sheen: pkg.sheen,
        matQty,
        costPerGallon,
        matExt,
        laborQty: labor?.hours ?? 0,
        laborExt: labor?.cost ?? 0,
        detail: roomDetail || (labor?.details.slice(0, 3).join(" · ") ?? ""),
      };
    });

    // Labor-only surfaces (no paint product) still show
    for (const room of rooms) {
      for (const s of room.surfaces) {
        if (s.paintProductId) continue;
        const hours = s.laborHours + s.prepHours;
        if (hours <= 0 && s.laborCost <= 0) continue;
        out.push({
          key: `labor:${room.name}:${s.description}`,
          productName: s.productName?.trim() || shortLabel(s.description, room.name),
          colorName: null,
          sheen: null,
          matQty: 0,
          costPerGallon: null,
          matExt: 0,
          laborQty: hours,
          laborExt: s.laborCost,
          detail: room.name,
        });
      }
    }

    return out;
  }, [rooms, paintPackaging.projectPackages]);

  const matQtyTotal =
    paintPackaging.totalProjectPurchaseGallons ||
    lines.reduce((s, l) => s + l.matQty, 0);
  const matExtTotal =
    paintPackaging.projectMaterialTotal ||
    lines.reduce((s, l) => s + l.matExt, 0);
  const laborQtyTotal = lines.reduce((s, l) => s + l.laborQty, 0);
  const laborExtTotal = lines.reduce((s, l) => s + l.laborExt, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="left-[calc(50%+100px)] flex h-[min(85vh,720px)] w-[min(960px,calc(100vw-200px-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogHeader className="shrink-0 border-b px-5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-[16px] font-semibold tracking-tight">
                Cost breakdown
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[13px]">
                {title}
                {estimateNumber ? ` · ${estimateNumber}` : ""}
              </DialogDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {lines.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">
              No surfaces on this estimate yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2.5">Product / color</th>
                    <th className="px-3 py-2.5">Sheen</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">$/gal</th>
                    <th className="px-3 py-2.5 text-right">Ext</th>
                    <th className="px-3 py-2.5 text-right">Labor qty</th>
                    <th className="px-3 py-2.5 text-right">Ext</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr
                      key={line.key}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-800">
                          {line.productName}
                        </div>
                        <ColorSwatch
                          colorId={line.colorName}
                          projectColors={projectColors}
                          className="mt-0.5"
                        />
                        {line.detail ? (
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {line.detail}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {line.sheen || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {line.matQty > 0 ? (
                          <>
                            {formatNumber(line.matQty, 0)}
                            <span className="ml-0.5 text-[11px] text-slate-400">
                              gal
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {line.costPerGallon != null
                          ? formatCurrency(line.costPerGallon)
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">
                        {line.matExt > 0 ? formatCurrency(line.matExt) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {formatNumber(line.laborQty, 2)}
                        <span className="ml-0.5 text-[11px] text-slate-400">
                          hr
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">
                        {formatCurrency(line.laborExt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-slate-50 text-[12px] font-semibold">
                    <td className="px-3 py-2.5 text-slate-500" colSpan={2}>
                      Totals
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatNumber(matQtyTotal, 0)}
                      <span className="ml-0.5 text-[11px] font-normal text-slate-400">
                        gal
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-400">—</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatCurrency(matExtTotal)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatNumber(laborQtyTotal, 2)}
                      <span className="ml-0.5 text-[11px] font-normal text-slate-400">
                        hr
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatCurrency(laborExtTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {lines.length > 0 && (
            <div className="mt-4 flex flex-wrap items-baseline justify-end gap-x-5 gap-y-1 text-[13px]">
              {paintPackaging.efficiencyDiscount > 0 && (
                <span className="text-emerald-700">
                  Efficiency −
                  {formatCurrency(paintPackaging.efficiencyDiscount)}
                </span>
              )}
              {jobTotals.discount > 0 && (
                <span className="text-emerald-700">
                  Discount −{formatCurrency(jobTotals.discount)}
                </span>
              )}
              {jobTotals.taxAmount > 0 && (
                <span className="text-slate-600">
                  Tax {formatCurrency(jobTotals.taxAmount)}
                </span>
              )}
              <span className="text-[15px] font-bold tabular-nums text-slate-900">
                Total {formatCurrency(jobTotals.total)}
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
