import type { ExportConfig, ExportQuoteData } from "./types";
import { COLUMNS, cellValueRaw, formatNaira, lineTotalNaira } from "./types";

export async function generateQuoteXlsx(
  data: ExportQuoteData,
  config: ExportConfig,
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Quote");

  const visibleCols = COLUMNS.filter((c) => data.enabledColumns.includes(c.key));
  const totalDataCols = 2 + visibleCols.length; // # + Item Name + visible cols

  const headerFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FF274579" },
  };
  const headerFont = {
    color: { argb: "FFFFFFFF" },
    bold: true,
    size: 10,
  };

  let rowIdx = 1;

  // Company name
  if (config.companyName) {
    const r = ws.addRow([config.companyName]);
    ws.mergeCells(rowIdx, 1, rowIdx, totalDataCols);
    r.getCell(1).font = { bold: true, size: 14 };
    r.getCell(1).alignment = { horizontal: "center" };
    rowIdx++;
  }

  // Header text (e.g. "QUOTATION")
  if (config.headerText) {
    const r = ws.addRow([config.headerText]);
    ws.mergeCells(rowIdx, 1, rowIdx, totalDataCols);
    r.getCell(1).font = { bold: true, size: 12 };
    r.getCell(1).alignment = { horizontal: "center" };
    rowIdx++;
  }

  // Blank separator
  ws.addRow([]);
  rowIdx++;

  // Metadata rows
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const metaRows = [
    ["Quote #:", data.quoteNumber],
    ["RFQ #:", data.rfqNumber],
    ["Requester:", data.requester],
    ["Date:", today],
  ];
  for (const [label, value] of metaRows) {
    const r = ws.addRow([label, value]);
    r.getCell(1).font = { bold: true, size: 10 };
    r.getCell(2).font = { size: 10 };
    rowIdx++;
  }

  // Blank separator
  ws.addRow([]);
  rowIdx++;

  // Table header
  const headerLabels = ["#", "Item Name", ...visibleCols.map((c) => c.label)];
  const headerRow = ws.addRow(headerLabels);
  rowIdx++;
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: colNumber === 1 ? "center" : "left", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF274579" } },
    };
  });

  // Data rows
  const selectedItems = data.items.filter((item) =>
    data.selectedItemIds.has(item.id),
  );
  let itemNum = 0;
  let grandTotal = 0;

  for (const item of selectedItems) {
    itemNum++;
    const rowValues: (string | number)[] = [itemNum, item.itemName];
    for (const col of visibleCols) {
      const raw = cellValueRaw(item, col.key, data.markupFactor);
      if (col.key === "nairaUnitPrice" || col.key === "totalPrice" || col.key === "requestQuantity") {
        rowValues.push(typeof raw === "number" ? raw : 0);
      } else {
        rowValues.push(raw != null ? String(raw) : "—");
      }
    }
    const dataRow = ws.addRow(rowValues);
    rowIdx++;

    // Center the # cell
    dataRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

    // Format currency and quantity cells
    visibleCols.forEach((col, ci) => {
      if (col.key === "nairaUnitPrice" || col.key === "totalPrice") {
        const cell = dataRow.getCell(3 + ci);
        cell.numFmt = '₦#,##0.00';
      } else if (col.key === "requestQuantity") {
        const cell = dataRow.getCell(3 + ci);
        cell.numFmt = '#,##0';
      }
    });

    // Alternate row shading
    if (itemNum % 2 === 0) {
      dataRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      });
    }

    const lineTotal = lineTotalNaira(item);
    if (lineTotal != null) grandTotal += lineTotal * data.markupFactor;
  }

  // Grand total row
  if (config.showGrandTotal && selectedItems.length > 0) {
    ws.addRow([]);
    rowIdx++;

    const totalRow = ws.addRow(["", "GRAND TOTAL"]);
    rowIdx++;
    totalRow.getCell(1).font = { bold: true, size: 10 };
    totalRow.getCell(2).font = { bold: true, size: 11 };

    // Find the Total Price column position to place the grand total value
    const totalPriceIdx = visibleCols.findIndex((c) => c.key === "totalPrice");
    if (totalPriceIdx >= 0) {
      const cell = totalRow.getCell(3 + totalPriceIdx);
      cell.value = grandTotal;
      cell.numFmt = '₦#,##0.00';
      cell.font = { bold: true, size: 11 };
    } else {
      // If Total Price column isn't visible, put it after Item Name
      totalRow.getCell(3).value = formatNaira(grandTotal);
      totalRow.getCell(3).font = { bold: true, size: 11 };
    }

    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: "double", color: { argb: "FF274579" } },
      };
    });
  }

  // Terms & conditions
  if (config.termsAndConditions) {
    ws.addRow([]);
    rowIdx++;
    const r = ws.addRow(["Terms & Conditions:"]);
    r.getCell(1).font = { bold: true, size: 10 };
    rowIdx++;
    for (const line of config.termsAndConditions.split("\n")) {
      const tr = ws.addRow([line]);
      tr.getCell(1).font = { size: 9, color: { argb: "FF64748B" } };
      rowIdx++;
    }
  }

  // Footer
  if (config.footerText) {
    ws.addRow([]);
    rowIdx++;
    const r = ws.addRow([config.footerText]);
    ws.mergeCells(rowIdx, 1, rowIdx, totalDataCols);
    r.getCell(1).font = { italic: true, size: 9, color: { argb: "FF94A3B8" } };
    r.getCell(1).alignment = { horizontal: "center" };
  }

  // Auto-fit column widths
  ws.columns.forEach((column) => {
    let maxLen = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    column.width = Math.min(maxLen + 4, 40);
  });

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.quoteNumber}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
