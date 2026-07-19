"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isToday } from "date-fns";
import { toast } from "sonner";
import { useUnsavedNavigationGuard } from "@/hooks/use-unsaved-navigation-guard";
import {
  Plus,
  Trash2,
  FileDown,
  Send,
  CheckCircle2,
  Upload,
  FileText,
  Pencil,
  TableProperties,
  Palette,
  Loader2,
} from "lucide-react";
import {
  calculateLineItem,
  calculateEstimateTotals,
  calculateInteriorRoomMetrics,
  expandRoomSurfaces,
  conditionMultiplier,
  formatCurrency,
  formatNumber,
  roundMoney,
  type RoomSurfaceKey,
} from "@/lib/calculations";
import { ESTIMATE_TEMPLATES, statusColor, cn } from "@/lib/utils";
import {
  saveEstimate,
  updateEstimateStatus,
  uploadEstimatePhoto,
  deleteEstimatePhoto,
  exportEstimateJson,
  type RoomPayload,
  type ExtraPayload,
} from "@/lib/actions";
import {
  buildEstimateMarkdown,
  downloadTextFile,
} from "@/lib/export-estimate";
import { findExteriorWallsMetaInSurfaces } from "@/lib/exterior-walls";
import {
  calculatePaintPackaging,
  roomPurchaseMaterialDeltaByKey,
} from "@/lib/paint-packaging";
import {
  hydrateLineColorIds,
  parseProjectColorsJson,
  serializeProjectColors,
  type ProjectColor,
} from "@/lib/project-colors";
import {
  parseSurfaceProductDefaults,
  resolveDefaultPaint,
  type SurfaceProductDefaultsMap,
} from "@/lib/surface-product-defaults";
import { uniqueRoomName } from "@/lib/room-names";
import {
  RoomEditorModal,
  type EditorRoom,
  type EditorSurface,
} from "./room-editor-modal";
import {
  RoomTypePicker,
  type RoomTypePreset,
} from "./room-type-picker";
import { EstimatePdfDownload } from "./estimate-pdf";
import { JobBreakdownModal } from "./job-breakdown-modal";
import { QuickAssignPaintModal } from "./quick-assign-paint-modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Product = {
  id: string;
  name: string;
  brand: string;
  coverageSqftPerGallon: number;
  pricePerGallon: number;
  sheen: string | null;
  category?: string;
  defaultSurfaceType?: string | null;
  sheens?: Array<{ id: string; name: string; sortOrder: number }>;
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
};

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
};
type Photo = { id: string; path: string; caption: string | null };

type SurfaceRow = EditorSurface & {
  gallonsOverride?: number | null;
  laborHoursOverride?: number | null;
  materialCostOverride?: number | null;
  laborCostOverride?: number | null;
  lineTotalOverride?: number | null;
  notes?: string | null;
};

type RoomRow = Omit<EditorRoom, "kind" | "surfaces"> & {
  kind: string;
  surfaces: SurfaceRow[];
};

type ExtraRow = ExtraPayload & { _key: string };

type EstimateData = {
  id: string;
  title: string;
  estimateNumber: string | null;
  status: string;
  notes: string | null;
  internalNotes: string | null;
  colorAssignmentsJson?: string | null;
  updatedAt?: Date | string;
  customerId: string | null;
  wasteFactorPct: number | null;
  materialMarkupPct: number | null;
  laborRate: number | null;
  taxRatePct: number | null;
  prepPct: number | null;
  discountPct: number | null;
  discountAmount: number | null;
  profitTargetPct: number | null;
  customer: Customer | null;
  rooms: Array<{
    id: string;
    name: string;
    kind: string;
    lengthFt: number | null;
    widthFt: number | null;
    heightFt: number | null;
    doorCount: number;
    windowCount: number;
    openingCount?: number;
    inputAreaSqft: number | null;
    inputLinearFt: number | null;
    condition: string;
    prepPct: number | null;
    notes: string | null;
    sortOrder: number;
    surfaces: Array<{
      id: string;
      description: string;
      surfaceType: string | null;
      measurementType: string;
      inputAreaSqft: number | null;
      quantity: number | null;
      unitLabel: string | null;
      dimensionsJson: string | null;
      coats: number;
      method: string | null;
      paintProductId: string | null;
      sheen?: string | null;
      colorName?: string | null;
      colorHex?: string | null;
      productionRateId: string | null;
      productionRateOverride: number | null;
      gallonsOverride: number | null;
      laborHoursOverride: number | null;
      materialCostOverride: number | null;
      laborCostOverride: number | null;
      lineTotalOverride: number | null;
      notes: string | null;
      sortOrder: number;
      paintProduct?: Product | null;
      productionRate?: Rate | null;
    }>;
  }>;
  extras: Array<{
    id: string;
    category: string;
    label: string;
    amountType: string;
    amount: number;
    sortOrder: number;
  }>;
  lineItems: Array<{ id: string; optionId: string | null; roomId: string | null }>;
  photos: Photo[];
};

type Settings = {
  defaultLaborRate: number;
  materialMarkupPct: number;
  taxRatePct: number;
  wasteFactorPct: number;
  defaultPrepPct: number;
  defaultProfitTargetPct: number;
  defaultCoverageSqftPerGallon: number;
  doorDeductionSqft: number;
  windowDeductionSqft: number;
  companyName: string;
  defaultProductsJson?: string | null;
};

let keySeq = 0;
function newKey() {
  return `k-${++keySeq}-${Date.now()}`;
}

function findRate(
  rates: Rate[],
  surfaceType: string | null | undefined,
  method?: string | null
) {
  if (!surfaceType) return undefined;
  if (method) {
    const exact = rates.find(
      (r) => r.surfaceType === surfaceType && r.method === method
    );
    if (exact) return exact;
  }
  return rates.find((r) => r.surfaceType === surfaceType);
}

function roomFromTemplate(
  tr: {
    name: string;
    kind: "interior" | "exterior";
    lengthFt?: number;
    widthFt?: number;
    heightFt?: number;
    doorCount?: number;
    windowCount?: number;
    openingCount?: number;
    inputAreaSqft?: number;
    inputLinearFt?: number;
    condition: "easy" | "medium" | "hard";
    surfaces: readonly RoomSurfaceKey[];
    coats: number;
  },
  products: Product[],
  rates: Rate[],
  doorDeduct: number,
  windowDeduct: number,
  defaultsMap: SurfaceProductDefaultsMap = {}
): RoomRow {
  const kind = tr.kind;
  const metrics =
    kind === "interior"
      ? calculateInteriorRoomMetrics({
          lengthFt: tr.lengthFt ?? 12,
          widthFt: tr.widthFt ?? 12,
          heightFt: tr.heightFt ?? 8,
          doorCount: tr.doorCount ?? 0,
          windowCount: tr.windowCount ?? 0,
          openingCount: tr.openingCount ?? 0,
          doorDeductionSqft: doorDeduct,
          windowDeductionSqft: windowDeduct,
        })
      : null;

  const drafts = expandRoomSurfaces({
    roomName: tr.name,
    kind,
    selected: [...tr.surfaces],
    metrics,
    exteriorAreaSqft: tr.inputAreaSqft,
    exteriorLinearFt: tr.inputLinearFt,
    doorCount: tr.doorCount,
    windowCount: tr.windowCount,
    coats: tr.coats,
  });

  return {
    _key: newKey(),
    name: tr.name,
    kind,
    lengthFt: kind === "interior" ? (tr.lengthFt ?? 12) : null,
    widthFt: kind === "interior" ? (tr.widthFt ?? 12) : null,
    heightFt: kind === "interior" ? (tr.heightFt ?? 8) : null,
    doorCount: tr.doorCount ?? 0,
    windowCount: tr.windowCount ?? 0,
    openingCount: tr.openingCount ?? 0,
    inputAreaSqft: kind === "exterior" ? (tr.inputAreaSqft ?? 0) : null,
    inputLinearFt: kind === "exterior" ? (tr.inputLinearFt ?? 0) : null,
    condition: tr.condition,
    prepPct: null,
    notes: null,
    sortOrder: 0,
    closetWidthFt: 4,
    closetDepthFt: 2,
    closetHeightFt: 8,
    trimBaseboardLf: null,
    trimWindowCasingLf: null,
    crownLf: null,
    surfaces: drafts.map((d, i) => {
      const rate = findRate(rates, d.surfaceType, d.method);
      const { product, sheen } = resolveDefaultPaint({
        surfaceType: d.surfaceType,
        products,
        defaultsMap,
      });
      return {
        _key: newKey(),
        featureKey: d.key,
        description: d.description,
        surfaceType: d.surfaceType,
        measurementType: d.measurementType,
        inputAreaSqft: d.inputAreaSqft,
        quantity: d.quantity,
        unitLabel: d.unitLabel,
        dimensionsJson: JSON.stringify({
          autoLinked: true,
          featureKey: d.key,
          showWork: d.showWork,
        }),
        coats: d.coats,
        method: d.method,
        paintProductId: product?.id ?? null,
        sheen,
        colorName: null,
        colorHex: null,
        productionRateId: rate?.id ?? null,
        productionRateOverride: null,
        sortOrder: i,
        autoLinked: true,
      };
    }),
  };
}

function toEditorRoom(room: RoomRow): EditorRoom {
  return {
    ...room,
    kind: room.kind === "exterior" ? "exterior" : "interior",
    surfaces: room.surfaces.map((s) => ({ ...s })),
  };
}

function fromEditorRoom(room: EditorRoom, sortOrder: number): RoomRow {
  return {
    ...room,
    sortOrder,
    surfaces: room.surfaces.map((s, i) => ({ ...s, sortOrder: i })),
  };
}

export function EstimateBuilder({
  estimate,
  customers,
  products,
  rates,
  settings,
  initialAddRoomKind = null,
}: {
  estimate: EstimateData;
  customers: Customer[];
  products: Product[];
  rates: Rate[];
  settings: Settings;
  /** Open room picker (optionally filtered) from new-estimate setup. */
  initialAddRoomKind?: "interior" | "exterior" | "both" | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const surfaceProductDefaults = useMemo(
    () => parseSurfaceProductDefaults(settings.defaultProductsJson),
    [settings.defaultProductsJson]
  );

  const [title, setTitle] = useState(estimate.title);
  const [customerId, setCustomerId] = useState(estimate.customerId ?? "");
  const [notes, setNotes] = useState(estimate.notes ?? "");
  const [status, setStatus] = useState(estimate.status);
  const [waste, setWaste] = useState(
    estimate.wasteFactorPct ?? settings.wasteFactorPct
  );
  const [markup, setMarkup] = useState(
    estimate.materialMarkupPct ?? settings.materialMarkupPct
  );
  const [laborRate, setLaborRate] = useState(
    estimate.laborRate ?? settings.defaultLaborRate
  );
  const [taxRate, setTaxRate] = useState(
    estimate.taxRatePct ?? settings.taxRatePct
  );
  const [prepPct, setPrepPct] = useState(
    estimate.prepPct ?? settings.defaultPrepPct
  );
  const [discountPct, setDiscountPct] = useState(estimate.discountPct ?? 0);
  const [profitTarget, setProfitTarget] = useState(
    estimate.profitTargetPct ?? settings.defaultProfitTargetPct
  );

  const [{ projectColors: initialProjectColors, rooms: initialRooms }] =
    useState(() => {
      const { colors, placeholderToId } = parseProjectColorsJson(
        estimate.colorAssignmentsJson
      );
      const mappedRooms: RoomRow[] = (estimate.rooms ?? []).map((r) => {
        let trimBaseboardLf: number | null = null;
        let trimWindowCasingLf: number | null = null;
        let crownLf: number | null = null;
        for (const s of r.surfaces) {
          if (!s.dimensionsJson) continue;
          try {
            const meta = JSON.parse(s.dimensionsJson) as {
              featureKey?: RoomSurfaceKey;
              baseboardAuto?: boolean;
              casingAuto?: boolean;
              crownAuto?: boolean;
              baseboardLf?: number;
              windowCasingLf?: number;
              crownLf?: number;
            };
            if (meta.featureKey === "trim") {
              if (meta.baseboardAuto === false && meta.baseboardLf != null) {
                trimBaseboardLf = meta.baseboardLf;
              }
              if (meta.casingAuto === false && meta.windowCasingLf != null) {
                trimWindowCasingLf = meta.windowCasingLf;
              }
            }
            if (
              meta.featureKey === "crown" &&
              meta.crownAuto === false &&
              meta.crownLf != null
            ) {
              crownLf = meta.crownLf;
            }
          } catch {
            /* ignore */
          }
        }
        const exteriorMeta = findExteriorWallsMetaInSurfaces(r.surfaces);

        return {
          _key: r.id,
          name: r.name,
          kind: r.kind,
          lengthFt: r.lengthFt,
          widthFt: r.widthFt,
          heightFt: r.heightFt,
          doorCount: r.doorCount,
          windowCount: r.windowCount,
          openingCount: r.openingCount ?? 0,
          inputAreaSqft: r.inputAreaSqft,
          inputLinearFt: r.inputLinearFt,
          condition: r.condition,
          prepPct: r.prepPct,
          notes: r.notes,
          sortOrder: r.sortOrder,
          closetWidthFt: 4,
          closetDepthFt: 2,
          closetHeightFt: r.heightFt ?? 8,
          trimBaseboardLf,
          trimWindowCasingLf,
          crownLf,
          exteriorMode: exteriorMeta?.exteriorMode ?? "simple",
          exteriorTrimScope: exteriorMeta?.trimScope ?? "global",
          exteriorWalls: exteriorMeta?.walls ?? [],
          exteriorCladding: exteriorMeta?.cladding ?? "siding",
          surfaces: r.surfaces.map((s) => {
            let featureKey: RoomSurfaceKey | null = null;
            let autoLinked = true;
            if (s.dimensionsJson) {
              try {
                const meta = JSON.parse(s.dimensionsJson) as {
                  featureKey?: RoomSurfaceKey;
                  autoLinked?: boolean;
                };
                featureKey = meta.featureKey ?? null;
                autoLinked = meta.autoLinked ?? true;
              } catch {
                /* ignore */
              }
            }
            return {
              _key: s.id,
              featureKey,
              description: s.description,
              surfaceType: s.surfaceType,
              measurementType: s.measurementType,
              inputAreaSqft: s.inputAreaSqft,
              quantity: s.quantity,
              unitLabel: s.unitLabel,
              dimensionsJson: s.dimensionsJson,
              coats: s.coats,
              method: s.method,
              paintProductId: s.paintProductId,
              sheen: s.sheen ?? null,
              colorName: s.colorName ?? null,
              colorHex: s.colorHex ?? null,
              productionRateId: s.productionRateId,
              productionRateOverride: s.productionRateOverride,
              gallonsOverride: s.gallonsOverride,
              laborHoursOverride: s.laborHoursOverride,
              materialCostOverride: s.materialCostOverride,
              laborCostOverride: s.laborCostOverride,
              lineTotalOverride: s.lineTotalOverride,
              notes: s.notes,
              sortOrder: s.sortOrder,
              autoLinked,
            };
          }),
        };
      });

      const flat = mappedRooms.flatMap((r) =>
        r.surfaces.map((s) => ({ _key: s._key, colorName: s.colorName }))
      );
      const hydrated = hydrateLineColorIds(flat, colors, placeholderToId);
      const byKey = Object.fromEntries(
        hydrated.items.map((i) => [i._key, i.colorName])
      );
      return {
        projectColors: hydrated.colors,
        rooms: mappedRooms.map((r) => ({
          ...r,
          surfaces: r.surfaces.map((s) => ({
            ...s,
            colorName: byKey[s._key] ?? null,
          })),
        })),
      };
    });

  const [projectColors, setProjectColors] =
    useState<ProjectColor[]>(initialProjectColors);
  const [rooms, setRooms] = useState<RoomRow[]>(initialRooms);
  const [extras, setExtras] = useState<ExtraRow[]>(
    (estimate.extras ?? []).map((e) => ({ ...e, _key: e.id }))
  );
  const [photos, setPhotos] = useState(estimate.photos);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerKindFilter, setPickerKindFilter] = useState<
    "interior" | "exterior" | null
  >(null);
  const didAutoOpenPicker = useRef(false);

  useEffect(() => {
    if (!initialAddRoomKind || didAutoOpenPicker.current) return;
    didAutoOpenPicker.current = true;
    setPickerKindFilter(
      initialAddRoomKind === "both" ? null : initialAddRoomKind
    );
    setPickerOpen(true);
    // Drop the query param so refresh doesn't re-open the picker.
    router.replace(`/estimates/${estimate.id}`, { scroll: false });
  }, [initialAddRoomKind, estimate.id, router]);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [editor, setEditor] = useState<{
    kind: "interior" | "exterior";
    roomIdx: number | null;
    preset?: RoomTypePreset | null;
  } | null>(null);
  const [quickAssignRoomIdx, setQuickAssignRoomIdx] = useState<number | null>(
    null
  );
  /** Remaining room indexes after the current Quick assign room. */
  const [quickAssignQueue, setQuickAssignQueue] = useState<number[]>([]);
  /** Total rooms in the current toolbar session (for "Room 1 of N"). */
  const [quickAssignSessionTotal, setQuickAssignSessionTotal] = useState(0);

  function clearQuickAssignSession() {
    setQuickAssignRoomIdx(null);
    setQuickAssignQueue([]);
    setQuickAssignSessionTotal(0);
  }

  function startQuickAssignForRoom(roomIdx: number) {
    setQuickAssignRoomIdx(roomIdx);
    setQuickAssignQueue([]);
    setQuickAssignSessionTotal(1);
  }

  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products]
  );
  const rateMap = useMemo(
    () => Object.fromEntries(rates.map((r) => [r.id, r])),
    [rates]
  );

  const computed = useMemo(() => {
    return rooms.map((room) => {
      const roomCond = conditionMultiplier(room.condition);
      const roomPrep = room.prepPct ?? prepPct;
      const surfaces = room.surfaces.map((li) => {
        const product = li.paintProductId ? productMap[li.paintProductId] : null;
        const rate = li.productionRateId ? rateMap[li.productionRateId] : null;
        const rateVal =
          li.productionRateOverride ?? rate?.ratePerManHour ?? null;
        const calc = calculateLineItem({
          measurementType: (li.measurementType as "area" | "unit") || "area",
          inputAreaSqft: li.inputAreaSqft,
          quantity: li.quantity,
          unitLabel: li.unitLabel,
          surfaceType: li.surfaceType,
          coats: li.coats,
          coverageSqftPerGallon:
            product?.coverageSqftPerGallon ??
            settings.defaultCoverageSqftPerGallon,
          pricePerGallon: product?.pricePerGallon,
          productionRatePerManHour: rateVal,
          firstCoatRate: rate?.firstCoatRate,
          additionalCoatRate: rate?.additionalCoatRate,
          effective2CoatRate: rate?.effective2CoatRate,
          wasteFactorPct: waste,
          materialMarkupPct: markup,
          laborRate,
          conditionMultiplier: roomCond,
          prepPct: roomPrep,
          gallonsOverride: li.gallonsOverride,
          laborHoursOverride: li.laborHoursOverride,
          materialCostOverride: li.materialCostOverride,
          laborCostOverride: li.laborCostOverride,
          lineTotalOverride: li.lineTotalOverride,
          surfaceLabel: li.description,
        });
        return { li, calc };
      });
      const roomTotal = surfaces.reduce((s, x) => s + x.calc.lineTotal, 0);
      return { room, surfaces, roomTotal };
    });
  }, [
    rooms,
    productMap,
    rateMap,
    waste,
    markup,
    laborRate,
    prepPct,
    settings.defaultCoverageSqftPerGallon,
  ]);

  const paintPackaging = useMemo(
    () =>
      calculatePaintPackaging(
        computed.flatMap(({ room, surfaces }) =>
          surfaces.map(({ li, calc }) => {
            const product = li.paintProductId
              ? productMap[li.paintProductId]
              : null;
            return {
              roomKey: room._key,
              roomName: room.name,
              surfaceKey: li._key,
              description: li.description,
              paintProductId: li.paintProductId,
              productName: product?.name ?? "Paint",
              pricePerGallon: product?.pricePerGallon ?? 0,
              sheen: li.sheen,
              colorName: li.colorName,
              colorHex: li.colorHex,
              rawGallons: calc.gallons,
              materialMarkupPct: markup,
            };
          })
        )
      ),
    [computed, productMap, markup]
  );

  /** Room cards use purchased (ceiled) paint $; job total may then subtract efficiency. */
  const packagedRoomTotals = useMemo(() => {
    const deltaByKey = roomPurchaseMaterialDeltaByKey(paintPackaging);
    return computed.map(({ room, surfaces, roomTotal }) => ({
      room,
      surfaces,
      roomTotal: roundMoney(
        roomTotal + (deltaByKey.get(room._key) ?? 0)
      ),
    }));
  }, [computed, paintPackaging]);

  const flat = computed.flatMap((c) => c.surfaces);

  const totals = useMemo(
    () =>
      calculateEstimateTotals({
        lineTotals: flat.map((c) => c.calc.lineTotal),
        materialCosts: flat.map((c) => c.calc.materialCost),
        laborCosts: flat.map((c) => c.calc.laborCost),
        laborHours: flat.map((c) => c.calc.laborHours),
        prepHours: flat.map((c) => c.calc.prepHours),
        taxRatePct: taxRate,
        extras: extras.map((e) => ({
          category: e.category,
          label: e.label,
          amountType: e.amountType,
          amount: e.amount,
        })),
        discountPct,
        paintPackaging: {
          rawMaterialTotal: paintPackaging.rawMaterialTotal,
          roomMaterialTotal: paintPackaging.roomMaterialTotal,
          efficiencyDiscount: paintPackaging.efficiencyDiscount,
        },
      }),
    [flat, taxRate, extras, discountPct, paintPackaging]
  );

  function removeRoom(idx: number) {
    setRooms((prev) => prev.filter((_, i) => i !== idx));
  }

  function saveEditorRoom(room: EditorRoom) {
    const excludeIdx = editor?.roomIdx ?? null;
    const name = uniqueRoomName(
      room.name,
      rooms.map((r) => r.name),
      excludeIdx
    );
    const named = name === room.name ? room : { ...room, name };

    if (excludeIdx == null) {
      setRooms((prev) => [
        ...prev,
        fromEditorRoom(named, prev.length),
      ]);
      toast.success(`Added ${named.name}`);
    } else {
      const idx = excludeIdx;
      setRooms((prev) => {
        const next = [...prev];
        next[idx] = fromEditorRoom(named, idx);
        return next;
      });
      toast.success(`Updated ${named.name}`);
    }
    setEditor(null);
  }

  function loadTemplate(templateId: string) {
    const t = ESTIMATE_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    const newRooms = t.rooms.map((tr, i) => ({
      ...roomFromTemplate(
        {
          name: tr.name,
          kind: tr.kind,
          lengthFt: "lengthFt" in tr ? (tr.lengthFt as number) : undefined,
          widthFt: "widthFt" in tr ? (tr.widthFt as number) : undefined,
          heightFt: "heightFt" in tr ? (tr.heightFt as number) : undefined,
          doorCount: tr.doorCount,
          windowCount: tr.windowCount,
          inputAreaSqft:
            "inputAreaSqft" in tr ? (tr.inputAreaSqft as number) : undefined,
          inputLinearFt:
            "inputLinearFt" in tr ? (tr.inputLinearFt as number) : undefined,
          condition: tr.condition,
          surfaces: tr.surfaces,
          coats: tr.coats,
        },
        products,
        rates,
        settings.doorDeductionSqft,
        settings.windowDeductionSqft,
        surfaceProductDefaults
      ),
      sortOrder: i,
    }));
    setRooms(newRooms);
    setTitle(t.name);
    toast.success(`Loaded template: ${t.name}`);
  }

  function buildPayload(): {
    rooms: RoomPayload[];
    extras: ExtraPayload[];
  } {
    return {
      rooms: rooms.map((r, i) => ({
        name: r.name,
        kind: r.kind,
        lengthFt: r.lengthFt,
        widthFt: r.widthFt,
        heightFt: r.heightFt,
        doorCount: r.doorCount,
        windowCount: r.windowCount,
        openingCount: r.openingCount ?? 0,
        inputAreaSqft: r.inputAreaSqft,
        inputLinearFt: r.inputLinearFt,
        condition: r.condition,
        prepPct: r.prepPct,
        notes: r.notes,
        sortOrder: i,
        surfaces: r.surfaces.map((s, j) => ({
          description: s.description || "Surface",
          surfaceType: s.surfaceType,
          measurementType: s.measurementType,
          inputAreaSqft: s.inputAreaSqft,
          quantity: s.quantity,
          unitLabel: s.unitLabel,
          dimensionsJson: s.dimensionsJson,
          coats: s.coats,
          method: s.method,
          paintProductId: s.paintProductId,
          sheen: s.sheen ?? null,
          colorName: s.colorName ?? null,
          colorHex: s.colorHex ?? null,
          productionRateId: s.productionRateId,
          productionRateOverride: s.productionRateOverride,
          gallonsOverride: s.gallonsOverride,
          laborHoursOverride: s.laborHoursOverride,
          materialCostOverride: s.materialCostOverride,
          laborCostOverride: s.laborCostOverride,
          lineTotalOverride: s.lineTotalOverride,
          notes: s.notes,
          sortOrder: j,
        })),
      })),
      extras: extras.map((e, i) => ({
        category: e.category,
        label: e.label,
        amountType: e.amountType,
        amount: e.amount,
        sortOrder: i,
      })),
    };
  }

  const draftSnapshot = useMemo(
    () =>
      JSON.stringify({
        title,
        customerId,
        notes,
        projectColors,
        waste,
        markup,
        laborRate,
        taxRate,
        prepPct,
        discountPct,
        profitTarget,
        rooms,
        extras,
      }),
    [
      title,
      customerId,
      notes,
      projectColors,
      waste,
      markup,
      laborRate,
      taxRate,
      prepPct,
      discountPct,
      profitTarget,
      rooms,
      extras,
    ]
  );
  const draftSnapshotRef = useRef(draftSnapshot);
  draftSnapshotRef.current = draftSnapshot;
  const [cleanSnapshot, setCleanSnapshot] = useState<string | null>(null);
  const cleanSnapshotRef = useRef<string | null>(null);
  useEffect(() => {
    const snap = draftSnapshotRef.current;
    setCleanSnapshot(snap);
    cleanSnapshotRef.current = snap;
  }, []);
  const isDirty =
    cleanSnapshot != null && draftSnapshot !== cleanSnapshot;
  const markClean = (snapshot?: string) => {
    const snap = snapshot ?? draftSnapshotRef.current;
    cleanSnapshotRef.current = snap;
    setCleanSnapshot(snap);
  };

  const [lastSavedAt, setLastSavedAt] = useState<Date>(() =>
    estimate.updatedAt ? new Date(estimate.updatedAt) : new Date()
  );
  const [autoSavePhase, setAutoSavePhase] = useState<
    "idle" | "pending" | "saving" | "error"
  >("idle");
  const autoSaveInFlightRef = useRef(false);
  const [autoSaveKick, setAutoSaveKick] = useState(0);

  async function persistEstimate(options?: {
    nextStatus?: string;
    successMessage?: string;
    silent?: boolean;
  }): Promise<boolean> {
    const nextStatus = options?.nextStatus;
    const snapshotAtSave = draftSnapshotRef.current;
    try {
      const payload = buildPayload();
      await saveEstimate({
        id: estimate.id,
        title,
        customerId: customerId || null,
        status: nextStatus ?? status,
        notes,
        colorAssignmentsJson: serializeProjectColors(projectColors),
        wasteFactorPct: waste,
        materialMarkupPct: markup,
        laborRate,
        taxRatePct: taxRate,
        prepPct,
        discountPct,
        profitTargetPct: profitTarget,
        ...payload,
      });
      if (nextStatus) setStatus(nextStatus);
      // Only clear dirty if nothing changed while the request was in flight.
      if (draftSnapshotRef.current === snapshotAtSave) {
        markClean(snapshotAtSave);
        setAutoSavePhase("idle");
      }
      setLastSavedAt(new Date());
      if (!options?.silent) {
        toast.success(
          options?.successMessage ??
            (nextStatus === "sent" ? "Marked as sent" : "Estimate saved")
        );
        router.refresh();
      }
      return true;
    } catch (e) {
      setAutoSavePhase("error");
      toast.error(e instanceof Error ? e.message : "Save failed");
      return false;
    }
  }

  // Debounced auto-save whenever the draft diverges from the last clean snapshot.
  useEffect(() => {
    if (!isDirty) {
      setAutoSavePhase((p) => (p === "pending" ? "idle" : p));
      return;
    }
    setAutoSavePhase("pending");
    const timer = window.setTimeout(() => {
      if (autoSaveInFlightRef.current) {
        // A save is already running; retry when it finishes.
        return;
      }
      autoSaveInFlightRef.current = true;
      setAutoSavePhase("saving");
      void persistEstimate({ silent: true }).finally(() => {
        autoSaveInFlightRef.current = false;
        if (
          draftSnapshotRef.current !== cleanSnapshotRef.current
        ) {
          setAutoSaveKick((k) => k + 1);
        }
      });
    }, 900);
    return () => window.clearTimeout(timer);
    // persistEstimate reads latest render fields matching draftSnapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, draftSnapshot, autoSaveKick]);

  function handleSave(nextStatus?: string) {
    start(async () => {
      setAutoSavePhase("saving");
      await persistEstimate({ nextStatus });
    });
  }

  function formatLastSaved(at: Date) {
    return isToday(at)
      ? format(at, "h:mm a")
      : format(at, "MMM d, h:mm a");
  }

  function handleAccept() {
    start(async () => {
      try {
        const payload = buildPayload();
        await saveEstimate({
          id: estimate.id,
          title,
          customerId: customerId || null,
          status: "accepted",
          notes,
          colorAssignmentsJson: serializeProjectColors(projectColors),
          wasteFactorPct: waste,
          materialMarkupPct: markup,
          laborRate,
          taxRatePct: taxRate,
          prepPct,
          discountPct,
          profitTargetPct: profitTarget,
          ...payload,
        });
        await updateEstimateStatus(estimate.id, "accepted");
        setStatus("accepted");
        markClean();
        toast.success("Estimate accepted — job scheduled");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Accept failed");
      }
    });
  }

  const { dialog: unsavedDialog } = useUnsavedNavigationGuard({
    isDirty,
    onSave: () => persistEstimate(),
  });

  function exportMarkdown() {
    const md = buildEstimateMarkdown({
      companyName: settings.companyName,
      title,
      estimateNumber: estimate.estimateNumber,
      customerName:
        customers.find((c) => c.id === customerId)?.name ??
        estimate.customer?.name,
      rooms: computed.map(({ room, surfaces }) => ({
        name: room.name,
        kind: room.kind,
        lengthFt: room.lengthFt,
        widthFt: room.widthFt,
        heightFt: room.heightFt,
        doorCount: room.doorCount,
        windowCount: room.windowCount,
        condition: room.condition,
        surfaces: surfaces.map(({ li, calc }) => ({
          description: li.description,
          surfaceType: li.surfaceType,
          coats: li.coats,
          method: li.method,
          measureLabel:
            li.measurementType === "unit"
              ? `${li.quantity ?? 0} ${li.unitLabel || "units"}`
              : `${li.inputAreaSqft ?? 0} sq ft`,
          gallons: calc.gallons,
          laborHours: calc.laborHours,
          prepHours: calc.prepHours,
          materialCost: calc.materialCost,
          laborCost: calc.laborCost,
          lineTotal: calc.lineTotal,
          showWork: calc.showWork,
        })),
      })),
      extras: totals.extrasBreakdown,
      totals,
      notes,
    });
    downloadTextFile(
      `${estimate.estimateNumber || "estimate"}.md`,
      md,
      "text/markdown"
    );
    toast.success("Markdown downloaded");
  }

  function exportJson() {
    start(async () => {
      try {
        const data = await exportEstimateJson(estimate.id);
        downloadTextFile(
          `${estimate.estimateNumber || "estimate"}.json`,
          JSON.stringify(data, null, 2),
          "application/json"
        );
        toast.success("JSON exported (saved snapshot)");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Export failed");
      }
    });
  }

  const editingRoom =
    editor?.roomIdx != null ? toEditorRoom(rooms[editor.roomIdx]) : null;

  return (
    <div className="space-y-4">
      {unsavedDialog}
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 max-w-md text-[15px] font-semibold"
            />
            <Badge className={cn("text-white", statusColor(status))}>
              {status}
            </Badge>
            {estimate.estimateNumber && (
              <span className="text-[12px] text-muted-foreground">
                {estimate.estimateNumber}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-8 rounded-md border bg-background px-2 text-[13px]"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">No customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="h-8 rounded-md border bg-background px-2 text-[13px]"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) loadTemplate(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">Load template…</option>
              {ESTIMATE_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div
            className="flex h-8 min-w-[7.5rem] items-center gap-1.5 rounded-md border border-transparent px-2 text-[12px] text-muted-foreground"
            title={
              autoSavePhase === "error"
                ? "Last save failed — edits will retry automatically"
                : "Estimates save automatically"
            }
          >
            {autoSavePhase === "pending" ||
            autoSavePhase === "saving" ||
            (pending && isDirty) ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving…</span>
              </>
            ) : autoSavePhase === "error" ? (
              <button
                type="button"
                className="text-amber-700 underline-offset-2 hover:underline"
                onClick={() => {
                  setAutoSavePhase("saving");
                  void persistEstimate({ silent: true });
                }}
              >
                Retry save
              </button>
            ) : (
              <span className="tabular-nums">
                Saved {formatLastSaved(lastSavedAt)}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => handleSave("sent")}
          >
            <Send className="mr-1 h-3.5 w-3.5" />
            Send
          </Button>
          <Button
            size="sm"
            disabled={pending || status === "accepted"}
            onClick={handleAccept}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Accept
          </Button>
          <Link
            href={`/estimates/${estimate.id}/proposal`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            <FileDown className="mr-1 h-3.5 w-3.5" />
            Proposal
          </Link>
          <Button size="sm" variant="outline" onClick={exportMarkdown}>
            <FileText className="mr-1 h-3.5 w-3.5" />
            Markdown
          </Button>
          <Button size="sm" variant="outline" onClick={exportJson}>
            JSON
          </Button>
          <EstimatePdfDownload
            companyName={settings.companyName}
            title={title}
            estimateNumber={estimate.estimateNumber}
            customerName={
              customers.find((c) => c.id === customerId)?.name ??
              estimate.customer?.name
            }
            rooms={computed.map(({ room, surfaces }) => ({
              name: room.name,
              kind: room.kind,
              surfaces: surfaces.map(({ li, calc }) => ({
                description: li.description,
                coats: li.coats,
                lineTotal: calc.lineTotal,
                gallons: calc.gallons,
                hours: calc.laborHours + calc.prepHours,
              })),
            }))}
            totals={totals}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                setPickerKindFilter(null);
                setPickerOpen(true);
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Room
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={computed.length === 0}
              onClick={() => setBreakdownOpen(true)}
            >
              <TableProperties className="mr-1 h-3.5 w-3.5" />
              Cost breakdown
            </Button>
          </div>

          {computed.length === 0 && (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center text-[13px] text-muted-foreground">
              Add a room, pick the type, then set dimensions and surfaces.
            </div>
          )}

          <div className="space-y-2">
            {packagedRoomTotals.map(({ room, surfaces, roomTotal }, roomIdx) => {
              const needingColor = surfaces.filter(
                (s) => !s.li.colorName?.trim()
              );
              const needingLabels = needingColor.map((s) =>
                s.li.description.replace(`${room.name} — `, "")
              );
              const roomKind =
                room.kind === "exterior" ? "exterior" : "interior";
              return (
                <div
                  key={room._key}
                  className={cn(
                    "rounded-xl border bg-card px-2 py-2 shadow-sm ring-1 ring-black/5 transition-colors",
                    needingColor.length > 0
                      ? "border-amber-300/80 ring-amber-200/60"
                      : "hover:border-primary/30 hover:bg-accent/40"
                  )}
                >
                  <div className="flex w-full items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditor({
                          kind: roomKind,
                          roomIdx,
                        })
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[14px] font-semibold">
                            {room.name}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {room.kind}
                          </Badge>
                          {needingColor.length === 0 && surfaces.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Colors set
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-[12px] text-muted-foreground">
                          {room.kind === "interior"
                            ? `${room.lengthFt}×${room.widthFt}×${room.heightFt} ft · ${room.doorCount} doors · ${room.windowCount} windows${(room.openingCount ?? 0) > 0 ? ` · ${room.openingCount} openings` : ""}`
                            : `${room.inputAreaSqft ?? 0} sq ft · ${room.inputLinearFt ?? 0} LF trim`}
                          {" · "}
                          {surfaces.length} surface
                          {surfaces.length === 1 ? "" : "s"}
                          {" · "}
                          {surfaces
                            .map((s) =>
                              s.li.description.replace(`${room.name} — `, "")
                            )
                            .slice(0, 4)
                            .join(", ")}
                          {surfaces.length > 4 ? "…" : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[15px] font-semibold tabular-nums">
                          {formatCurrency(roomTotal)}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary">
                          <Pencil className="h-3 w-3" />
                          Edit room
                        </div>
                      </div>
                    </button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => removeRoom(roomIdx)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  {needingColor.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t border-amber-200/70 px-2 pb-1 pt-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold text-amber-900">
                          {needingColor.length} surface
                          {needingColor.length === 1 ? "" : "s"} need a color
                        </div>
                        <div className="truncate text-[11px] text-amber-800/80">
                          {needingLabels.slice(0, 4).join(", ")}
                          {needingLabels.length > 4 ? "…" : ""}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 shrink-0 bg-amber-500 text-white hover:bg-amber-600"
                        onClick={() => startQuickAssignForRoom(roomIdx)}
                      >
                        <Palette className="mr-1 h-3.5 w-3.5" />
                        Assign colors
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Extras */}
          <div className="rounded-sm border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="section-label">Extras</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setExtras((prev) => [
                    ...prev,
                    {
                      _key: newKey(),
                      category: "sundries",
                      label: "Sundries",
                      amountType: "fixed",
                      amount: 0,
                      sortOrder: prev.length,
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            <div className="space-y-1.5">
              {extras.map((e, i) => (
                <div key={e._key} className="flex flex-wrap items-center gap-1.5">
                  <select
                    className="h-7 rounded-md border bg-background px-1 text-[11px]"
                    value={e.category}
                    onChange={(ev) => {
                      const next = [...extras];
                      next[i] = { ...e, category: ev.target.value };
                      setExtras(next);
                    }}
                  >
                    <option value="sundries">Sundries</option>
                    <option value="travel">Travel</option>
                    <option value="disposal">Disposal</option>
                    <option value="other">Other</option>
                  </select>
                  <Input
                    value={e.label}
                    onChange={(ev) => {
                      const next = [...extras];
                      next[i] = { ...e, label: ev.target.value };
                      setExtras(next);
                    }}
                    className="h-7 max-w-[140px] text-[12px]"
                  />
                  <select
                    className="h-7 rounded-md border bg-background px-1 text-[11px]"
                    value={e.amountType}
                    onChange={(ev) => {
                      const next = [...extras];
                      next[i] = { ...e, amountType: ev.target.value };
                      setExtras(next);
                    }}
                  >
                    <option value="fixed">Fixed $</option>
                    <option value="percent_of_subtotal">% of subtotal</option>
                  </select>
                  <NumberInput
                    value={e.amount}
                    onChange={(amount) => {
                      const next = [...extras];
                      next[i] = { ...e, amount };
                      setExtras(next);
                    }}
                    className="h-7 w-24 text-[12px]"
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() =>
                      setExtras((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[12px]">Customer notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-[13px]"
            />
          </div>

          {/* Photos */}
          <div className="rounded-sm border p-3">
            <h2 className="section-label mb-2">Photos</h2>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-primary">
              <Upload className="h-3.5 w-3.5" />
              Upload
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.set("file", file);
                  start(async () => {
                    const photo = await uploadEstimatePhoto(estimate.id, fd);
                    setPhotos((p) => [...p, photo]);
                    toast.success("Photo uploaded");
                  });
                }}
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.path}
                    alt=""
                    className="h-16 w-16 rounded-sm object-cover"
                  />
                  <button
                    type="button"
                    className="absolute -right-1 -top-1 rounded-full bg-destructive px-1 text-[10px] text-white"
                    onClick={() => {
                      start(async () => {
                        await deleteEstimatePhoto(p.id, estimate.id);
                        setPhotos((prev) => prev.filter((x) => x.id !== p.id));
                      });
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live totals */}
        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-sm border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="section-label mb-0">Live Totals</h2>
              <button
                type="button"
                disabled={computed.length === 0}
                onClick={() => setBreakdownOpen(true)}
                className="text-[11px] font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
              >
                Full breakdown
              </button>
            </div>
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Materials</dt>
                <dd className="tabular-nums font-medium">
                  {formatCurrency(totals.materials)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Labor</dt>
                <dd className="tabular-nums font-medium">
                  {formatCurrency(totals.labor)}
                </dd>
              </div>
              <div className="flex justify-between text-[12px]">
                <dt className="text-muted-foreground">
                  Paint hrs / Prep hrs
                </dt>
                <dd className="tabular-nums">
                  {formatNumber(totals.paintLaborHours)} /{" "}
                  {formatNumber(totals.prepHours)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Extras</dt>
                <dd className="tabular-nums">
                  {formatCurrency(totals.extrasTotal)}
                </dd>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <dt>Discount</dt>
                  <dd className="tabular-nums">
                    −{formatCurrency(totals.discount)}
                  </dd>
                </div>
              )}
              {totals.paintEfficiencyDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <dt className="pr-2">
                    Paint efficiency
                    <span className="mt-0.5 block text-[11px] font-normal text-emerald-600/80">
                      {paintPackaging.efficiencyGallons} gal shared across rooms
                    </span>
                  </dt>
                  <dd className="tabular-nums">
                    −{formatCurrency(totals.paintEfficiencyDiscount)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5">
                <dt>Subtotal</dt>
                <dd className="tabular-nums font-medium">
                  {formatCurrency(totals.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="tabular-nums">
                  {formatCurrency(totals.taxAmount)}
                </dd>
              </div>
              <div className="flex justify-between border-t pt-1.5 text-[15px] font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCurrency(totals.total)}</dd>
              </div>
              <div className="flex justify-between text-[12px]">
                <dt className="text-muted-foreground">Sales rate</dt>
                <dd className="tabular-nums">
                  {formatCurrency(totals.salesRate)}/hr
                </dd>
              </div>
              <div className="flex justify-between text-[12px]">
                <dt className="text-muted-foreground">Profit margin</dt>
                <dd className="tabular-nums">
                  {formatNumber(totals.profitMarginPct, 1)}%
                  <span className="text-muted-foreground">
                    {" "}
                    (target {profitTarget}%)
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-sm border p-3 space-y-2">
            <h2 className="section-label">Overrides</h2>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Labor $/hr"
                value={laborRate}
                onChange={setLaborRate}
              />
              <Field label="Waste %" value={waste} onChange={setWaste} />
              <Field label="Markup %" value={markup} onChange={setMarkup} />
              <Field label="Tax %" value={taxRate} onChange={setTaxRate} />
              <Field label="Prep %" value={prepPct} onChange={setPrepPct} />
              <Field
                label="Discount %"
                value={discountPct}
                onChange={setDiscountPct}
              />
            </div>
            <div>
              <Label className="text-[11px]">
                Profit target % ({profitTarget})
              </Label>
              <input
                type="range"
                min={0}
                max={60}
                value={profitTarget}
                onChange={(e) => setProfitTarget(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </aside>
      </div>

      <RoomTypePicker
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open) setPickerKindFilter(null);
        }}
        kindFilter={pickerKindFilter}
        doorDeductionSqft={settings.doorDeductionSqft}
        windowDeductionSqft={settings.windowDeductionSqft}
        onSelect={(preset) => {
          setEditor({
            kind: preset.kind,
            roomIdx: null,
            preset,
          });
        }}
      />

      <RoomEditorModal
        open={editor != null}
        onOpenChange={(v) => {
          if (!v) setEditor(null);
        }}
        kind={editor?.kind ?? "interior"}
        preset={editor?.roomIdx == null ? editor?.preset ?? null : null}
        initialRoom={editingRoom}
        products={products}
        rates={rates}
        doorDeductionSqft={settings.doorDeductionSqft}
        windowDeductionSqft={settings.windowDeductionSqft}
        wasteFactorPct={waste}
        materialMarkupPct={markup}
        laborRate={laborRate}
        prepPct={prepPct}
        defaultCoverageSqftPerGallon={settings.defaultCoverageSqftPerGallon}
        surfaceProductDefaults={surfaceProductDefaults}
        projectColors={projectColors}
        onProjectColorsChange={setProjectColors}
        existingRoomNames={rooms.map((r) => r.name)}
        excludeRoomIndex={editor?.roomIdx ?? null}
        onSave={saveEditorRoom}
      />

      {quickAssignRoomIdx != null && rooms[quickAssignRoomIdx] ? (
        <QuickAssignPaintModal
          open
          roomName={rooms[quickAssignRoomIdx].name}
          stepLabel={
            quickAssignSessionTotal > 1
              ? `Room ${quickAssignSessionTotal - quickAssignQueue.length} of ${quickAssignSessionTotal}`
              : undefined
          }
          nextRoomName={
            quickAssignQueue.length > 0
              ? rooms[quickAssignQueue[0]]?.name
              : undefined
          }
          primaryLabel={
            quickAssignQueue.length > 0 ? "Apply & next" : "Apply to surfaces"
          }
          projectColors={projectColors}
          onProjectColorsChange={setProjectColors}
          surfaces={rooms[quickAssignRoomIdx].surfaces.map((s) => {
            const product = s.paintProductId
              ? productMap[s.paintProductId]
              : null;
            const prefix = `${rooms[quickAssignRoomIdx].name} — `;
            const label = s.description.startsWith(prefix)
              ? s.description.slice(prefix.length)
              : s.description;
            return {
              _key: s._key,
              label,
              surfaceType: s.surfaceType,
              featureKey: s.featureKey,
              paintProductId: s.paintProductId,
              productName: product?.name ?? null,
              sheen: s.sheen,
              colorName: s.colorName,
              sheenOptions: product?.sheens?.length
                ? product.sheens.map((x) => x.name)
                : product?.sheen
                  ? [product.sheen]
                  : [],
            };
          })}
          onClose={() => clearQuickAssignSession()}
          onApply={(updates) => {
            const idx = quickAssignRoomIdx;
            if (idx == null) return;
            const byKey = new Map(updates.map((u) => [u._key, u]));
            const remaining = quickAssignQueue;

            setRooms((prev) => {
              const next = [...prev];
              const room = next[idx];
              if (!room) return prev;
              next[idx] = {
                ...room,
                surfaces: room.surfaces.map((s) => {
                  const u = byKey.get(s._key);
                  if (!u) return s;
                  return {
                    ...s,
                    sheen: u.sheen,
                    colorName: u.colorName,
                    colorHex: null,
                  };
                }),
              };
              return next;
            });

            if (remaining.length > 0) {
              const [nextIdx, ...rest] = remaining;
              setQuickAssignRoomIdx(nextIdx);
              setQuickAssignQueue(rest);
              toast.success(
                `${rooms[idx]?.name ?? "Room"} updated — next: ${rooms[nextIdx]?.name ?? "room"}`
              );
              return;
            }

            clearQuickAssignSession();
            toast.success("Colors & sheens updated");
          }}
        />
      ) : null}

      <JobBreakdownModal
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        title={title}
        estimateNumber={estimate.estimateNumber}
        paintPackaging={paintPackaging}
        projectColors={projectColors}
        rooms={computed.map(({ room, surfaces }) => ({
          name: room.name,
          kind: room.kind,
          surfaces: surfaces.map(({ li, calc }) => ({
            description: li.description,
            measureLabel:
              li.measurementType === "unit"
                ? `${li.quantity ?? 0} ${li.unitLabel || "units"}`
                : `${li.inputAreaSqft ?? 0} sq ft`,
            coats: li.coats,
            gallons: calc.gallons,
            laborHours: calc.laborHours,
            prepHours: calc.prepHours,
            materialCost: calc.materialCost,
            laborCost: calc.laborCost,
            lineTotal: calc.lineTotal,
            paintProductId: li.paintProductId,
            sheen: li.sheen,
            colorName: li.colorName,
            colorHex: li.colorHex,
            productName: li.paintProductId
              ? productMap[li.paintProductId]?.name ?? null
              : null,
          })),
        }))}
        jobTotals={{
          materials: totals.materials,
          labor: totals.labor,
          paintLaborHours: totals.paintLaborHours,
          prepHours: totals.prepHours,
          totalHours: totals.totalHours,
          discount: totals.discount,
          paintEfficiencyDiscount: totals.paintEfficiencyDiscount,
          taxAmount: totals.taxAmount,
          total: totals.total,
        }}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <Label className="text-[11px]">{label}</Label>
      <NumberInput
        value={value}
        onChange={onChange}
        className="h-7 text-[12px]"
      />
    </div>
  );
}
