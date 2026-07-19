"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Briefcase,
  Settings,
  HelpCircle,
  PlusCircle,
  PaintBucket,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { useSettingsModal } from "@/components/settings/settings-modal-provider";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/estimates/new", label: "New Estimate", icon: PlusCircle },
  { href: "/estimates", label: "Estimates", icon: ClipboardList },
  { href: "/products", label: "Product Library", icon: PaintBucket },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/help", label: "Help / Rates", icon: HelpCircle },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { open, openSettings } = useSettingsModal();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    for (const item of NAV) {
      void router.prefetch(item.href);
    }
    void router.prefetch("/");
  }, [router]);

  if (pathname.includes("/proposal")) return null;

  return (
    <aside className="flex w-[200px] shrink-0 flex-col bg-sidebar text-sidebar-foreground print:hidden">
      <Link
        href="/"
        prefetch
        title="Back to website"
        aria-label="Back to PainterApps Pro website"
        className="flex items-center gap-2.5 border-b border-sidebar-border px-3 py-3 transition-colors hover:bg-sidebar-accent/40"
      >
        <Logo variant="icon" size="sm" />
        <div className="leading-tight">
          <div className="text-[13px] font-bold tracking-tight text-white">
            PainterApps Pro
          </div>
          <div className="text-[10px] text-slate-400">Local Estimating</div>
        </div>
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : item.href === "/estimates"
                ? pathname === "/estimates" ||
                  (pathname.startsWith("/estimates/") &&
                    !pathname.startsWith("/estimates/new"))
                : item.href === "/estimates/new"
                  ? pathname.startsWith("/estimates/new")
                  : pathname.startsWith(item.href);
          const pending = pendingHref === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onClick={() => {
                if (!active) setPendingHref(item.href);
              }}
              className={cn(
                "flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-[13px] transition-colors",
                active || pending
                  ? "bg-sidebar-accent text-white font-medium"
                  : "text-slate-300 hover:bg-sidebar-accent/60 hover:text-white",
                pending && !active && "opacity-80"
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {item.label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => openSettings()}
          className={cn(
            "flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[13px] transition-colors",
            open
              ? "bg-sidebar-accent font-medium text-white"
              : "text-slate-300 hover:bg-sidebar-accent/60 hover:text-white"
          )}
        >
          <Settings className="h-4 w-4 shrink-0 opacity-80" />
          Settings
        </button>
      </nav>
    </aside>
  );
}
