import Link from "next/link";
import { Plus } from "lucide-react";
import { getCustomer } from "@/lib/actions";
import { formatCurrency } from "@/lib/calculations";
import { statusColor } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let customer;
  try {
    customer = await getCustomer(id);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <div>
          <div className="text-[11px] text-muted-foreground">
            <Link href="/customers" className="hover:underline">
              Customers
            </Link>
            {" / "}
            {customer.name}
          </div>
          <h1 className="text-base font-semibold">{customer.name}</h1>
        </div>
        <Link
          href={`/estimates/new?customerId=${customer.id}`}
          className={cn(buttonVariants({ size: "sm" }), "h-8")}
        >
          <Plus className="size-3.5" />
          Create Estimate
        </Link>
      </header>

      <div className="grid gap-3 p-4 lg:grid-cols-3">
        <section className="panel p-3 lg:col-span-1">
          <h2 className="section-label mb-2">Contact</h2>
          <dl className="grid gap-1.5 text-[13px]">
            <Row label="Phone" value={customer.phone} />
            <Row label="Email" value={customer.email} />
            <Row
              label="Address"
              value={[customer.address, customer.city, customer.state, customer.zip]
                .filter(Boolean)
                .join(", ")}
            />
            {customer.notes && <Row label="Notes" value={customer.notes} />}
          </dl>
        </section>

        <section className="panel overflow-hidden lg:col-span-2">
          <div className="border-b border-border bg-muted/50 px-3 py-2">
            <h2 className="section-label">Estimates</h2>
          </div>
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th className="text-left">#</th>
                <th className="text-left">Title</th>
                <th>Status</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {customer.estimates.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No estimates for this customer.
                  </td>
                </tr>
              )}
              {customer.estimates.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link
                      href={`/estimates/${e.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {e.estimateNumber}
                    </Link>
                  </td>
                  <td>{e.title}</td>
                  <td>
                    <Badge variant="outline" className="h-5 gap-1.5 rounded-sm px-1.5 text-[10px] capitalize">
                      <span className={`size-1.5 rounded-full ${statusColor(e.status)}`} />
                      {e.status}
                    </Badge>
                  </td>
                  <td className="num font-medium">{formatCurrency(e.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
