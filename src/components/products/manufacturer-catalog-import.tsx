"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { EditableProduct } from "@/components/products/product-edit-modal";

const SUGGESTED_BRANDS = [
  "Sherwin-Williams",
  "Benjamin Moore",
  "Behr",
  "PPG",
  "Valspar",
] as const;

type ImportedProduct = EditableProduct & { updatedAt: string | Date };

type ItemRow = {
  index: number;
  name: string;
  status: "importing" | "imported" | "skipped" | "failed";
  reason?: string;
};

type ProgressEvent =
  | { type: "status"; message: string }
  | {
      type: "found";
      brand: string;
      website: string | null;
      total: number;
    }
  | {
      type: "item";
      index: number;
      total: number;
      name: string;
      status: "importing" | "imported" | "skipped" | "failed";
      reason?: string;
      product?: ImportedProduct;
    }
  | {
      type: "done";
      brand: string;
      imported: number;
      skipped: number;
      failed: number;
    }
  | { type: "error"; message: string };

export function ManufacturerCatalogImportButton({
  onImported,
}: {
  onImported: (products: ImportedProduct[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [manufacturer, setManufacturer] = useState("Sherwin-Williams");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [summary, setSummary] = useState<{
    imported: number;
    skipped: number;
    failed: number;
  } | null>(null);

  const doneCount = useMemo(
    () =>
      items.filter((i) =>
        ["imported", "skipped", "failed"].includes(i.status)
      ).length,
    [items]
  );

  const progressPct =
    total > 0 ? Math.min(100, Math.round((doneCount / total) * 100)) : running ? 8 : 0;

  function resetProgress() {
    setStatus("");
    setTotal(0);
    setItems([]);
    setSummary(null);
  }

  function close() {
    if (running) return;
    setOpen(false);
  }

  async function startImport() {
    const name = manufacturer.trim();
    if (name.length < 2) {
      toast.error("Enter a paint manufacturer");
      return;
    }

    resetProgress();
    setRunning(true);
    setStatus(`Searching ${name} official site…`);
    const imported: ImportedProduct[] = [];

    try {
      const res = await fetch("/api/ai/import-manufacturer-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manufacturer: name }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(
          (err as { error?: string } | null)?.error ||
            `Import failed (${res.status})`
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const event = JSON.parse(trimmed) as ProgressEvent;

          if (event.type === "status") {
            setStatus(event.message);
          } else if (event.type === "found") {
            setTotal(event.total);
            setStatus(
              `Found ${event.total} ${event.brand} products — adding to library…`
            );
          } else if (event.type === "item") {
            setItems((prev) => {
              const next = [...prev];
              const idx = next.findIndex((x) => x.index === event.index);
              const row: ItemRow = {
                index: event.index,
                name: event.name,
                status: event.status,
                reason: event.reason,
              };
              if (idx >= 0) next[idx] = row;
              else next.push(row);
              return next.sort((a, b) => a.index - b.index);
            });
            if (event.status === "imported" && event.product) {
              imported.push(event.product);
            }
            if (event.status === "importing") {
              setStatus(`Importing ${event.name}…`);
            }
          } else if (event.type === "done") {
            setSummary({
              imported: event.imported,
              skipped: event.skipped,
              failed: event.failed,
            });
            setStatus(
              `Done — ${event.imported} added, ${event.skipped} skipped` +
                (event.failed ? `, ${event.failed} failed` : "")
            );
            if (imported.length) onImported(imported);
            if (event.imported > 0) {
              toast.success(
                `Added ${event.imported} ${event.brand} product${event.imported === 1 ? "" : "s"}`
              );
            } else if (event.skipped > 0) {
              toast.message("All matching products were already in the library");
            }
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Manufacturer catalog import failed";
      setStatus(message);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        onClick={() => {
          resetProgress();
          setOpen(true);
        }}
      >
        <Sparkles className="size-3.5" />
        AI import
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-w-lg gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="text-base">
              Import manufacturer catalog
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              Enter a paint brand. AI searches their website and adds product
              lines to your library. Products you already have are skipped on
              re-import.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-4 py-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Manufacturer
              </Label>
              <Input
                className="mt-1 h-9"
                value={manufacturer}
                disabled={running}
                onChange={(e) => setManufacturer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !running) void startImport();
                }}
                placeholder="e.g. Sherwin-Williams"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTED_BRANDS.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    disabled={running}
                    onClick={() => setManufacturer(brand)}
                    className={cn(
                      "rounded border px-2 py-0.5 text-[11px] transition-colors",
                      manufacturer === brand
                        ? "border-sky-400 bg-sky-50 text-sky-900"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="truncate pr-2">
                  {status || "Ready to search manufacturer site"}
                </span>
                <span className="shrink-0 tabular-nums">
                  {total > 0 ? `${doneCount}/${total}` : running ? "…" : ""}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full bg-sky-500 transition-[width] duration-300",
                    running && total === 0 && "animate-pulse"
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {items.length > 0 ? (
              <div className="max-h-48 overflow-auto rounded-md border border-slate-200">
                <ul className="divide-y text-[12px]">
                  {items.map((item) => (
                    <li
                      key={item.index}
                      className="flex items-start justify-between gap-2 px-2.5 py-1.5"
                    >
                      <span className="min-w-0 truncate text-slate-800">
                        {item.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[11px]",
                          item.status === "imported" && "text-emerald-700",
                          item.status === "skipped" && "text-amber-700",
                          item.status === "failed" && "text-red-600",
                          item.status === "importing" && "text-sky-700"
                        )}
                      >
                        {item.status === "importing"
                          ? "…"
                          : item.status === "imported"
                            ? "Added"
                            : item.status === "skipped"
                              ? "Skip"
                              : "Fail"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {summary ? (
              <p className="text-[12px] text-muted-foreground">
                {summary.imported} added · {summary.skipped} skipped
                {summary.failed ? ` · ${summary.failed} failed` : ""}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={running}
              onClick={close}
            >
              {summary ? "Close" : "Cancel"}
            </Button>
            <Button
              size="sm"
              className="h-8"
              disabled={running || manufacturer.trim().length < 2}
              onClick={() => void startImport()}
            >
              {running ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  {summary ? "Import again" : "Find & import"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
