"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const HISTORY_BACK = "__history_back__";

function isModifiedClick(e: MouseEvent) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

function resolveHref(anchor: HTMLAnchorElement): string | null {
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  const raw = anchor.getAttribute("href");
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
    return null;
  }
  try {
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin) return null;
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === current) return null;
    return next;
  } catch {
    return null;
  }
}

/**
 * Blocks in-app navigation, browser back, and tab close while `isDirty`.
 * Renders Save / Discard / Keep editing confirmation.
 */
export function useUnsavedNavigationGuard({
  isDirty,
  onSave,
}: {
  isDirty: boolean;
  /** Persist changes; resolve true on success. */
  onSave: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isDirtyRef = useRef(isDirty);
  const allowNextNavRef = useRef(false);
  isDirtyRef.current = isDirty;

  const requestLeave = useCallback((href: string) => {
    setPendingHref(href);
    setOpen(true);
  }, []);

  const finishLeave = useCallback(
    (href: string) => {
      allowNextNavRef.current = true;
      setOpen(false);
      setPendingHref(null);
      if (href === HISTORY_BACK) {
        window.history.go(-1);
        return;
      }
      router.push(href);
    },
    [router]
  );

  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const onClick = (e: MouseEvent) => {
      if (!isDirtyRef.current || allowNextNavRef.current) return;
      if (isModifiedClick(e)) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = resolveHref(anchor);
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      requestLeave(href);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty, requestLeave]);

  useEffect(() => {
    if (!isDirty) return;

    const onPopState = () => {
      if (!isDirtyRef.current || allowNextNavRef.current) {
        allowNextNavRef.current = false;
        return;
      }
      // Undo the back/forward navigation, then ask.
      window.history.go(1);
      requestLeave(HISTORY_BACK);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isDirty, requestLeave]);

  async function handleSaveAndLeave() {
    if (!pendingHref) return;
    setSaving(true);
    try {
      const ok = await onSave();
      if (ok) finishLeave(pendingHref);
    } finally {
      setSaving(false);
    }
  }

  function handleDiscardAndLeave() {
    if (!pendingHref) return;
    isDirtyRef.current = false;
    finishLeave(pendingHref);
  }

  const dialog = (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false);
          setPendingHref(null);
        }
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved edits on this estimate. Save them before leaving,
            discard them, or keep editing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-end">
          <AlertDialogCancel disabled={saving}>Keep editing</AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={handleDiscardAndLeave}
          >
            Discard
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveAndLeave()}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { dialog };
}
