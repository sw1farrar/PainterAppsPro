import { Suspense } from "react";
import { getSettings, listPaintProducts } from "@/lib/actions";
import { ProductsClient } from "@/components/products/products-client";
import { PageLoading } from "@/components/layout/page-loading";

export const dynamic = "force-dynamic";

export default function ProductsPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading products" />}>
      <ProductsBody />
    </Suspense>
  );
}

async function ProductsBody() {
  const [products, settings] = await Promise.all([
    listPaintProducts(),
    getSettings(),
  ]);
  return (
    <ProductsClient
      defaultSpreadRating={settings.defaultCoverageSqftPerGallon}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        coverageSqftPerGallon: p.coverageSqftPerGallon,
        pricePerGallon: p.pricePerGallon,
        sheen: p.sheen,
        sheens: p.sheens.map((s) => ({
          id: s.id,
          name: s.name,
          sortOrder: s.sortOrder,
        })),
        category: p.category ?? "both",
        defaultSurfaceType: p.defaultSurfaceType ?? null,
        features: p.features ?? "",
        canImageUrl: p.canImageUrl ?? null,
        notes: p.notes,
        isActive: p.isActive,
        updatedAt: p.updatedAt,
      }))}
    />
  );
}
