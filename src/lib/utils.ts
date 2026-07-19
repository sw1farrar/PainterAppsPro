import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RoomSurfaceKey } from "@/lib/calculations";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const JOB_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "estimating", label: "Estimating" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
] as const;

export const ESTIMATE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
] as const;

export function statusColor(status: string): string {
  switch (status) {
    case "accepted":
    case "completed":
      return "bg-emerald-600";
    case "sent":
    case "scheduled":
      return "bg-sky-600";
    case "in_progress":
    case "estimating":
      return "bg-amber-500";
    case "rejected":
      return "bg-red-600";
    default:
      return "bg-slate-400";
  }
}

/** Room-first estimate templates */
export const ESTIMATE_TEMPLATES = [
  {
    id: "bedroom-sample",
    name: "Sample Bedroom 12×15×8",
    rooms: [
      {
        name: "Master Bedroom",
        kind: "interior" as const,
        lengthFt: 12,
        widthFt: 15,
        heightFt: 8,
        doorCount: 2,
        windowCount: 2,
        condition: "medium" as const,
        surfaces: ["walls_smooth", "ceiling", "trim"] as RoomSurfaceKey[],
        coats: 2,
      },
    ],
  },
  {
    id: "interior-3br",
    name: "Standard 3BR/2BA Interior",
    rooms: [
      {
        name: "Living Room",
        kind: "interior" as const,
        lengthFt: 16,
        widthFt: 18,
        heightFt: 9,
        doorCount: 2,
        windowCount: 3,
        condition: "medium" as const,
        surfaces: ["walls_smooth", "ceiling", "trim"] as RoomSurfaceKey[],
        coats: 2,
      },
      {
        name: "Kitchen",
        kind: "interior" as const,
        lengthFt: 12,
        widthFt: 14,
        heightFt: 9,
        doorCount: 1,
        windowCount: 2,
        condition: "medium" as const,
        surfaces: ["walls_smooth", "ceiling", "trim"] as RoomSurfaceKey[],
        coats: 2,
      },
      {
        name: "Bedroom 1",
        kind: "interior" as const,
        lengthFt: 12,
        widthFt: 12,
        heightFt: 8,
        doorCount: 1,
        windowCount: 2,
        condition: "medium" as const,
        surfaces: ["walls_smooth", "ceiling", "trim"] as RoomSurfaceKey[],
        coats: 2,
      },
    ],
  },
  {
    id: "exterior-repaint",
    name: "Exterior Repaint (single story)",
    rooms: [
      {
        name: "House Exterior",
        kind: "exterior" as const,
        inputAreaSqft: 1800,
        inputLinearFt: 400,
        doorCount: 2,
        windowCount: 8,
        condition: "medium" as const,
        surfaces: [
          "exterior_siding",
          "exterior_trim",
          "exterior_doors",
          "exterior_windows",
        ] as RoomSurfaceKey[],
        coats: 2,
      },
    ],
  },
] as const;
