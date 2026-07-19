import { Suspense } from "react";
import { listCustomers } from "@/lib/actions";
import { CustomersClient } from "@/components/customers/customers-client";
import { PageLoading } from "@/components/layout/page-loading";

export const dynamic = "force-dynamic";

export default function CustomersPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading customers" />}>
      <CustomersBody />
    </Suspense>
  );
}

async function CustomersBody() {
  const customers = await listCustomers();
  return <CustomersClient initial={customers} />;
}
