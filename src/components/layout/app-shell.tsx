"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare =
    pathname === "/" ||
    pathname.includes("/proposal");

  if (bare) {
    return (
      <div className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <>
      <AppSidebar />
      <main
        className={cn(
          "flex min-w-0 flex-1 flex-col overflow-auto p-3"
        )}
      >
        {children}
      </main>
    </>
  );
}
