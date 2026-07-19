import { listCustomerOptions } from "@/lib/actions";
import { NewEstimateClient } from "./new-estimate-client";

export const dynamic = "force-dynamic";

/**
 * Setup modal: customer, job name, Interior/Exterior — then create estimate.
 */
export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; jobId?: string }>;
}) {
  const sp = await searchParams;
  const customers = await listCustomerOptions();

  return (
    <NewEstimateClient
      customers={customers}
      customerId={sp.customerId}
      jobId={sp.jobId}
    />
  );
}
