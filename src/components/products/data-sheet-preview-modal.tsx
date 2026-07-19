"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function DataSheetPreviewModal({
  open,
  onOpenChange,
  url,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  title?: string | null;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || !url) {
      setLoaded(false);
      return;
    }
    setLoaded(false);
  }, [open, url]);

  return (
    <Dialog open={open && !!url} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName="z-[70] bg-black/45 supports-backdrop-filter:backdrop-blur-sm"
        className={cn(
          "z-[70] flex h-[min(94dvh,1100px)] w-[min(calc(100vw-1.5rem),1120px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        )}
      >
        <DialogHeader className="shrink-0 flex-row items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 pr-12 text-left">
          <div className="min-w-0">
            <DialogTitle className="truncate text-[15px]">
              {title?.trim() || "Product data sheet"}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[12px]">
              Product data sheet · scroll to read
            </DialogDescription>
          </div>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[12px] font-medium hover:bg-muted"
            >
              <ExternalLink className="size-3.5" />
              Open file
            </a>
          ) : null}
        </DialogHeader>

        <div className="relative min-h-0 flex-1 bg-slate-200/90">
          {!loaded ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="size-6 animate-spin" />
              <span className="text-[13px]">Loading data sheet…</span>
            </div>
          ) : null}

          {open && url ? (
            <iframe
              key={url}
              src={url}
              title={title?.trim() || "Product data sheet"}
              className={cn(
                "h-full w-full border-0 bg-white transition-opacity duration-150",
                loaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => setLoaded(true)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
