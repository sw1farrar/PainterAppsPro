"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getSettings,
  listPaintProducts,
  listProductionRates,
} from "@/lib/actions";
import { SettingsClient } from "@/components/settings/settings-client";

type SettingsData = {
  settings: Awaited<ReturnType<typeof getSettings>>;
  products: Awaited<ReturnType<typeof listPaintProducts>>;
  rates: Awaited<ReturnType<typeof listProductionRates>>;
};

type SettingsModalContextValue = {
  open: boolean;
  loading: boolean;
  openSettings: () => void;
  closeSettings: () => void;
};

const SettingsModalContext = createContext<SettingsModalContextValue | null>(
  null
);

export function useSettingsModal() {
  const ctx = useContext(SettingsModalContext);
  if (!ctx) {
    throw new Error("useSettingsModal must be used within SettingsModalProvider");
  }
  return ctx;
}

export function SettingsModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, startLoad] = useTransition();

  const refresh = useCallback(() => {
    startLoad(async () => {
      try {
        const [settings, products, rates] = await Promise.all([
          getSettings(),
          listPaintProducts(),
          listProductionRates(),
        ]);
        setData({ settings, products, rates });
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "Could not load settings. Check the database migration."
        );
      }
    });
  }, []);

  const openSettings = useCallback(() => {
    setOpen(true);
    refresh();
  }, [refresh]);

  const closeSettings = useCallback(() => {
    setOpen(false);
  }, []);

  // Deep link: /settings opens the overlay and returns to a real page.
  useEffect(() => {
    if (pathname !== "/settings") return;
    setOpen(true);
    refresh();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [pathname, refresh, router]);

  const value = useMemo(
    () => ({
      open,
      loading,
      openSettings,
      closeSettings,
    }),
    [open, loading, openSettings, closeSettings]
  );

  return (
    <SettingsModalContext.Provider value={value}>
      {children}
      <SettingsClient
        open={open}
        onOpenChange={setOpen}
        loading={loading && !data}
        settings={data?.settings ?? null}
        products={data?.products ?? []}
        rates={data?.rates ?? []}
      />
    </SettingsModalContext.Provider>
  );
}
