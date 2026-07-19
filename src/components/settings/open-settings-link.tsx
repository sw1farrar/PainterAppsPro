"use client";

import { useSettingsModal } from "@/components/settings/settings-modal-provider";
import { cn } from "@/lib/utils";

/** Inline control that opens the settings overlay without a page navigation. */
export function OpenSettingsLink({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { openSettings } = useSettingsModal();
  return (
    <button
      type="button"
      onClick={() => openSettings()}
      className={cn(
        "cursor-pointer text-primary underline-offset-2 hover:underline",
        className
      )}
    >
      {children}
    </button>
  );
}
