import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { isPaintProductCategory } from "@/lib/paint-product-category";
import {
  productNameKey,
  type ManufacturerCatalogProduct,
} from "@/lib/xai-product-lookup";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

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
      product?: {
        id: string;
        name: string;
        brand: string;
        coverageSqftPerGallon: number;
        pricePerGallon: number;
        sheen: string | null;
        sheens: Array<{ id: string; name: string; sortOrder: number }>;
        category: string;
        defaultSurfaceType: string | null;
        features: string;
        canImageUrl: string | null;
        dataSheetUrl: string | null;
        notes: string | null;
        isActive: boolean;
        updatedAt: Date;
      };
    }
  | {
      type: "done";
      brand: string;
      imported: number;
      skipped: number;
      failed: number;
    }
  | { type: "error"; message: string };

function encode(event: ProgressEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

async function createCatalogProduct(
  brand: string,
  item: ManufacturerCatalogProduct,
  defaults: { coverage: number; price: number }
) {
  const sheenNames = Array.from(
    new Set((item.sheens ?? []).map((s) => s.trim()).filter(Boolean))
  );
  const category = isPaintProductCategory(item.category)
    ? item.category
    : "both";
  const coverage =
    item.coverageSqftPerGallon && item.coverageSqftPerGallon > 0
      ? item.coverageSqftPerGallon
      : defaults.coverage;
  const price =
    item.pricePerGallon != null && item.pricePerGallon >= 0
      ? item.pricePerGallon
      : defaults.price;

  return prisma.$transaction(async (tx) => {
    const product = await tx.paintProduct.create({
      data: {
        name: item.name,
        brand,
        coverageSqftPerGallon: coverage,
        pricePerGallon: price,
        sheen: sheenNames[0] ?? null,
        category,
        features: item.features?.trim() || "",
        notes: item.notes?.trim() || null,
        isActive: true,
      },
    });
    if (sheenNames.length) {
      await tx.paintProductSheen.createMany({
        data: sheenNames.map((name, sortOrder) => ({
          paintProductId: product.id,
          name,
          sortOrder,
        })),
      });
    }
    return tx.paintProduct.findUniqueOrThrow({
      where: { id: product.id },
      include: {
        sheens: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      },
    });
  });
}

export async function POST(req: Request) {
  let body: { manufacturer?: string };
  try {
    body = (await req.json()) as { manufacturer?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const manufacturer = body.manufacturer?.trim() ?? "";
  if (manufacturer.length < 2) {
    return NextResponse.json(
      { error: "Enter a paint manufacturer name." },
      { status: 400 }
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ProgressEvent) => {
        controller.enqueue(encode(event));
      };

      try {
        await ensureSeeded();

        const existing = await prisma.paintProduct.findMany({
          select: { name: true, brand: true },
        });
        const manufacturerKey = manufacturer.trim().toLowerCase();
        const existingForBrand = existing.filter((p) => {
          const b = p.brand.trim().toLowerCase();
          return (
            b === manufacturerKey ||
            b.includes(manufacturerKey) ||
            manufacturerKey.includes(b)
          );
        });
        const existingNames = new Set(
          existingForBrand.map((p) => productNameKey(p.name)).filter(Boolean)
        );
        const excludeNames = existingForBrand.map((p) => p.name);

        send({
          type: "status",
          message:
            existingNames.size > 0
              ? `Searching ${manufacturer} site (skipping ${existingNames.size} already in library)…`
              : `Searching ${manufacturer} official site for paint products…`,
        });

        const { discoverManufacturerPaintCatalog } = await import(
          "@/lib/xai-product-lookup"
        );
        const catalog = await discoverManufacturerPaintCatalog({
          manufacturer,
          excludeNames,
        });

        // Also treat catalog brand spelling as owned names
        for (const p of existing) {
          if (
            p.brand.trim().toLowerCase() === catalog.brand.trim().toLowerCase()
          ) {
            existingNames.add(productNameKey(p.name));
          }
        }

        send({
          type: "found",
          brand: catalog.brand,
          website: catalog.website,
          total: catalog.products.length,
        });

        const settings = await prisma.businessSettings.findFirst();
        const defaults = {
          coverage: settings?.defaultCoverageSqftPerGallon ?? 375,
          price: 55,
        };

        let imported = 0;
        let skipped = 0;
        let failed = 0;
        const total = catalog.products.length;

        for (let i = 0; i < total; i++) {
          const item = catalog.products[i];
          send({
            type: "item",
            index: i,
            total,
            name: item.name,
            status: "importing",
          });

          const key = productNameKey(item.name);
          if (existingNames.has(key)) {
            skipped += 1;
            send({
              type: "item",
              index: i,
              total,
              name: item.name,
              status: "skipped",
              reason: "Already in library",
            });
            continue;
          }

          try {
            const saved = await createCatalogProduct(
              catalog.brand,
              item,
              defaults
            );
            existingNames.add(productNameKey(item.name));
            imported += 1;
            send({
              type: "item",
              index: i,
              total,
              name: item.name,
              status: "imported",
              product: {
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
                dataSheetUrl: saved.dataSheetUrl ?? null,
                notes: saved.notes,
                isActive: saved.isActive,
                updatedAt: saved.updatedAt,
              },
            });
          } catch (e) {
            failed += 1;
            send({
              type: "item",
              index: i,
              total,
              name: item.name,
              status: "failed",
              reason: e instanceof Error ? e.message : "Import failed",
            });
          }
        }

        revalidatePath("/products");
        revalidatePath("/settings");
        send({
          type: "done",
          brand: catalog.brand,
          imported,
          skipped,
          failed,
        });
      } catch (e) {
        send({
          type: "error",
          message: e instanceof Error ? e.message : "Catalog import failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
