import { Suspense } from "react";
import Link from "next/link";
import { Plus, Users, ClipboardList, Briefcase } from "lucide-react";
import { getDashboardData } from "@/lib/actions";
import { formatCurrency } from "@/lib/calculations";
import { statusColor, cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/components/layout/page-loading";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading dashboard" />}>
      <DashboardBody />
    </Suspense>
  );
}

async function DashboardBody() {
  const data = await getDashboardData();

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Dashboard</h1>
          <p className="text-[11px] text-muted-foreground">
            Pipeline overview — {format(new Date(), "EEEE, MMM d, yyyy")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/customers"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
          >
            <Users className="size-3.5" />
            New Customer
          </Link>
          <Link
            href="/estimates/new"
            className={cn(buttonVariants({ size: "sm" }), "h-8")}
          >
            <Plus className="size-3.5" />
            New Estimate
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
        <Kpi
          label="Estimates this month"
          value={String(data.estimatesThisMonth)}
          icon={<ClipboardList className="size-4 text-slate-500" />}
        />
        <Kpi
          label="Pipeline value"
          value={formatCurrency(data.pipelineValue)}
          sub="Draft + Sent"
          icon={<span className="text-sm font-semibold text-slate-500">$</span>}
        />
        <Kpi
          label="Accepted this month"
          value={String(data.acceptedThisMonth)}
          icon={<Briefcase className="size-4 text-emerald-600" />}
        />
        <Kpi
          label="Customers"
          value={String(data.customerCount)}
          icon={<Users className="size-4 text-slate-500" />}
        />
      </div>

      <div className="grid gap-3 px-4 pb-4 lg:grid-cols-2">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
            <h2 className="section-label">Recent Estimates</h2>
            <Link
              href="/estimates"
              className="text-[11px] text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th className="text-left">Estimate</th>
                <th className="text-left">Customer</th>
                <th>Status</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.recentEstimates.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No estimates yet. Create your first one.
                  </td>
                </tr>
              )}
              {data.recentEstimates.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link
                      href={`/estimates/${e.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {e.estimateNumber ?? e.title}
                    </Link>
                    <div className="truncate text-[11px] text-muted-foreground max-w-[180px]">
                      {e.title}
                    </div>
                  </td>
                  <td className="text-muted-foreground">
                    {e.customer?.name ?? "—"}
                  </td>
                  <td>
                    <StatusDot status={e.status} />
                  </td>
                  <td className="num font-medium">{formatCurrency(e.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
            <h2 className="section-label">Active Jobs</h2>
            <Link href="/jobs" className="text-[11px] text-primary hover:underline">
              View all
            </Link>
          </div>
          <table className="dense-table w-full">
            <thead>
              <tr>
                <th className="text-left">Job</th>
                <th className="text-left">Customer</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.activeJobs.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground">
                    No active jobs. Accept an estimate to schedule work.
                  </td>
                </tr>
              )}
              {data.activeJobs.map((j) => (
                <tr key={j.id}>
                  <td className="font-medium">{j.title}</td>
                  <td className="text-muted-foreground">{j.customer.name}</td>
                  <td>
                    <StatusDot status={j.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="panel flex items-start gap-3 px-3 py-3">
      <div className="mt-0.5 flex size-8 items-center justify-center rounded-sm bg-muted">
        {icon}
      </div>
      <div>
        <div className="section-label">{label}</div>
        <div className="mt-0.5 text-xl font-semibold tracking-tight num">
          {value}
        </div>
        {sub && (
          <div className="text-[10px] text-muted-foreground">{sub}</div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className="h-5 gap-1.5 rounded-sm px-1.5 text-[10px] font-medium capitalize"
    >
      <span className={`size-1.5 rounded-full ${statusColor(status)}`} />
      {status.replace("_", " ")}
    </Badge>
  );
}
