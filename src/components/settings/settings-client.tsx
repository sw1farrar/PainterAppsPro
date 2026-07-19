"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Download,
  Building2,
  Gauge,
  Layers,
  FileText,
  Loader2,
} from "lucide-react";
import { updateSettings, exportAllData } from "@/lib/actions";
import {
  SURFACE_TYPES_FOR_DEFAULTS,
  parseSurfaceProductDefaults,
  serializeSurfaceProductDefaults,
  type SurfaceProductDefaultsMap,
} from "@/lib/surface-product-defaults";
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
import { ProductionRatesPanel } from "@/components/settings/production-rates-panel";
import { cn } from "@/lib/utils";

type SettingsSection = "business" | "rates" | "defaults" | "terms";

const SETTINGS_NAV: {
  id: SettingsSection;
  label: string;
  description: string;
  icon: typeof Building2;
}[] = [
  {
    id: "business",
    label: "Business",
    description: "Profile & markups",
    icon: Building2,
  },
  {
    id: "rates",
    label: "Production Rates",
    description: "Sq ft per man-hour",
    icon: Gauge,
  },
  {
    id: "defaults",
    label: "Default Products",
    description: "By surface type",
    icon: Layers,
  },
  {
    id: "terms",
    label: "Terms",
    description: "Proposal language",
    icon: FileText,
  },
];

type Settings = {
  id: string;
  companyName: string;
  logoPath: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  defaultLaborRate: number;
  materialMarkupPct: number;
  taxRatePct: number;
  wasteFactorPct: number;
  defaultPrepPct: number;
  defaultProfitTargetPct: number;
  defaultCoverageSqftPerGallon: number;
  doorDeductionSqft: number;
  windowDeductionSqft: number;
  defaultProductsJson?: string | null;
  termsAndConditions: string;
};

type Product = {
  id: string;
  name: string;
  brand: string;
  coverageSqftPerGallon: number;
  pricePerGallon: number;
  sheen: string | null;
  category?: string;
  defaultSurfaceType?: string | null;
  features?: string | null;
  canImageUrl?: string | null;
  dataSheetUrl?: string | null;
  notes: string | null;
  isActive: boolean;
  sheens?: Array<{ id?: string; name: string; sortOrder?: number }>;
  updatedAt?: string | Date;
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
  notes: string | null;
  isActive: boolean;
};

export function SettingsClient({
  open,
  onOpenChange,
  loading = false,
  settings: initial,
  products: initialProducts,
  rates: initialRates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  settings: Settings | null;
  products: Product[];
  rates: Rate[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [section, setSection] = useState<SettingsSection>("business");
  const [settings, setSettings] = useState<Settings | null>(initial);
  const [products, setProducts] = useState(initialProducts);
  const [rates, setRates] = useState(initialRates);
  const [surfaceDefaults, setSurfaceDefaults] =
    useState<SurfaceProductDefaultsMap>(() =>
      parseSurfaceProductDefaults(initial?.defaultProductsJson)
    );

  useEffect(() => {
    if (!open) return;
    setSection("business");
  }, [open]);

  useEffect(() => {
    if (!initial) return;
    setSettings(initial);
    setProducts(initialProducts);
    setRates(initialRates);
    setSurfaceDefaults(
      parseSurfaceProductDefaults(initial.defaultProductsJson)
    );
  }, [initial, initialProducts, initialRates]);

  const activeProducts = useMemo(
    () => products.filter((p) => p.isActive),
    [products]
  );

  function sheenOptionsFor(productId: string | undefined): string[] {
    const p = products.find((x) => x.id === productId);
    if (!p) return [];
    if (p.sheens?.length) return p.sheens.map((s) => s.name);
    return p.sheen ? [p.sheen] : [];
  }

  function saveBusiness() {
    if (!settings) return;
    start(async () => {
      await updateSettings({
        ...settings,
        defaultProductsJson: serializeSurfaceProductDefaults(surfaceDefaults),
      });
      toast.success("Business settings saved");
      router.refresh();
    });
  }

  function saveSurfaceDefaults() {
    if (!settings) return;
    start(async () => {
      await updateSettings({
        ...settings,
        defaultProductsJson: serializeSurfaceProductDefaults(surfaceDefaults),
      });
      toast.success("Default products saved");
      router.refresh();
    });
  }

  async function doExport() {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `painterapps-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="left-[calc(50%+100px)] flex h-[min(92vh,900px)] w-[min(1120px,calc(100vw-200px-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none"
      >
        <DialogHeader className="shrink-0 border-b px-5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-[16px] font-semibold tracking-tight">
                Settings
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[13px]">
                Business profile, rates, and defaults — calibrate for accuracy
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={!settings || loading}
                onClick={doExport}
              >
                <Download className="size-3.5" />
                Export JSON backup
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <nav className="flex w-56 shrink-0 flex-col gap-1 border-r bg-muted/30 p-3">
            {SETTINGS_NAV.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={loading && !settings}
                  onClick={() => setSection(item.id)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                    active
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                    loading && !settings && "opacity-60"
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      active ? "text-primary" : "opacity-70"
                    )}
                  />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-[13px] leading-tight",
                        active ? "font-semibold" : "font-medium"
                      )}
                    >
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 min-w-0 flex-1 overflow-auto p-5">
            {loading && !settings ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-sky-600" />
                <p className="text-[13px]">Loading settings…</p>
              </div>
            ) : !settings ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 px-6 text-center">
                <p className="text-[13px] font-medium text-slate-800">
                  Couldn’t load settings
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Close and try again. If it keeps failing, a database migration
                  may still be needed.
                </p>
              </div>
            ) : (
              <>
            {section === "business" && (
              <div className="panel max-w-3xl p-4">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field label="Company name">
                    <Input
                      className="h-8"
                      value={settings.companyName}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          companyName: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      className="h-8"
                      value={settings.phone ?? ""}
                      onChange={(e) =>
                        setSettings({ ...settings, phone: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      className="h-8"
                      value={settings.email ?? ""}
                      onChange={(e) =>
                        setSettings({ ...settings, email: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Website">
                    <Input
                      className="h-8"
                      value={settings.website ?? ""}
                      onChange={(e) =>
                        setSettings({ ...settings, website: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Address" className="sm:col-span-2">
                    <Input
                      className="h-8"
                      value={settings.address ?? ""}
                      onChange={(e) =>
                        setSettings({ ...settings, address: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="City">
                    <Input
                      className="h-8"
                      value={settings.city ?? ""}
                      onChange={(e) =>
                        setSettings({ ...settings, city: e.target.value })
                      }
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="State">
                      <Input
                        className="h-8"
                        value={settings.state ?? ""}
                        onChange={(e) =>
                          setSettings({ ...settings, state: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="ZIP">
                      <Input
                        className="h-8"
                        value={settings.zip ?? ""}
                        onChange={(e) =>
                          setSettings({ ...settings, zip: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>

                <h2 className="section-label mt-4 mb-2">
                  Default rates & markups
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="Labor $/hr">
                    <NumberInput
                      step="0.5"
                      className="h-8"
                      value={settings.defaultLaborRate}
                      onChange={(defaultLaborRate) =>
                        setSettings({ ...settings, defaultLaborRate })
                      }
                    />
                  </Field>
                  <Field label="Mat. markup %">
                    <NumberInput
                      step="0.5"
                      className="h-8"
                      value={settings.materialMarkupPct}
                      onChange={(materialMarkupPct) =>
                        setSettings({ ...settings, materialMarkupPct })
                      }
                    />
                  </Field>
                  <Field label="Waste %">
                    <NumberInput
                      step="0.5"
                      className="h-8"
                      value={settings.wasteFactorPct}
                      onChange={(wasteFactorPct) =>
                        setSettings({ ...settings, wasteFactorPct })
                      }
                    />
                  </Field>
                  <Field label="Std. spread sf/gal" className="sm:col-span-1">
                    <NumberInput
                      step="1"
                      className="h-8"
                      title="Standard spread rating for new products and surfaces without a product"
                      value={settings.defaultCoverageSqftPerGallon}
                      onChange={(defaultCoverageSqftPerGallon) =>
                        setSettings({
                          ...settings,
                          defaultCoverageSqftPerGallon,
                        })
                      }
                    />
                  </Field>
                  <Field label="Tax %">
                    <NumberInput
                      step="0.01"
                      className="h-8"
                      value={settings.taxRatePct}
                      onChange={(taxRatePct) =>
                        setSettings({ ...settings, taxRatePct })
                      }
                    />
                  </Field>
                  <Field label="Prep % of labor">
                    <NumberInput
                      step="1"
                      className="h-8"
                      value={settings.defaultPrepPct}
                      onChange={(defaultPrepPct) =>
                        setSettings({ ...settings, defaultPrepPct })
                      }
                    />
                  </Field>
                  <Field label="Profit target %">
                    <NumberInput
                      step="1"
                      className="h-8"
                      value={settings.defaultProfitTargetPct}
                      onChange={(defaultProfitTargetPct) =>
                        setSettings({ ...settings, defaultProfitTargetPct })
                      }
                    />
                  </Field>
                  <Field label="Door deduct sq ft">
                    <NumberInput
                      step="1"
                      className="h-8"
                      value={settings.doorDeductionSqft}
                      onChange={(doorDeductionSqft) =>
                        setSettings({ ...settings, doorDeductionSqft })
                      }
                    />
                  </Field>
                  <Field label="Window deduct sq ft">
                    <NumberInput
                      step="1"
                      className="h-8"
                      value={settings.windowDeductionSqft}
                      onChange={(windowDeductionSqft) =>
                        setSettings({ ...settings, windowDeductionSqft })
                      }
                    />
                  </Field>
                </div>

                <Button
                  size="sm"
                  className="mt-4 h-8"
                  disabled={pending}
                  onClick={saveBusiness}
                >
                  Save business settings
                </Button>
              </div>
            )}

            {section === "rates" && (
              <ProductionRatesPanel rates={rates} />
            )}

            {section === "defaults" && (
              <div className="panel p-4">
                <div className="mb-1 text-[13px] font-semibold text-slate-900">
                  Default products by surface
                </div>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  Used when adding rooms and surfaces. Preset to premium
                  Sherwin-Williams products — change anytime.
                </p>
                {(["interior", "exterior"] as const).map((group) => (
                  <div key={group} className="mb-4 last:mb-0">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {group === "interior" ? "Interior" : "Exterior"}
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="border-b bg-muted/40 text-left text-[11px] text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Surface</th>
                            <th className="px-3 py-2 font-medium">Product</th>
                            <th className="w-36 px-3 py-2 font-medium">Sheen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {SURFACE_TYPES_FOR_DEFAULTS.filter(
                            (r) => r.group === group
                          ).map((row) => {
                            const entry = surfaceDefaults[row.surfaceType] ?? {
                              productId: "",
                              sheen: null,
                            };
                            const sheens = sheenOptionsFor(entry.productId);
                            return (
                              <tr
                                key={row.surfaceType}
                                className="border-b last:border-0"
                              >
                                <td className="px-3 py-2 font-medium text-slate-800">
                                  {row.label}
                                </td>
                                <td className="px-3 py-2">
                                  <select
                                    className="h-8 w-full max-w-xs rounded-md border bg-background px-2"
                                    value={entry.productId}
                                    onChange={(e) => {
                                      const productId = e.target.value;
                                      const nextSheens =
                                        sheenOptionsFor(productId);
                                      const keepSheen =
                                        entry.sheen &&
                                        nextSheens.some(
                                          (s) =>
                                            s.toLowerCase() ===
                                            entry.sheen!.toLowerCase()
                                        )
                                          ? entry.sheen
                                          : nextSheens[0] ?? null;
                                      setSurfaceDefaults((prev) => ({
                                        ...prev,
                                        [row.surfaceType]: {
                                          productId,
                                          sheen: keepSheen,
                                        },
                                      }));
                                    }}
                                  >
                                    <option value="">— Select —</option>
                                    {activeProducts.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  <select
                                    className="h-8 w-full rounded-md border bg-background px-2"
                                    value={entry.sheen ?? ""}
                                    disabled={
                                      !entry.productId || sheens.length === 0
                                    }
                                    onChange={(e) => {
                                      setSurfaceDefaults((prev) => ({
                                        ...prev,
                                        [row.surfaceType]: {
                                          productId: entry.productId,
                                          sheen: e.target.value || null,
                                        },
                                      }));
                                    }}
                                  >
                                    {sheens.length === 0 ? (
                                      <option value="">—</option>
                                    ) : (
                                      sheens.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))
                                    )}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                <Button
                  size="sm"
                  className="mt-1 h-8"
                  disabled={pending}
                  onClick={saveSurfaceDefaults}
                >
                  Save default products
                </Button>
              </div>
            )}

            {section === "terms" && (
              <div className="panel max-w-2xl p-4">
                <Field label="Terms & conditions (shown on proposals)">
                  <Textarea
                    className="min-h-[160px] text-[13px]"
                    value={settings.termsAndConditions}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        termsAndConditions: e.target.value,
                      })
                    }
                  />
                </Field>
                <Button
                  size="sm"
                  className="mt-3 h-8"
                  disabled={pending}
                  onClick={saveBusiness}
                >
                  Save terms
                </Button>
              </div>
            )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-1 ${className ?? ""}`}>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
