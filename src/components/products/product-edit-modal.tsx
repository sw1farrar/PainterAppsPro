"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Trash2,
  X,
  Sparkles,
  Loader2,
  Upload,
  ClipboardPaste,
} from "lucide-react";
import {
  upsertPaintProduct,
  deletePaintProduct,
  lookupPaintProductAttributes,
  uploadPaintProductCanImage,
} from "@/lib/actions";
import { scaleImageToCanSlot } from "@/lib/can-image-scale";
import { PAINT_PRODUCT_CATEGORIES, paintProductCategoryLabel } from "@/lib/paint-product-category";
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

/** Optional quick-add suggestions — products can use any sheen names. */
const SUGGESTED_SHEENS = [
  "Flat",
  "Matte",
  "Eggshell",
  "Satin",
  "Semi-Gloss",
  "Gloss",
] as const;

export type ProductSheen = {
  id?: string;
  name: string;
  sortOrder?: number;
};

export type EditableProduct = {
  id: string;
  name: string;
  brand: string;
  coverageSqftPerGallon: number;
  pricePerGallon: number;
  sheen: string | null;
  sheens: ProductSheen[];
  category: string;
  defaultSurfaceType: string | null;
  features?: string | null;
  canImageUrl?: string | null;
  notes: string | null;
  isActive: boolean;
  updatedAt?: string | Date;
};

function moneyText(n: number) {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

function sheenNames(p: Pick<EditableProduct, "sheens">) {
  return p.sheens.map((s) => s.name);
}

export function ProductEditModal({
  product,
  open,
  onOpenChange,
  defaultSpreadRating = 375,
  onSaved,
  onDeleted,
  contentClassName,
  overlayClassName,
}: {
  product: EditableProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSpreadRating?: number;
  onSaved: (product: EditableProduct) => void;
  onDeleted: (id: string) => void;
  contentClassName?: string;
  overlayClassName?: string;
}) {
  const [pending, start] = useTransition();
  const [aiPending, startAi] = useTransition();
  const [uploadPending, startUpload] = useTransition();
  const [draft, setDraft] = useState<EditableProduct | null>(null);
  const [sheenDraft, setSheenDraft] = useState("");
  const [priceDraft, setPriceDraft] = useState("50.00");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteZoneRef = useRef<HTMLDivElement>(null);
  const [pasteFocused, setPasteFocused] = useState(false);
  const busy = pending || aiPending || uploadPending;

  useEffect(() => {
    if (!open || !product) {
      setDraft(null);
      return;
    }
    setDraft({
      ...product,
      sheens: [...product.sheens],
      features: product.features ?? "",
      canImageUrl: product.canImageUrl ?? null,
    });
    setPriceDraft(moneyText(product.pricePerGallon));
    setSheenDraft("");
  }, [open, product]);

  const view =
    draft ??
    (product
      ? {
          ...product,
          sheens: [...product.sheens],
          features: product.features ?? "",
          canImageUrl: product.canImageUrl ?? null,
        }
      : null);

  function addSheen(rawName: string) {
    if (!view) return;
    const name = rawName.trim();
    if (!name) return;
    if (
      sheenNames(view).some((s) => s.toLowerCase() === name.toLowerCase())
    ) {
      setSheenDraft("");
      return;
    }
    const nextSheens = [...view.sheens, { name }];
    setDraft({
      ...view,
      sheens: nextSheens,
      sheen: nextSheens[0]?.name ?? name,
    });
    setSheenDraft("");
  }

  function removeSheen(name: string) {
    if (!view) return;
    const nextSheens = view.sheens.filter((s) => s.name !== name);
    setDraft({
      ...view,
      sheens: nextSheens,
      sheen: nextSheens[0]?.name ?? null,
    });
  }

  function runAiLookup() {
    if (!view) return;
    startAi(async () => {
      try {
        const result = await lookupPaintProductAttributes({
          name: view.name,
          brand: view.brand,
        });
        const nextSheens =
          result.sheens?.length
            ? result.sheens.map((name) => ({ name }))
            : view.sheens;
        setDraft({
          ...view,
          features: result.features?.trim() || view.features || "",
          coverageSqftPerGallon:
            result.coverageSqftPerGallon ?? view.coverageSqftPerGallon,
          sheens: nextSheens,
          sheen: nextSheens[0]?.name ?? view.sheen,
          category: result.category ?? view.category,
          notes: result.notes?.trim()
            ? [view.notes, result.notes].filter(Boolean).join("\n").trim()
            : view.notes,
        });
        toast.success("Product attributes filled from manufacturer");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "AI product lookup failed"
        );
      }
    });
  }

  function uploadCanImageFile(file: File) {
    if (!view) return;
    startUpload(async () => {
      try {
        const scaled = await scaleImageToCanSlot(file);
        const fd = new FormData();
        fd.set("file", scaled, "can.jpg");
        const { path } = await uploadPaintProductCanImage(view.id, fd);
        setDraft({
          ...view,
          canImageUrl: `${path}?v=${Date.now()}`,
        });
        toast.success("Can image uploaded");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not upload can image"
        );
      }
    });
  }

  function onCanImageFileChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    uploadCanImageFile(file);
  }

  function imageFileFromClipboard(data: DataTransfer | null): File | null {
    if (!data) return null;
    for (const item of Array.from(data.items ?? [])) {
      if (item.type.startsWith("image/")) {
        return item.getAsFile();
      }
    }
    for (const file of Array.from(data.files ?? [])) {
      if (file.type.startsWith("image/")) return file;
    }
    return null;
  }

  function onCanImagePaste(e: React.ClipboardEvent) {
    const file = imageFileFromClipboard(e.clipboardData);
    if (!file) return;
    e.preventDefault();
    e.stopPropagation();
    uploadCanImageFile(file);
  }

  async function pasteCanImageFromClipboard() {
    if (!view || busy) return;

    // Prefer async clipboard API (works after a user gesture)
    if (navigator.clipboard?.read) {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find((t) => t.startsWith("image/"));
          if (!type) continue;
          const blob = await item.getType(type);
          const ext = type.split("/")[1] || "png";
          uploadCanImageFile(
            new File([blob], `clipboard.${ext}`, { type })
          );
          return;
        }
        toast.error("No image on the clipboard — copy a photo first");
        return;
      } catch {
        // Fall through to focus + Ctrl+V
      }
    }

    pasteZoneRef.current?.focus();
    toast.message("Paste zone focused — press Ctrl+V (⌘V) to paste");
  }

  function save() {
    if (!view) return;
    const n = parseFloat(priceDraft);
    const fixed = moneyText(Number.isFinite(n) ? n : view.pricePerGallon);
    const next: EditableProduct = {
      ...view,
      pricePerGallon: parseFloat(fixed),
      features: view.features ?? "",
      canImageUrl: view.canImageUrl?.trim().split("?")[0] || null,
    };

    start(async () => {
      try {
        const saved = await upsertPaintProduct(next.id, {
          name: next.name.trim() || "Untitled product",
          brand: next.brand.trim() || "Sherwin-Williams",
          coverageSqftPerGallon:
            next.coverageSqftPerGallon || defaultSpreadRating,
          pricePerGallon: next.pricePerGallon,
          sheens: sheenNames(next),
          category: next.category,
          defaultSurfaceType: next.defaultSurfaceType,
          features: next.features ?? "",
          canImageUrl: next.canImageUrl,
          notes: next.notes,
          isActive: next.isActive,
        });
        const updated: EditableProduct = {
          ...next,
          id: saved.id,
          name: saved.name,
          brand: saved.brand,
          coverageSqftPerGallon: saved.coverageSqftPerGallon,
          pricePerGallon: saved.pricePerGallon,
          sheen: saved.sheen,
          sheens: saved.sheens,
          category: saved.category ?? "both",
          defaultSurfaceType: saved.defaultSurfaceType ?? null,
          features: saved.features ?? "",
          canImageUrl: saved.canImageUrl ?? null,
          notes: saved.notes,
          isActive: saved.isActive,
          updatedAt: saved.updatedAt,
        };
        onSaved(updated);
        onOpenChange(false);
        toast.success("Product saved");
      } catch {
        toast.error("Could not save product");
      }
    });
  }

  function remove() {
    if (!view) return;
    start(async () => {
      try {
        await deletePaintProduct(view.id);
        onDeleted(view.id);
        onOpenChange(false);
        toast.success("Product deleted");
      } catch {
        toast.error("Could not delete product");
      }
    });
  }

  if (!view) return null;

  const suggestedAvailable = SUGGESTED_SHEENS.filter(
    (name) =>
      !sheenNames(view).some((s) => s.toLowerCase() === name.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName={overlayClassName}
        className={cn(
          // Center in the main content area (sidebar is 200px wide).
          "left-[calc(50%+100px)] flex h-[min(88vh,720px)] w-[min(720px,calc(100vw-200px-1.5rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none",
          contentClassName
        )}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle className="text-[15px] font-semibold">
                Edit product
              </DialogTitle>
              <DialogDescription className="truncate text-[12px]">
                {view.name || "Untitled product"}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-[12px]"
                disabled={busy}
                onClick={runAiLookup}
                title="Look up attributes on the manufacturer website via Grok"
              >
                {aiPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                AI fill
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          <div className="grid gap-3 sm:grid-cols-[112px_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                Can image
              </Label>
              <div
                ref={pasteZoneRef}
                tabIndex={0}
                role="button"
                aria-label="Can image paste zone. Click, then press Control V to paste."
                onPaste={onCanImagePaste}
                onFocus={() => setPasteFocused(true)}
                onBlur={() => setPasteFocused(false)}
                onClick={() => pasteZoneRef.current?.focus()}
                className={cn(
                  "relative flex aspect-[3/4] cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-slate-50 outline-none transition-shadow",
                  pasteFocused
                    ? "border-sky-400 ring-2 ring-sky-200"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                {view.canImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={view.canImageUrl}
                    alt={`${view.name} can`}
                    className="pointer-events-none h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 px-2 text-center text-muted-foreground">
                    <ClipboardPaste className="size-5 opacity-60" />
                    <span className="text-[10px] font-medium leading-tight text-slate-600">
                      Paste image here
                    </span>
                    <span className="text-[9px] leading-tight">
                      Ctrl+V / ⌘V
                    </span>
                  </div>
                )}
                {uploadPending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <Loader2 className="size-5 animate-spin text-sky-600" />
                  </div>
                )}
              </div>
              <p className="text-center text-[9px] leading-tight text-muted-foreground">
                {pasteFocused
                  ? "Ready — press Ctrl+V"
                  : "Click preview, then paste"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onCanImageFileChange(e.target.files)}
              />
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload photo"
                  aria-label="Upload photo"
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors",
                    "hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800",
                    "disabled:pointer-events-none disabled:opacity-50"
                  )}
                >
                  {uploadPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void pasteCanImageFromClipboard()}
                  title="Paste from clipboard"
                  aria-label="Paste from clipboard"
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors",
                    "hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800",
                    "disabled:pointer-events-none disabled:opacity-50"
                  )}
                >
                  {uploadPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ClipboardPaste className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-[11px] text-muted-foreground">Name</Label>
                <Input
                  className="mt-1 h-8"
                  value={view.name}
                  onChange={(e) => setDraft({ ...view, name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Brand</Label>
                <Input
                  className="mt-1 h-8"
                  value={view.brand}
                  onChange={(e) => setDraft({ ...view, brand: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Product type
                </Label>
                <select
                  className="mt-1 flex h-8 w-full rounded-md border bg-background px-2 text-[13px]"
                  value={view.category}
                  onChange={(e) =>
                    setDraft({ ...view, category: e.target.value })
                  }
                >
                  {PAINT_PRODUCT_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {paintProductCategoryLabel(value)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Spread (sf/gal)
                </Label>
                <NumberInput
                  className="mt-1 h-8"
                  title="Square feet covered per gallon"
                  value={view.coverageSqftPerGallon}
                  onChange={(coverageSqftPerGallon) =>
                    setDraft({ ...view, coverageSqftPerGallon })
                  }
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Price / gallon
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  className="mt-1 h-8 tabular-nums"
                  value={priceDraft}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d.]/g, "");
                    setPriceDraft(raw);
                    const n = parseFloat(raw);
                    if (!Number.isNaN(n)) {
                      setDraft({ ...view, pricePerGallon: n });
                    }
                  }}
                  onBlur={() => {
                    const n = parseFloat(priceDraft);
                    const fixed = moneyText(
                      Number.isFinite(n) ? n : view.pricePerGallon
                    );
                    setPriceDraft(fixed);
                    setDraft({
                      ...view,
                      pricePerGallon: parseFloat(fixed),
                    });
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3">
            <Label className="text-[11px] text-muted-foreground">Features</Label>
            <Textarea
              className="mt-1 min-h-[72px] text-[12px] leading-snug"
              value={view.features ?? ""}
              onChange={(e) =>
                setDraft({ ...view, features: e.target.value })
              }
              placeholder="Product features from the manufacturer…"
            />
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Available sheens
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {view.sheens.length === 0 ? (
                <span className="text-[11px] text-muted-foreground">
                  None yet — add below
                </span>
              ) : (
                view.sheens.map((s) => (
                  <span
                    key={s.name}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white py-0.5 pl-2.5 pr-1 text-[12px]"
                  >
                    {s.name}
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-slate-100 hover:text-destructive"
                      title={`Remove ${s.name}`}
                      onClick={() => removeSheen(s.name)}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex gap-1.5">
              <Input
                className="h-8 flex-1"
                placeholder="Add sheen…"
                value={sheenDraft}
                onChange={(e) => setSheenDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSheen(sheenDraft);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-8"
                onClick={() => addSheen(sheenDraft)}
                disabled={!sheenDraft.trim()}
              >
                Add
              </Button>
            </div>
            {suggestedAvailable.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {suggestedAvailable.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => addSheen(name)}
                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label className="text-[11px] text-muted-foreground">Notes</Label>
              <Textarea
                className="mt-1 min-h-[52px] text-[12px]"
                rows={2}
                value={view.notes ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...view,
                    notes: e.target.value || null,
                  })
                }
                placeholder="Optional notes"
              />
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 pb-1 text-[12px] select-none">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-sky-600"
                checked={view.isActive}
                onChange={(e) =>
                  setDraft({ ...view, isActive: e.target.checked })
                }
              />
              Active
            </label>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-destructive"
            disabled={busy}
            onClick={remove}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete
          </Button>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7"
              disabled={busy}
              onClick={save}
            >
              Save product
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
