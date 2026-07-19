import { notFound } from "next/navigation";
import {
  getEstimate,
  listCustomerOptions,
  listPaintProducts,
  listProductionRates,
  getSettings,
} from "@/lib/actions";
import { EstimateBuilder } from "@/components/estimator/estimate-builder";

export const dynamic = "force-dynamic";

export default async function EstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ addRoom?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const addRoomKind =
    sp.addRoom === "exterior" ||
    sp.addRoom === "interior" ||
    sp.addRoom === "both"
      ? sp.addRoom
      : null;

  const [estimateResult, customers, products, rates, settings] =
    await Promise.all([
      getEstimate(id)
        .then((estimate) => ({ ok: true as const, estimate }))
        .catch(() => ({ ok: false as const })),
      listCustomerOptions(),
      listPaintProducts(),
      listProductionRates(),
      getSettings(),
    ]);

  if (!estimateResult.ok) notFound();
  const { estimate } = estimateResult;

  return (
    <EstimateBuilder
      estimate={estimate}
      customers={customers}
      products={products.filter((p) => p.isActive)}
      rates={rates.filter((r) => r.isActive)}
      initialAddRoomKind={addRoomKind}
      settings={{
        defaultLaborRate: settings.defaultLaborRate,
        materialMarkupPct: settings.materialMarkupPct,
        taxRatePct: settings.taxRatePct,
        wasteFactorPct: settings.wasteFactorPct,
        defaultPrepPct: settings.defaultPrepPct,
        defaultProfitTargetPct: settings.defaultProfitTargetPct,
        defaultCoverageSqftPerGallon: settings.defaultCoverageSqftPerGallon,
        doorDeductionSqft: settings.doorDeductionSqft,
        windowDeductionSqft: settings.windowDeductionSqft,
        companyName: settings.companyName,
        defaultProductsJson: settings.defaultProductsJson ?? null,
      }}
    />
  );
}
