import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listEstimates } from "@/lib/actions";
import { formatCurrency } from "@/lib/calculations";
import { statusColor, ESTIMATE_STATUSES, cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImportEstimateButton } from "@/components/estimates/import-estimate-button";
import { DeleteEstimateButton } from "@/components/estimates/delete-estimate-button";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default function EstimatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <div>
          <h1 className="text-base font-semibold">Estimates</h1>
          <p className="text-[11px] text-muted-foreground">
            Draft, send, and track proposals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportEstimateButton />
          <Link
            href="/estimates/new"
            className={cn(buttonVariants({ size: "sm" }), "h-8")}
          >
            <Plus className="size-3.5" />
            New Estimate
          </Link>
        </div>
      </header>

      <Suspense fallback={<EstimatesTableSkeleton />}>
        <EstimatesBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EstimatesBody({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const estimates = await listEstimates(status);

  return (
    <>
      <div className="flex gap-1 border-b border-border bg-card px-4 py-2">
        <FilterChip href="/estimates" active={!status} label="All" />
        {ESTIMATE_STATUSES.map((s) => (
          <FilterChip
            key={s.value}
            href={`/estimates?status=${s.value}`}
            active={status === s.value}
            label={s.label}
          />
        ))}
      </div>

      <div className="p-4">
        <div className="panel overflow-hidden">
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th className="text-left">Number</th>
                <th className="text-left">Title</th>
                <th className="text-left">Customer</th>
                <th>Status</th>
                <th className="text-left">Updated</th>
                <th className="text-right">Rooms</th>
                <th className="text-right">Total</th>
                <th className="w-10">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {estimates.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No estimates. Create one or load a template in the builder.
                  </td>
                </tr>
              )}
              {estimates.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link
                      href={`/estimates/${e.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {e.estimateNumber}
                    </Link>
                  </td>
                  <td className="max-w-[220px] truncate">{e.title}</td>
                  <td className="text-muted-foreground">
                    {e.customer?.name ?? "—"}
                  </td>
                  <td>
                    <Badge
                      variant="outline"
                      className="h-5 gap-1.5 rounded-sm px-1.5 text-[10px] capitalize"
                    >
                      <span
                        className={`size-1.5 rounded-full ${statusColor(e.status)}`}
                      />
                      {e.status}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground">
                    {format(e.updatedAt, "MMM d, yyyy")}
                  </td>
                  <td className="num">{e._count.rooms}</td>
                  <td className="num font-semibold">
                    {formatCurrency(e.total)}
                  </td>
                  <td className="text-right">
                    <DeleteEstimateButton
                      estimateId={e.id}
                      estimateNumber={e.estimateNumber}
                      title={e.title}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function EstimatesTableSkeleton() {
  return (
    <>
      <div className="flex gap-1 border-b border-border bg-card px-4 py-2">
        {["All", "Draft", "Sent", "Accepted", "Declined"].map((label) => (
          <span
            key={label}
            className="rounded-sm bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground/50"
          >
            {label}
          </span>
        ))}
      </div>
      <div className="p-4">
        <div className="panel overflow-hidden">
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-border px-3 py-3 last:border-b-0"
              >
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                <div className="ml-auto h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-sm px-2.5 py-1 text-[11px] font-medium ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-accent"
      }`}
    >
      {label}
    </Link>
  );
}
