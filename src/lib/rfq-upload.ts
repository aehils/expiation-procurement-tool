// Parses an RFQ spreadsheet upload against the fixed template and produces
// EntryItem rows ready to drop into the entry view's `items` state. Permissive
// by design — missing values become `undefined`, not validation errors; the
// downstream details page still gates final submission on completeness.
import type { EntryItem } from "./schemas";

// Template columns. Header match is case-insensitive and whitespace-collapsed,
// so spreadsheets with double spaces / mixed case still parse.
type ColumnKey =
  | "ITEM NAME"
  | "DESCRIPTION"
  | "SPECIFICATION"
  | "UNIT OF MEASURE"
  | "QTY"
  | "TAX"
  | "%TAX"
  | "OG UNIT PRICE"
  | "NGN UNIT PRICE"
  | "OG DOMESTIC SHIPPING COST"
  | "NGN DOMESTIC SHIPPING COST"
  | "OG INTL SHIPPING COST"
  | "NGN INTL SHIPPING COST"
  | "TOTAL COST USD"
  | "TOTAL COST NGN"
  | "NOTES"
  | "VENDOR"
  | "PRODUCT LINK";

export const TEMPLATE_COLUMNS: ColumnKey[] = [
  "ITEM NAME",
  "DESCRIPTION",
  "SPECIFICATION",
  "UNIT OF MEASURE",
  "QTY",
  "TAX",
  "%TAX",
  "OG UNIT PRICE",
  "NGN UNIT PRICE",
  "OG DOMESTIC SHIPPING COST",
  "NGN DOMESTIC SHIPPING COST",
  "OG INTL SHIPPING COST",
  "NGN INTL SHIPPING COST",
  "TOTAL COST USD",
  "TOTAL COST NGN",
  "NOTES",
  "VENDOR",
  "PRODUCT LINK",
];

// First-cell strings that mark a non-item footer row in real-world sheets
// (totals, profit summaries, etc.). Matched case-insensitively as a prefix.
const FOOTER_PREFIXES = [
  "TOTAL:",
  "TOTAL",
  "COST PRICE",
  "NG SHIPPING",
  "NG SHIPPER",
  "AIES NG",
  "DEN360",
  "DESPATCH",
  "TOTAL COST",
  "PROFIT",
  "QUOTED PR",
];

// Labels for the metadata rows the template places above the item table. The
// requester fills the cell to the right of each; the parser reads them back.
// Matched case-insensitively and whitespace-collapsed, with the "RFQ " prefix
// optional so a bare "TITLE" label still resolves. (The "RFQ DATE" row is on
// the template for the requester's reference; the persisted RFQ date is the
// createdAt timestamp, so it isn't parsed back here.)
const TITLE_LABELS = ["RFQ TITLE", "TITLE"];

export type UploadedItem = EntryItem;

export type ParseResult = {
  items: UploadedItem[];
  warnings: string[];
  // Pulled from the "RFQ TITLE" row at the top of the template, if present.
  title?: string;
};

// SessionStorage handoff: the upload page parses, stashes the parsed items
// here, and routes to /rfq/new where EntryView hydrates from this key and
// clears it. Kept short-lived and client-only — no server round-trip, no
// orphan DB rows.
export const UPLOADED_ITEMS_STORAGE_KEY = "rfq:uploaded-items";

export type StashedItems = {
  items: UploadedItem[];
  fileName?: string;
  title?: string;
};

export function readStoredUploadedItems(): StashedItems | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(UPLOADED_ITEMS_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StashedItems;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredUploadedItems(payload: StashedItems): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(UPLOADED_ITEMS_STORAGE_KEY, JSON.stringify(payload));
}

function normalizeHeader(s: string): string {
  return s.replace(/\s+/g, " ").trim().toUpperCase();
}

// Extracts the plain text from an ExcelJS cell value, peeling away the
// shapes it uses for hyperlinks (`{ text, hyperlink }`) and rich text
// (`{ richText: [{ text }] }`).
function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.text === "string") return v.text;
    if (Array.isArray(v.richText)) {
      return v.richText
        .map((r) => (r as { text?: string }).text ?? "")
        .join("");
    }
    if (v.result != null) return String(v.result);
    if (v.formula != null) return "";
  }
  return String(value);
}

function cellHyperlink(value: unknown): string | undefined {
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.hyperlink === "string") return v.hyperlink;
  }
  return undefined;
}

function cellNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.result === "number") return v.result;
  }
  const raw = cellText(value).replace(/[^0-9.\-]/g, "");
  if (raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function nonEmpty(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  return t === "" ? undefined : t;
}

// Finds a metadata value laid out as "<LABEL> | <value>" in the rows above the
// item table. Scans for a cell whose text matches one of `labels`, then returns
// the first non-empty cell to its right on the same row. Used for the RFQ title
// row the template seeds at the top.
function findLabeledValue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: any,
  labels: string[],
  maxRow: number,
): string | undefined {
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= Math.max(ws.columnCount, 2); c++) {
      const label = normalizeHeader(cellText(row.getCell(c).value));
      if (!labels.includes(label)) continue;
      for (let nc = c + 1; nc <= Math.max(ws.columnCount, c + 4); nc++) {
        const value = nonEmpty(cellText(row.getCell(nc).value));
        if (value) return value;
      }
    }
  }
  return undefined;
}

// Reads the workbook's first sheet, locates the header row, and maps each
// subsequent non-footer row to an EntryItem. Returns parser warnings keyed
// to the source row for surfacing in the UI.
export async function parseRfqWorkbook(file: File): Promise<ParseResult> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buf = await file.arrayBuffer();
  await workbook.xlsx.load(buf);

  const warnings: string[] = [];
  const ws = workbook.worksheets[0];
  if (!ws) {
    return { items: [], warnings: ["Workbook has no sheets."] };
  }

  // Find the header row: scan top-to-bottom for the row whose cells contain
  // the most template headers. Require at least 3 matches so we don't latch
  // onto a stray label row.
  let headerRowIdx = -1;
  let bestMatchCount = 0;
  let headerMap: Map<number, ColumnKey> = new Map();
  const maxScan = Math.min(ws.rowCount, 40);
  for (let r = 1; r <= maxScan; r++) {
    const row = ws.getRow(r);
    const candidateMap = new Map<number, ColumnKey>();
    for (let c = 1; c <= ws.columnCount; c++) {
      const text = normalizeHeader(cellText(row.getCell(c).value));
      if (!text) continue;
      for (const col of TEMPLATE_COLUMNS) {
        if (text === col) {
          candidateMap.set(c, col);
          break;
        }
      }
    }
    if (candidateMap.size > bestMatchCount) {
      bestMatchCount = candidateMap.size;
      headerRowIdx = r;
      headerMap = candidateMap;
    }
  }

  if (headerRowIdx === -1 || bestMatchCount < 3) {
    return {
      items: [],
      warnings: [
        "Couldn't find the template header row. Make sure the sheet's header row contains at least 3 of the template columns (e.g. ITEM NAME, QTY, DESCRIPTION).",
      ],
    };
  }

  const missing = TEMPLATE_COLUMNS.filter(
    (c) => ![...headerMap.values()].includes(c),
  );
  if (missing.length > 0) {
    warnings.push(`Headers not found, skipped: ${missing.join(", ")}.`);
  }

  // The title row lives above the item table — scan the rows preceding the header.
  const title = findLabeledValue(ws, TITLE_LABELS, Math.max(1, headerRowIdx - 1));

  // Build a reverse lookup: ColumnKey → spreadsheet column index.
  const colIdx = new Map<ColumnKey, number>();
  for (const [idx, key] of headerMap.entries()) {
    colIdx.set(key, idx);
  }

  const items: UploadedItem[] = [];
  for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);

    // Footer-row guard: if the first non-empty cell starts with one of the
    // known footer labels, stop reading. Real sheets place totals/profit rows
    // at the bottom; everything after them is summary, not items.
    const firstText = normalizeHeader(
      cellText(row.getCell(1).value) ||
        cellText(row.getCell(2).value) ||
        cellText(row.getCell(6).value),
    );
    if (
      FOOTER_PREFIXES.some(
        (p) => firstText === p || firstText.startsWith(p + " "),
      )
    ) {
      break;
    }

    const get = (key: ColumnKey) => {
      const idx = colIdx.get(key);
      if (idx == null) return undefined;
      return row.getCell(idx).value;
    };

    const itemName = nonEmpty(cellText(get("ITEM NAME")));
    if (!itemName) continue; // sparse / blank row

    const qty = cellNumber(get("QTY"));
    if (qty != null && qty <= 0) {
      warnings.push(`Row ${r}: QTY must be > 0 — row skipped.`);
      continue;
    }

    const productLinkCell = get("PRODUCT LINK");
    const productLink =
      cellHyperlink(productLinkCell) ?? nonEmpty(cellText(productLinkCell));

    const tax = cellNumber(get("TAX"));
    const taxPercent = cellNumber(get("%TAX"));
    let taxValue: number | undefined;
    let taxMode: "amount" | "percent" | undefined;
    if (taxPercent != null && tax != null) {
      warnings.push(
        `Row ${r}: both TAX and %TAX provided — using %TAX (${taxPercent}%).`,
      );
      taxValue = taxPercent;
      taxMode = "percent";
    } else if (taxPercent != null) {
      taxValue = taxPercent;
      taxMode = "percent";
    } else if (tax != null) {
      taxValue = tax;
      taxMode = "amount";
    }

    const ngnUnitPrice = cellNumber(get("NGN UNIT PRICE"));

    const item: UploadedItem = {
      itemName,
      itemDescription: nonEmpty(cellText(get("DESCRIPTION"))) ?? null,
      specification: nonEmpty(cellText(get("SPECIFICATION"))) ?? null,
      additionalNotes: nonEmpty(cellText(get("NOTES"))) ?? null,
      requestQuantity: qty ?? 1,
      uom: nonEmpty(cellText(get("UNIT OF MEASURE"))),
      vendor: nonEmpty(cellText(get("VENDOR"))),
      productLink,
      ogUnitPrice: cellNumber(get("OG UNIT PRICE")),
      nairaUnitPrice: ngnUnitPrice,
      nairaOverridden: ngnUnitPrice != null ? true : undefined,
      tax: taxValue,
      taxMode,
      domesticShippingCost: cellNumber(get("OG DOMESTIC SHIPPING COST")),
      domesticShippingNaira: cellNumber(get("NGN DOMESTIC SHIPPING COST")),
      intlShippingCost: cellNumber(get("OG INTL SHIPPING COST")),
      intlShippingNaira: cellNumber(get("NGN INTL SHIPPING COST")),
    };

    if (qty == null) {
      warnings.push(`Row ${r}: QTY blank — defaulted to 1.`);
    }

    items.push(item);
  }

  if (items.length === 0 && warnings.length === 0) {
    warnings.push("No item rows found below the header.");
  }

  return { items, warnings, title };
}

// Generates a stub template workbook and triggers a browser download. The top
// two rows are metadata the requester fills in — an RFQ title and date — sitting
// above a spacer and the column header row. Mirrors the dynamic-import pattern in
// `src/lib/export/xlsx.ts` to keep exceljs out of the initial bundle.
export async function downloadRfqTemplate(): Promise<void> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("RFQ Template");

  // Widths only — we lay the rows out by hand so the metadata rows can sit
  // above the column header (setting `header` here would force it into row 1).
  ws.columns = TEMPLATE_COLUMNS.map((c) => ({
    key: c,
    width: Math.max(14, c.length + 2),
  }));

  const brand = "FF274579";
  const labelCell = (text: string, row: number) => {
    const cell = ws.getCell(`A${row}`);
    cell.value = text;
    cell.font = { bold: true, color: { argb: brand } };
    // A light fill on the adjacent cell hints where to type.
    const valueCell = ws.getCell(`B${row}`);
    valueCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    valueCell.border = {
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  };

  // Row 1: title, Row 2: date — both blank for the requester to fill.
  labelCell("RFQ TITLE", 1);
  labelCell("RFQ DATE", 2);
  // Row 3: spacer. Row 4: the column header row.
  const headerRowIdx = 4;
  const headerRow = ws.getRow(headerRowIdx);
  headerRow.values = [...TEMPLATE_COLUMNS];
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: brand },
  };
  headerRow.commit?.();

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rfq-upload-template.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
