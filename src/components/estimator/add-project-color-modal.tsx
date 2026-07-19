"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import {
  isProjectColorComplete,
  newProjectColorId,
  type ProjectColor,
} from "@/lib/project-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Modal to add (or edit) a color on the project palette.
 */
export function AddProjectColorModal({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  /** When set, edit this color instead of creating a new one */
  initial?: ProjectColor | null;
  onSave: (color: ProjectColor) => void;
  onClose: () => void;
}) {
  const [colorNumber, setColorNumber] = useState("");
  const [colorName, setColorName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setColorNumber(initial?.colorNumber ?? "");
    setColorName(initial?.colorName ?? "");
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  if (!open) return null;

  const canSave = isProjectColorComplete({ colorNumber, colorName });

  function handleSave() {
    if (!canSave) return;
    onSave({
      id: initial?.id ?? newProjectColorId(),
      colorNumber: colorNumber.trim() || null,
      colorName: colorName.trim(),
      notes: notes.trim() || null,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-project-color-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border bg-background shadow-xl"
      >
        <div className="border-b bg-[linear-gradient(145deg,#f7fafc_0%,#eef5fa_48%,#e7f0f7_100%)] px-5 py-4">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Palette className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="add-project-color-title"
                className="text-lg font-semibold tracking-tight text-slate-900"
              >
                {initial ? "Edit color" : "New color"}
              </h2>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Added to this project so any surface can reuse it for packaging.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div>
              <Label className="text-[12px]">Color #</Label>
              <Input
                className="mt-1.5"
                value={colorNumber}
                onChange={(e) => setColorNumber(e.target.value)}
                placeholder="1648"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-[12px]">Color name</Label>
              <Input
                className="mt-1.5"
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
                placeholder="Dover White"
              />
            </div>
          </div>
          <div>
            <Label className="text-[12px]">Manufacturer / notes</Label>
            <Input
              className="mt-1.5"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sherwin-Williams, formula, etc."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSave}
            onClick={handleSave}
          >
            {initial ? "Save color" : "Add color"}
          </Button>
        </div>
      </div>
    </div>
  );
}
