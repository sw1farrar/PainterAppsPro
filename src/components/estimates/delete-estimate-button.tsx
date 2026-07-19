"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteEstimate } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DeleteEstimateButton({
  estimateId,
  estimateNumber,
  title,
}: {
  estimateId: string;
  estimateNumber: string | null;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirmDelete() {
    start(async () => {
      try {
        await deleteEstimate(estimateId);
        toast.success("Estimate deleted");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  const label = estimateNumber?.trim() || title;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Delete ${label}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete estimate?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{label}</span>
              {title && estimateNumber ? (
                <>
                  {" "}
                  <span className="text-muted-foreground">· {title}</span>
                </>
              ) : null}
              <br />
              This permanently removes rooms, surfaces, photos, and pricing.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={confirmDelete}
            >
              {pending ? "Deleting…" : "Delete estimate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
