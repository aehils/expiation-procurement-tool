import type { ExportConfig, ExportQuoteData } from "./types";
import { COLUMNS, cellValueRaw, lineTotalNaira } from "./types";
import { loadLogo } from "./logo";

function formatNairaPdf(v: number | null | undefined, withPrefix = false): string {
  if (v == null) return "—";
  const num = v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withPrefix ? `NGN ${num}` : num;
}

export async function generateQuotePdf(
  data: ExportQuoteData,
  config: ExportConfig,
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // Logo
  const logo = await loadLogo();
  if (logo) {
    try {
      const logoHeight = 12;
      const logoWidth = logoHeight * (logo.width / logo.height);
      doc.addImage(logo.dataUrl, "PNG", margin, y, logoWidth, logoHeight);
      const textX = margin + logoWidth + 6;
      if (config.headerText) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(config.headerText, textX, y + 8);
      }
      y += logoHeight + 4;
    } catch {
      if (config.headerText) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(config.headerText, pageWidth / 2, y, { align: "center" });
        y += 8;
      }
    }
  } else {
    if (config.headerText) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(config.headerText, pageWidth / 2, y, { align: "center" });
      y += 8;
    }
  }

  y += 4;

  // Metadata
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const metaLeft = [
    `Quote #: ${data.quoteNumber}`,
    `RFQ #: ${data.rfqNumber}`,
  ];
  const metaRight = [
    `Requester: ${data.requester}`,
    `Date: ${today}`,
  ];
  metaLeft.forEach((line, i) => {
    doc.text(line, margin, y + i * 5);
  });
  metaRight.forEach((line, i) => {
    doc.text(line, pageWidth - margin, y + i * 5, { align: "right" });
  });
  y += metaLeft.length * 5 + 6;

  // Table
  const visibleCols = COLUMNS.filter((c) => data.enabledColumns.includes(c.key));
  const head = [["#", "Item Name", ...visibleCols.map((c) => c.label)]];

  const selectedItems = data.items.filter((item) =>
    data.selectedItemIds.has(item.id),
  );

  let grandTotal = 0;
  const body: string[][] = [];

  selectedItems.forEach((item, idx) => {
    const row: string[] = [String(idx + 1), item.itemName];
    for (const col of visibleCols) {
      const raw = cellValueRaw(item, col.key, data.markupFactor);
      if (col.key === "nairaUnitPrice" || col.key === "totalPrice") {
        row.push(raw != null ? formatNairaPdf(raw as number) : "—");
      } else {
        row.push(raw != null ? String(raw) : "—");
      }
    }
    body.push(row);
    const lineTotal = lineTotalNaira(item);
    if (lineTotal != null) grandTotal += lineTotal * data.markupFactor;
  });

  // Grand total row
  if (config.showGrandTotal && selectedItems.length > 0) {
    const totalRow: string[] = new Array(2 + visibleCols.length).fill("");
    totalRow[1] = "GRAND TOTAL";
    const totalPriceIdx = visibleCols.findIndex((c) => c.key === "totalPrice");
    if (totalPriceIdx >= 0) {
      totalRow[2 + totalPriceIdx] = formatNairaPdf(grandTotal, true);
    } else {
      totalRow[2] = formatNairaPdf(grandTotal, true);
    }
    body.push(totalRow);
  }

  // Pin price columns to a fixed width so "NGN 1,077,462.69" never gets compressed.
  // Column layout: 0=#, 1=Item Name, 2..N=visibleCols
  const columnStyles: Record<string, { cellWidth: number; halign?: "right" | "left" | "center" | "justify" }> = {
    0: { cellWidth: 8 },
  };
  visibleCols.forEach((col, i) => {
    if (col.key === "nairaUnitPrice" || col.key === "totalPrice") {
      columnStyles[2 + i] = { cellWidth: 34, halign: "right" };
    }
  });

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    columnStyles,
    headStyles: {
      fillColor: [39, 69, 121],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      overflow: "linebreak",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (hookData: { row: { index: number }; cell: { styles: { fontStyle: string; fontSize: number; halign: string } }; column: { index: number } }) => {
      if (
        config.showGrandTotal &&
        selectedItems.length > 0 &&
        hookData.row.index === body.length - 1
      ) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fontSize = 9;
      }
      // Right-align price cells in the grand total row too
      if (columnStyles[hookData.column.index]?.halign === "right") {
        hookData.cell.styles.halign = "right";
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  // Terms & conditions
  if (config.termsAndConditions) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Terms & Conditions:", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const lines = doc.splitTextToSize(
      config.termsAndConditions,
      pageWidth - margin * 2,
    );
    doc.text(lines, margin, y);
    y += lines.length * 3.5 + 4;
    doc.setTextColor(0, 0, 0);
  }

  // Footer
  if (config.footerText) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text(config.footerText, pageWidth / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  doc.save(`${data.quoteNumber}.pdf`);
}
