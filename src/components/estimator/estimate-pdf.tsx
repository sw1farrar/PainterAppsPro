"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber, type EstimateTotals } from "@/lib/calculations";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9, color: "#555", marginBottom: 16 },
  h2: { fontSize: 12, marginTop: 12, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 4,
  },
  cell: { flex: 1 },
  cellRight: { flex: 1, textAlign: "right" },
  total: { marginTop: 12, fontSize: 12, fontFamily: "Helvetica-Bold" },
});

type PdfRoom = {
  name: string;
  kind: string;
  surfaces: {
    description: string;
    coats: number;
    lineTotal: number;
    gallons: number;
    hours: number;
  }[];
};

function EstimateDoc({
  companyName,
  title,
  estimateNumber,
  customerName,
  rooms,
  totals,
}: {
  companyName: string;
  title: string;
  estimateNumber?: string | null;
  customerName?: string | null;
  rooms: PdfRoom[];
  totals: EstimateTotals;
}) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          {companyName}
          {estimateNumber ? ` · ${estimateNumber}` : ""}
          {customerName ? ` · ${customerName}` : ""}
        </Text>

        {rooms.map((room) => (
          <View key={room.name} wrap={false}>
            <Text style={styles.h2}>
              {room.name} ({room.kind})
            </Text>
            {room.surfaces.map((s) => (
              <View key={s.description} style={styles.row}>
                <Text style={styles.cell}>{s.description}</Text>
                <Text style={styles.cellRight}>
                  {s.coats} coats · {formatNumber(s.gallons)} gal ·{" "}
                  {formatNumber(s.hours)} hrs
                </Text>
                <Text style={styles.cellRight}>
                  {formatCurrency(s.lineTotal)}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.h2}>Totals</Text>
        <Text>Materials: {formatCurrency(totals.materials)}</Text>
        <Text>Labor: {formatCurrency(totals.labor)}</Text>
        <Text>Extras: {formatCurrency(totals.extrasTotal)}</Text>
        {totals.discount > 0 && (
          <Text>Discount: −{formatCurrency(totals.discount)}</Text>
        )}
        <Text>Tax: {formatCurrency(totals.taxAmount)}</Text>
        <Text style={styles.total}>
          Total: {formatCurrency(totals.total)}
        </Text>
        <Text>
          {formatNumber(totals.totalHours)} hrs ·{" "}
          {formatCurrency(totals.salesRate)}/hr sales rate
        </Text>
      </Page>
    </Document>
  );
}

export function EstimatePdfDownload(props: {
  companyName: string;
  title: string;
  estimateNumber?: string | null;
  customerName?: string | null;
  rooms: PdfRoom[];
  totals: EstimateTotals;
}) {
  async function download() {
    const blob = await pdf(<EstimateDoc {...props} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.estimateNumber || "estimate"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button size="sm" variant="outline" onClick={() => void download()}>
      <FileDown className="mr-1 h-3.5 w-3.5" />
      PDF
    </Button>
  );
}
