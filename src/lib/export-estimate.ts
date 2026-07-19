import {
  formatCurrency,
  formatNumber,
  type EstimateTotals,
} from "@/lib/calculations";

export type ExportRoom = {
  name: string;
  kind: string;
  lengthFt?: number | null;
  widthFt?: number | null;
  heightFt?: number | null;
  doorCount?: number;
  windowCount?: number;
  condition?: string;
  surfaces: {
    description: string;
    surfaceType?: string | null;
    coats: number;
    method?: string | null;
    measureLabel: string;
    gallons: number;
    laborHours: number;
    prepHours: number;
    materialCost: number;
    laborCost: number;
    lineTotal: number;
    showWork: string[];
  }[];
};

export type ExportExtra = {
  label: string;
  category: string;
  amount: number;
};

export function buildEstimateMarkdown(input: {
  companyName: string;
  title: string;
  estimateNumber?: string | null;
  customerName?: string | null;
  rooms: ExportRoom[];
  extras: ExportExtra[];
  totals: EstimateTotals;
  notes?: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`# ${input.title}`);
  lines.push("");
  lines.push(`**${input.companyName}**`);
  if (input.estimateNumber) lines.push(`Estimate #: ${input.estimateNumber}`);
  if (input.customerName) lines.push(`Customer: ${input.customerName}`);
  lines.push("");

  for (const room of input.rooms) {
    lines.push(`## ${room.name} (${room.kind})`);
    if (room.kind === "interior") {
      lines.push(
        `Dimensions: ${room.lengthFt}×${room.widthFt}×${room.heightFt} ft · ${room.doorCount ?? 0} doors · ${room.windowCount ?? 0} windows · condition ${room.condition}`
      );
    }
    lines.push("");
    lines.push("| Surface | Measure | Coats | Gallons | Hours | Total |");
    lines.push("|---|---:|---:|---:|---:|---:|");
    for (const s of room.surfaces) {
      lines.push(
        `| ${s.description} | ${s.measureLabel} | ${s.coats} | ${formatNumber(s.gallons)} | ${formatNumber(s.laborHours + s.prepHours)} | ${formatCurrency(s.lineTotal)} |`
      );
    }
    lines.push("");
    lines.push("<details><summary>Show work</summary>");
    lines.push("");
    for (const s of room.surfaces) {
      lines.push(`### ${s.description}`);
      for (const w of s.showWork) lines.push(`- ${w}`);
      lines.push("");
    }
    lines.push("</details>");
    lines.push("");
  }

  if (input.extras.length) {
    lines.push("## Extras");
    for (const e of input.extras) {
      lines.push(`- ${e.label} (${e.category}): ${formatCurrency(e.amount)}`);
    }
    lines.push("");
  }

  lines.push("## Totals");
  lines.push(`- Materials: ${formatCurrency(input.totals.materials)}`);
  lines.push(`- Labor: ${formatCurrency(input.totals.labor)}`);
  lines.push(`- Extras: ${formatCurrency(input.totals.extrasTotal)}`);
  if (input.totals.discount > 0) {
    lines.push(`- Discount: −${formatCurrency(input.totals.discount)}`);
  }
  lines.push(`- Subtotal: ${formatCurrency(input.totals.subtotal)}`);
  lines.push(`- Tax: ${formatCurrency(input.totals.taxAmount)}`);
  lines.push(`- **Total: ${formatCurrency(input.totals.total)}**`);
  lines.push(
    `- Hours: ${formatNumber(input.totals.totalHours)} · Sales rate: ${formatCurrency(input.totals.salesRate)}/hr`
  );
  lines.push(`- Profit margin (approx): ${formatNumber(input.totals.profitMarginPct, 1)}%`);

  if (input.notes) {
    lines.push("");
    lines.push("## Notes");
    lines.push(input.notes);
  }

  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
