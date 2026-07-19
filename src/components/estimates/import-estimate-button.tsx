"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { importEstimateJson } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function ImportEstimateButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        disabled={pending}
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3.5" />
        Import JSON
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          start(async () => {
            try {
              const text = await file.text();
              const raw = JSON.parse(text) as {
                estimate?: Record<string, unknown>;
                title?: string;
                rooms?: unknown[];
                extras?: unknown[];
              };
              const est = (raw.estimate ?? raw) as {
                title?: string;
                customerId?: string | null;
                notes?: string | null;
                wasteFactorPct?: number | null;
                materialMarkupPct?: number | null;
                laborRate?: number | null;
                taxRatePct?: number | null;
                prepPct?: number | null;
                discountPct?: number | null;
                discountAmount?: number | null;
                profitTargetPct?: number | null;
                rooms?: unknown[];
                extras?: unknown[];
              };
              const created = await importEstimateJson({
                title: est.title,
                customerId: est.customerId ?? null,
                notes: est.notes ?? null,
                wasteFactorPct: est.wasteFactorPct ?? null,
                materialMarkupPct: est.materialMarkupPct ?? null,
                laborRate: est.laborRate ?? null,
                taxRatePct: est.taxRatePct ?? null,
                prepPct: est.prepPct ?? null,
                discountPct: est.discountPct ?? null,
                discountAmount: est.discountAmount ?? null,
                profitTargetPct: est.profitTargetPct ?? null,
                rooms: (est.rooms as never) ?? [],
                extras: (est.extras as never) ?? [],
              });
              toast.success("Estimate imported");
              router.push(`/estimates/${created.id}`);
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Import failed"
              );
            }
          });
          e.target.value = "";
        }}
      />
    </>
  );
}
