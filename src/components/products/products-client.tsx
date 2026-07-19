"use client";

import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Plus, Pencil, Search, X } from "lucide-react";
import { upsertPaintProduct } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  ProductEditModal,
  type EditableProduct,
} from "@/components/products/product-edit-modal";
import { ManufacturerCatalogImportButton } from "@/components/products/manufacturer-catalog-import";
import {
  PAINT_PRODUCT_CATEGORIES,
  paintProductCategoryLabel,
} from "@/lib/paint-product-category";
import { cn } from "@/lib/utils";

type Product = EditableProduct & {
  updatedAt: string | Date;
};

function moneyText(n: number) {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

function formatUpdatedAt(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sheenKey(name: string) {
  return name.trim().toLowerCase();
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-6 shrink-0 rounded-full px-2 text-[10px] font-medium tracking-tight transition-colors",
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200/90 hover:text-slate-900"
      )}
    >
      {label}
    </button>
  );
}

function FilterRail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
        {label}
      </span>
      <div className="relative min-w-0 flex-1">
        <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card to-transparent" />
      </div>
    </div>
  );
}

export function ProductsClient({
  products: initialProducts,
  defaultSpreadRating = 375,
}: {
  products: Product[];
  defaultSpreadRating?: number;
}) {
  const [pending, start] = useTransition();
  const [products, setProducts] = useState(initialProducts);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [featureSearch, setFeatureSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const deferredFeatureSearch = useDeferredValue(featureSearch);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedSheens, setSelectedSheens] = useState<Set<string>>(
    () => new Set()
  );
  const stickyRef = useRef<HTMLDivElement>(null);
  const [stickyHeight, setStickyHeight] = useState(100);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useLayoutEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const update = () => setStickyHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Name + features are AND: a product must match every non-empty text filter.
  const byText = useMemo(() => {
    const nameQ = deferredSearch.trim().toLowerCase();
    const featureQ = deferredFeatureSearch.trim().toLowerCase();
    return products.filter((p) => {
      const matchesName = !nameQ || p.name.toLowerCase().includes(nameQ);
      const matchesFeatures =
        !featureQ || (p.features ?? "").toLowerCase().includes(featureQ);
      return matchesName && matchesFeatures;
    });
  }, [products, deferredSearch, deferredFeatureSearch]);

  const typeOptions = useMemo(() => {
    const present = new Set(byText.map((p) => p.category || "both"));
    const known = PAINT_PRODUCT_CATEGORIES.filter((c) => present.has(c));
    const unknown = [...present]
      .filter((c) => !(PAINT_PRODUCT_CATEGORIES as readonly string[]).includes(c))
      .sort();
    return [...known, ...unknown];
  }, [byText]);

  const sheenOptions = useMemo(() => {
    const pool =
      selectedTypes.size === 0
        ? byText
        : byText.filter((p) => selectedTypes.has(p.category || "both"));
    const map = new Map<string, string>();
    for (const p of pool) {
      for (const s of p.sheens) {
        const name = s.name.trim();
        if (!name) continue;
        const key = sheenKey(name);
        if (!map.has(key)) map.set(key, name);
      }
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, label]) => ({ key, label }));
  }, [byText, selectedTypes]);

  // Drop selections that are no longer in the available options
  useEffect(() => {
    const allowed = new Set(typeOptions);
    setSelectedTypes((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((t) => allowed.has(t)));
      return next.size === prev.size ? prev : next;
    });
  }, [typeOptions]);

  useEffect(() => {
    const allowed = new Set(sheenOptions.map((s) => s.key));
    setSelectedSheens((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((s) => allowed.has(s)));
      return next.size === prev.size ? prev : next;
    });
  }, [sheenOptions]);

  const filtered = useMemo(() => {
    return byText.filter((p) => {
      if (
        selectedTypes.size > 0 &&
        !selectedTypes.has(p.category || "both")
      ) {
        return false;
      }
      if (selectedSheens.size > 0) {
        const productSheens = new Set(
          p.sheens.map((s) => sheenKey(s.name)).filter(Boolean)
        );
        for (const key of selectedSheens) {
          if (productSheens.has(key)) return true;
        }
        return false;
      }
      return true;
    });
  }, [byText, selectedTypes, selectedSheens]);

  const hasActiveFilters =
    deferredSearch.trim().length > 0 ||
    deferredFeatureSearch.trim().length > 0 ||
    selectedTypes.size > 0 ||
    selectedSheens.size > 0;

  function toggleType(category: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function toggleSheen(key: string) {
    setSelectedSheens((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setFeatureSearch("");
    setSelectedTypes(new Set());
    setSelectedSheens(new Set());
  }

  function openEdit(p: Product) {
    setEditing({ ...p, sheens: [...p.sheens] });
  }

  function addProduct() {
    start(async () => {
      try {
        const saved = await upsertPaintProduct(null, {
          name: "New Product",
          brand: "Sherwin-Williams",
          coverageSqftPerGallon: defaultSpreadRating,
          pricePerGallon: 50,
          sheens: ["Eggshell"],
          category: "both",
          defaultSurfaceType: null,
          features: "",
          canImageUrl: null,
          notes: null,
          isActive: true,
        });
        const next: Product = {
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
        setProducts((prev) => [...prev, next]);
        openEdit(next);
      } catch {
        toast.error("Could not add product");
      }
    });
  }

  const thSticky = cn(
    "sticky z-10 border-b bg-slate-50 px-3 py-2.5"
  );

  return (
    <div className="flex flex-col">
      <div
        ref={stickyRef}
        className="sticky top-0 z-20 border-b border-border/80 bg-card/95 backdrop-blur-md"
      >
        <header className="flex h-10 items-center justify-between gap-3 px-4">
          <h1 className="shrink-0 text-[15px] font-semibold tracking-tight text-slate-900">
            Product Library
          </h1>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:justify-center">
            <div className="flex h-7 w-full max-w-xl items-stretch overflow-hidden rounded-full border border-slate-200/90 bg-slate-50/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-full w-full bg-transparent py-0 pr-7 pl-7 text-[12px] text-slate-800 outline-none placeholder:text-slate-400"
                  placeholder="Product name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear product name"
                    className="absolute right-1 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200/80 hover:text-slate-700"
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </div>
              <div className="my-1.5 w-px shrink-0 bg-slate-200" />
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-full w-full bg-transparent py-0 pr-7 pl-7 text-[12px] text-slate-800 outline-none placeholder:text-slate-400"
                  placeholder="Features"
                  value={featureSearch}
                  onChange={(e) => setFeatureSearch(e.target.value)}
                />
                {featureSearch ? (
                  <button
                    type="button"
                    onClick={() => setFeatureSearch("")}
                    aria-label="Clear features"
                    className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200/80 hover:text-slate-700"
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </div>
            </div>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ManufacturerCatalogImportButton
              onImported={(added) => {
                setProducts((prev) => {
                  const ids = new Set(prev.map((p) => p.id));
                  const next = added
                    .filter((p) => !ids.has(p.id))
                    .map((p) => ({
                      ...p,
                      sheens: p.sheens ?? [],
                      category: p.category ?? "both",
                      features: p.features ?? "",
                      canImageUrl: p.canImageUrl ?? null,
                    }));
                  return [...prev, ...next];
                });
              }}
            />
            <Button
              size="sm"
              className="h-7 px-2.5 text-[12px]"
              disabled={pending}
              onClick={addProduct}
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        </header>

        <div className="space-y-1 px-4 pb-2">
          {typeOptions.length > 0 ? (
            <FilterRail label="Type">
              {typeOptions.map((category) => (
                <FilterChip
                  key={category}
                  label={paintProductCategoryLabel(category)}
                  active={selectedTypes.has(category)}
                  onClick={() => toggleType(category)}
                />
              ))}
            </FilterRail>
          ) : null}

          {sheenOptions.length > 0 ? (
            <FilterRail label="Sheen">
              {sheenOptions.map((sheen) => (
                <FilterChip
                  key={sheen.key}
                  label={sheen.label}
                  active={selectedSheens.has(sheen.key)}
                  onClick={() => toggleSheen(sheen.key)}
                />
              ))}
            </FilterRail>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-separate border-spacing-0 text-left text-[13px]">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th
                  className={thSticky}
                  style={{ top: stickyHeight }}
                >
                  Product
                </th>
                <th
                  className={cn(thSticky, "w-[7rem]")}
                  style={{ top: stickyHeight }}
                >
                  Category
                </th>
                <th
                  className={cn(thSticky, "w-[5rem] text-right")}
                  style={{ top: stickyHeight }}
                >
                  Spread
                </th>
                <th
                  className={cn(thSticky, "w-[5.5rem] text-right")}
                  style={{ top: stickyHeight }}
                >
                  $/gal
                </th>
                <th
                  className={cn(thSticky, "min-w-[12rem]")}
                  style={{ top: stickyHeight }}
                >
                  Sheens
                </th>
                <th
                  className={cn(thSticky, "w-[9rem]")}
                  style={{ top: stickyHeight }}
                >
                  Updated
                </th>
                <th
                  className={cn(thSticky, "w-10 px-2")}
                  style={{ top: stickyHeight }}
                />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-[13px] text-muted-foreground"
                  >
                    {products.length === 0
                      ? "No products yet."
                      : "No products match your filters."}
                  </td>
                </tr>
              ) : null}
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => openEdit(p)}
                  className="cursor-pointer border-b last:border-b-0 transition-colors hover:bg-sky-50/70"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {p.canImageUrl ? (
                        <div className="flex h-9 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.canImageUrl}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.brand}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {paintProductCategoryLabel(p.category)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {p.coverageSqftPerGallon}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    ${moneyText(p.pricePerGallon)}
                  </td>
                  <td className="px-3 py-2.5">
                    {p.sheens.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground">
                        No sheens
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.sheens.slice(0, 4).map((s) => (
                          <span
                            key={s.name}
                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px]"
                          >
                            {s.name}
                          </span>
                        ))}
                        {p.sheens.length > 4 ? (
                          <span className="text-[11px] text-muted-foreground">
                            +{p.sheens.length - 4}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] tabular-nums text-muted-foreground">
                    {formatUpdatedAt(p.updatedAt)}
                  </td>
                  <td className="px-2 py-2.5 text-slate-400">
                    <Pencil className="mx-auto h-3.5 w-3.5" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Click a row to edit product details and sheens.
        </p>
      </div>

      <ProductEditModal
        product={editing}
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        defaultSpreadRating={defaultSpreadRating}
        onSaved={(saved) => {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === saved.id
                ? {
                    ...saved,
                    updatedAt: saved.updatedAt ?? p.updatedAt,
                  }
                : p
            )
          );
          setEditing(null);
        }}
        onDeleted={(id) => {
          setProducts((prev) => prev.filter((x) => x.id !== id));
          setEditing(null);
        }}
      />
    </div>
  );
}
