/**
 * Paint packaging: round up gallons by product × sheen × color per room,
 * then compare to project-level pooling for an efficiency discount.
 *
 * Room purchase gallons = ceil(sum of raw gallons in that room for the combo)
 * Project purchase gallons = ceil(sum of raw gallons across all rooms for the combo)
 * Efficiency gallons = max(0, Σ room purchase − Σ project purchase)
 */

import { roundMoney, roundQty } from "@/lib/calculations";

export type PaintPackageKey = {
  paintProductId: string;
  sheen: string;
  colorName: string;
  colorHex: string | null;
};

export type PaintPackageLineInput = {
  roomKey: string;
  roomName: string;
  surfaceKey: string;
  description: string;
  paintProductId: string | null | undefined;
  productName: string;
  pricePerGallon: number;
  sheen: string | null | undefined;
  colorName: string | null | undefined;
  colorHex: string | null | undefined;
  /** Exact calculated gallons (before packaging) */
  rawGallons: number;
  materialMarkupPct: number;
};

export type RoomPaintPackage = PaintPackageKey & {
  productName: string;
  pricePerGallon: number;
  roomKey: string;
  roomName: string;
  rawGallons: number;
  purchaseGallons: number;
  /** Material $ from exact gallons (before can rounding) */
  rawMaterialCost: number;
  /** Material $ from purchased (ceiled) gallons for this room */
  materialCost: number;
  surfaceKeys: string[];
  surfaceLabels: string[];
};

export type ProjectPaintPackage = PaintPackageKey & {
  productName: string;
  pricePerGallon: number;
  rawGallons: number;
  /** Sum of per-room ceiled gallons */
  roomPurchaseGallons: number;
  /** Single project-level ceil */
  projectPurchaseGallons: number;
  efficiencyGallons: number;
  roomMaterialCost: number;
  projectMaterialCost: number;
  efficiencyDiscount: number;
  rooms: Array<{
    roomKey: string;
    roomName: string;
    rawGallons: number;
    purchaseGallons: number;
  }>;
};

export type PaintPackagingResult = {
  roomPackages: RoomPaintPackage[];
  projectPackages: ProjectPaintPackage[];
  /** Sum of raw gallons across all painted surfaces */
  totalRawGallons: number;
  /** Exact material $ from continuous gallons (before can rounding) */
  rawMaterialTotal: number;
  /** Sum of per-room purchase gallons (customer pays before efficiency) */
  totalRoomPurchaseGallons: number;
  /** Sum of project-pooled purchase gallons */
  totalProjectPurchaseGallons: number;
  /** Material $ if buying per-room rounded cans */
  roomMaterialTotal: number;
  /** Material $ if buying project-pooled cans */
  projectMaterialTotal: number;
  /** roomMaterialTotal − projectMaterialTotal (shared-gallon savings) */
  efficiencyDiscount: number;
  efficiencyGallons: number;
};

function packageKeyString(k: PaintPackageKey): string {
  return [
    k.paintProductId,
    k.sheen.trim().toLowerCase() || "—",
    k.colorName.trim().toLowerCase() || "unspecified",
  ].join("||");
}

export function normalizePaintPackageKey(
  input: Pick<
    PaintPackageLineInput,
    "paintProductId" | "sheen" | "colorName" | "colorHex"
  >
): PaintPackageKey | null {
  if (!input.paintProductId) return null;
  return {
    paintProductId: input.paintProductId,
    sheen: (input.sheen ?? "").trim() || "—",
    colorName: (input.colorName ?? "").trim() || "Unspecified",
    colorHex: input.colorHex?.trim() || null,
  };
}

function materialForGallons(
  gallons: number,
  pricePerGallon: number,
  markupPct: number
): number {
  return roundMoney(gallons * pricePerGallon * (1 + (markupPct || 0) / 100));
}

/** Ceil to next whole gallon; 0 stays 0. Tiny leftovers still need a can. */
export function ceilGallons(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.ceil(raw - 1e-9);
}

export function calculatePaintPackaging(
  lines: PaintPackageLineInput[]
): PaintPackagingResult {
  const paintable = lines.filter(
    (l) => l.paintProductId && l.rawGallons > 0 && l.pricePerGallon > 0
  );

  // roomKey + packageKey → accumulate
  type Acc = {
    key: PaintPackageKey;
    productName: string;
    pricePerGallon: number;
    markupPct: number;
    roomKey: string;
    roomName: string;
    rawGallons: number;
    surfaceKeys: string[];
    surfaceLabels: string[];
  };

  const roomMap = new Map<string, Acc>();

  for (const line of paintable) {
    const key = normalizePaintPackageKey(line);
    if (!key) continue;
    const mapKey = `${line.roomKey}::${packageKeyString(key)}`;
    const existing = roomMap.get(mapKey);
    if (existing) {
      existing.rawGallons += line.rawGallons;
      existing.surfaceKeys.push(line.surfaceKey);
      existing.surfaceLabels.push(line.description);
    } else {
      roomMap.set(mapKey, {
        key,
        productName: line.productName,
        pricePerGallon: line.pricePerGallon,
        markupPct: line.materialMarkupPct,
        roomKey: line.roomKey,
        roomName: line.roomName,
        rawGallons: line.rawGallons,
        surfaceKeys: [line.surfaceKey],
        surfaceLabels: [line.description],
      });
    }
  }

  const roomPackages: RoomPaintPackage[] = [...roomMap.values()].map((a) => {
    const rawGallons = roundQty(a.rawGallons, 2);
    const purchaseGallons = ceilGallons(rawGallons);
    return {
      ...a.key,
      productName: a.productName,
      pricePerGallon: a.pricePerGallon,
      roomKey: a.roomKey,
      roomName: a.roomName,
      rawGallons,
      purchaseGallons,
      rawMaterialCost: materialForGallons(
        rawGallons,
        a.pricePerGallon,
        a.markupPct
      ),
      materialCost: materialForGallons(
        purchaseGallons,
        a.pricePerGallon,
        a.markupPct
      ),
      surfaceKeys: a.surfaceKeys,
      surfaceLabels: a.surfaceLabels,
    };
  });

  // Project pool by package key
  type ProjAcc = {
    key: PaintPackageKey;
    productName: string;
    pricePerGallon: number;
    markupPct: number;
    rawGallons: number;
    roomPurchaseGallons: number;
    roomMaterialCost: number;
    rooms: ProjectPaintPackage["rooms"];
  };

  const projectMap = new Map<string, ProjAcc>();
  for (const rp of roomPackages) {
    const pk = packageKeyString(rp);
    const existing = projectMap.get(pk);
    if (existing) {
      existing.rawGallons += rp.rawGallons;
      existing.roomPurchaseGallons += rp.purchaseGallons;
      existing.roomMaterialCost += rp.materialCost;
      existing.rooms.push({
        roomKey: rp.roomKey,
        roomName: rp.roomName,
        rawGallons: rp.rawGallons,
        purchaseGallons: rp.purchaseGallons,
      });
      if (!existing.key.colorHex && rp.colorHex) {
        existing.key.colorHex = rp.colorHex;
      }
    } else {
      projectMap.set(pk, {
        key: { ...rp },
        productName: rp.productName,
        pricePerGallon: rp.pricePerGallon,
        markupPct:
          paintable.find(
            (l) =>
              l.paintProductId === rp.paintProductId &&
              (l.sheen ?? "—") === rp.sheen
          )?.materialMarkupPct ?? 0,
        rawGallons: rp.rawGallons,
        roomPurchaseGallons: rp.purchaseGallons,
        roomMaterialCost: rp.materialCost,
        rooms: [
          {
            roomKey: rp.roomKey,
            roomName: rp.roomName,
            rawGallons: rp.rawGallons,
            purchaseGallons: rp.purchaseGallons,
          },
        ],
      });
    }
  }

  // Fix markup from first matching room package's implied markup
  for (const rp of roomPackages) {
    const pk = packageKeyString(rp);
    const p = projectMap.get(pk);
    if (!p || p.pricePerGallon <= 0) continue;
    // recover markup from room package if needed
    if (rp.purchaseGallons > 0 && rp.materialCost > 0) {
      const unit = rp.materialCost / rp.purchaseGallons / rp.pricePerGallon;
      p.markupPct = Math.max(0, roundQty((unit - 1) * 100, 2));
    }
  }

  const projectPackages: ProjectPaintPackage[] = [...projectMap.values()].map(
    (a) => {
      const rawGallons = roundQty(a.rawGallons, 2);
      const roomPurchaseGallons = a.roomPurchaseGallons;
      const projectPurchaseGallons = ceilGallons(rawGallons);
      const efficiencyGallons = Math.max(
        0,
        roomPurchaseGallons - projectPurchaseGallons
      );
      const roomMaterialCost = roundMoney(a.roomMaterialCost);
      const projectMaterialCost = materialForGallons(
        projectPurchaseGallons,
        a.pricePerGallon,
        a.markupPct
      );
      const efficiencyDiscount = Math.max(
        0,
        roundMoney(roomMaterialCost - projectMaterialCost)
      );
      return {
        ...a.key,
        productName: a.productName,
        pricePerGallon: a.pricePerGallon,
        rawGallons,
        roomPurchaseGallons,
        projectPurchaseGallons,
        efficiencyGallons,
        roomMaterialCost,
        projectMaterialCost,
        efficiencyDiscount,
        rooms: a.rooms,
      };
    }
  );

  const totalRawGallons = roundQty(
    roomPackages.reduce((s, p) => s + p.rawGallons, 0),
    2
  );
  const rawMaterialTotal = roundMoney(
    paintable.reduce(
      (s, l) =>
        s +
        materialForGallons(l.rawGallons, l.pricePerGallon, l.materialMarkupPct),
      0
    )
  );
  const totalRoomPurchaseGallons = roomPackages.reduce(
    (s, p) => s + p.purchaseGallons,
    0
  );
  const totalProjectPurchaseGallons = projectPackages.reduce(
    (s, p) => s + p.projectPurchaseGallons,
    0
  );
  const roomMaterialTotal = roundMoney(
    roomPackages.reduce((s, p) => s + p.materialCost, 0)
  );
  const projectMaterialTotal = roundMoney(
    projectPackages.reduce((s, p) => s + p.projectMaterialCost, 0)
  );
  const efficiencyDiscount = Math.max(
    0,
    roundMoney(roomMaterialTotal - projectMaterialTotal)
  );
  const efficiencyGallons = Math.max(
    0,
    totalRoomPurchaseGallons - totalProjectPurchaseGallons
  );

  // Sort for stable UI
  roomPackages.sort((a, b) =>
    a.roomName.localeCompare(b.roomName) ||
    a.productName.localeCompare(b.productName) ||
    a.colorName.localeCompare(b.colorName)
  );
  projectPackages.sort((a, b) =>
    a.productName.localeCompare(b.productName) ||
    a.sheen.localeCompare(b.sheen) ||
    a.colorName.localeCompare(b.colorName)
  );

  return {
    roomPackages,
    projectPackages,
    totalRawGallons,
    rawMaterialTotal,
    totalRoomPurchaseGallons,
    totalProjectPurchaseGallons,
    roomMaterialTotal,
    projectMaterialTotal,
    efficiencyDiscount,
    efficiencyGallons,
  };
}

/**
 * Per-room uplift from exact gallons → purchased cans.
 * Room card total = continuous line total + this delta.
 */
export function roomPurchaseMaterialDeltaByKey(
  packaging: Pick<PaintPackagingResult, "roomPackages">
): Map<string, number> {
  const map = new Map<string, number>();
  for (const rp of packaging.roomPackages) {
    const delta = roundMoney(rp.materialCost - rp.rawMaterialCost);
    map.set(rp.roomKey, roundMoney((map.get(rp.roomKey) ?? 0) + delta));
  }
  return map;
}
