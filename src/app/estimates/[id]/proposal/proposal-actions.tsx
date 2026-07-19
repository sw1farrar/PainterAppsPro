"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Printer, CheckCircle2 } from "lucide-react";
import { updateEstimateStatus } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function ProposalActions({
  estimateId,
  status,
}: {
  estimateId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        onClick={() => window.print()}
      >
        <Printer className="size-3.5" />
        Print / Save PDF
      </Button>
      {status !== "accepted" && (
        <Button
          size="sm"
          className="h-8"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await updateEstimateStatus(estimateId, "accepted");
              toast.success("Estimate accepted");
              router.refresh();
            })
          }
        >
          <CheckCircle2 className="size-3.5" />
          Accept Estimate
        </Button>
      )}
    </div>
  );
}
