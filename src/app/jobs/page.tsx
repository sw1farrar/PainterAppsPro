import { Suspense } from "react";
import Link from "next/link";
import { listJobs } from "@/lib/actions";
import { statusColor, JOB_STATUSES } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/calculations";
import { PageLoading } from "@/components/layout/page-loading";

export const dynamic = "force-dynamic";

export default function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Suspense fallback={<PageLoading label="Loading jobs" />}>
      <JobsBody searchParams={searchParams} />
    </Suspense>
  );
}

async function JobsBody({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const jobs = await listJobs(status);

  return (
    <div className="flex flex-col">
      <header className="border-b border-border bg-card px-4 py-2.5">
        <h1 className="text-base font-semibold">Jobs</h1>
        <p className="text-[11px] text-muted-foreground">
          {jobs.length} job{jobs.length === 1 ? "" : "s"} — accept estimates to schedule
        </p>
      </header>

      <div className="flex gap-1 border-b border-border bg-card px-4 py-2">
        <FilterChip href="/jobs" active={!status} label="All" />
        {JOB_STATUSES.map((s) => (
          <FilterChip
            key={s.value}
            href={`/jobs?status=${s.value}`}
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
                <th className="text-left">Job</th>
                <th className="text-left">Customer</th>
                <th className="text-left">Location</th>
                <th>Status</th>
                <th className="text-right">Estimates</th>
                <th className="text-right">Est. Value</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No jobs yet.
                  </td>
                </tr>
              )}
              {jobs.map((j) => {
                const value = j.estimates.reduce((s, e) => s + (e.total || 0), 0);
                return (
                  <tr key={j.id}>
                    <td className="font-medium">{j.title}</td>
                    <td>
                      <Link
                        href={`/customers/${j.customerId}`}
                        className="text-primary hover:underline"
                      >
                        {j.customer.name}
                      </Link>
                    </td>
                    <td className="text-muted-foreground">
                      {[j.city, j.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td>
                      <Badge
                        variant="outline"
                        className="h-5 gap-1.5 rounded-sm px-1.5 text-[10px] capitalize"
                      >
                        <span className={`size-1.5 rounded-full ${statusColor(j.status)}`} />
                        {j.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="num">
                      {j.estimates.map((e) => (
                        <Link
                          key={e.id}
                          href={`/estimates/${e.id}`}
                          className="ml-1 text-primary hover:underline"
                        >
                          view
                        </Link>
                      ))}
                      {j.estimates.length === 0 && "—"}
                    </td>
                    <td className="num font-medium">{formatCurrency(value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
