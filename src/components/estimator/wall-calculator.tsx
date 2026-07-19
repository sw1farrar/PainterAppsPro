"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  calculateWallArea,
  type WallSegment,
  type Opening,
} from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

let uid = 0;
function id() {
  return `w${++uid}-${Date.now()}`;
}

function parseInitial(initialJson?: string | null) {
  if (initialJson) {
    try {
      return JSON.parse(initialJson) as {
        walls: WallSegment[];
        openings: Opening[];
      };
    } catch {
      /* fall through */
    }
  }
  return {
    walls: [
      { id: id(), label: "Wall 1", lengthFt: 12, heightFt: 8 },
      { id: id(), label: "Wall 2", lengthFt: 14, heightFt: 8 },
    ] as WallSegment[],
    openings: [
      { id: id(), type: "door" as const, widthFt: 3, heightFt: 7, count: 1 },
      { id: id(), type: "window" as const, widthFt: 3, heightFt: 4, count: 1 },
    ] as Opening[],
  };
}

export function WallAreaCalculator({
  open,
  onOpenChange,
  onApply,
  initialJson,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApply: (netSqft: number, dimensionsJson: string) => void;
  initialJson?: string | null;
}) {
  const [walls, setWalls] = useState<WallSegment[]>([]);
  const [openings, setOpenings] = useState<Opening[]>([]);

  useEffect(() => {
    if (open) {
      const initial = parseInitial(initialJson);
      setWalls(initial.walls);
      setOpenings(initial.openings);
    }
  }, [open, initialJson]);

  const result = useMemo(
    () => calculateWallArea({ walls, openings }),
    [walls, openings]
  );

  function apply() {
    onApply(result.netSqft, JSON.stringify({ walls, openings }));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Wall Area Calculator</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Wall segments (L × H)
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() =>
                  setWalls([
                    ...walls,
                    {
                      id: id(),
                      label: `Wall ${walls.length + 1}`,
                      lengthFt: 10,
                      heightFt: 8,
                    },
                  ])
                }
              >
                <Plus className="size-3" /> Wall
              </Button>
            </div>
            <div className="panel overflow-hidden">
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Label</th>
                    <th className="text-right">Length ft</th>
                    <th className="text-right">Height ft</th>
                    <th className="text-right">Sq ft</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {walls.map((w, i) => (
                    <tr key={w.id}>
                      <td>
                        <Input
                          className="h-7 text-[12px]"
                          value={w.label ?? ""}
                          onChange={(e) => {
                            const next = [...walls];
                            next[i] = { ...w, label: e.target.value };
                            setWalls(next);
                          }}
                        />
                      </td>
                      <td>
                        <NumberInput
                          step="0.1"
                          className="h-7 text-right text-[12px]"
                          value={w.lengthFt}
                          onChange={(lengthFt) => {
                            const next = [...walls];
                            next[i] = { ...w, lengthFt };
                            setWalls(next);
                          }}
                        />
                      </td>
                      <td>
                        <NumberInput
                          step="0.1"
                          className="h-7 text-right text-[12px]"
                          value={w.heightFt}
                          onChange={(heightFt) => {
                            const next = [...walls];
                            next[i] = { ...w, heightFt };
                            setWalls(next);
                          }}
                        />
                      </td>
                      <td className="num text-[12px]">
                        {(w.lengthFt * w.heightFt).toFixed(1)}
                      </td>
                      <td>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setWalls(walls.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Openings (subtract)
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() =>
                  setOpenings([
                    ...openings,
                    {
                      id: id(),
                      type: "window",
                      widthFt: 3,
                      heightFt: 4,
                      count: 1,
                    },
                  ])
                }
              >
                <Plus className="size-3" /> Opening
              </Button>
            </div>
            <div className="panel overflow-hidden">
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Type</th>
                    <th className="text-right">W</th>
                    <th className="text-right">H</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Sq ft</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {openings.map((o, i) => (
                    <tr key={o.id}>
                      <td>
                        <select
                          className="h-7 w-full rounded-sm border border-input bg-transparent px-1 text-[12px]"
                          value={o.type}
                          onChange={(e) => {
                            const next = [...openings];
                            next[i] = {
                              ...o,
                              type: e.target.value as Opening["type"],
                            };
                            setOpenings(next);
                          }}
                        >
                          <option value="door">Door</option>
                          <option value="window">Window</option>
                          <option value="other">Other</option>
                        </select>
                      </td>
                      <td>
                        <NumberInput
                          step="0.1"
                          className="h-7 text-right text-[12px]"
                          value={o.widthFt}
                          onChange={(widthFt) => {
                            const next = [...openings];
                            next[i] = { ...o, widthFt };
                            setOpenings(next);
                          }}
                        />
                      </td>
                      <td>
                        <NumberInput
                          step="0.1"
                          className="h-7 text-right text-[12px]"
                          value={o.heightFt}
                          onChange={(heightFt) => {
                            const next = [...openings];
                            next[i] = { ...o, heightFt };
                            setOpenings(next);
                          }}
                        />
                      </td>
                      <td>
                        <NumberInput
                          integer
                          className="h-7 text-right text-[12px]"
                          value={o.count}
                          onChange={(count) => {
                            const next = [...openings];
                            next[i] = { ...o, count };
                            setOpenings(next);
                          }}
                        />
                      </td>
                      <td className="num text-[12px]">
                        {(o.widthFt * o.heightFt * o.count).toFixed(1)}
                      </td>
                      <td>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() =>
                            setOpenings(openings.filter((_, j) => j !== i))
                          }
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border border-border bg-muted/40 px-3 py-2 text-[12px]">
            <div>
              <div className="section-label">Gross</div>
              <div className="num font-semibold">{result.grossSqft.toFixed(1)} sf</div>
            </div>
            <div>
              <div className="section-label">Openings</div>
              <div className="num font-semibold text-amber-700">
                −{result.openingsSqft.toFixed(1)} sf
              </div>
            </div>
            <div>
              <div className="section-label">Net area</div>
              <div className="num text-base font-bold text-primary">
                {result.netSqft.toFixed(1)} sf
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={apply}>
            Apply {result.netSqft.toFixed(1)} sq ft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
