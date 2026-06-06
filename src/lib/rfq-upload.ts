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

// The template lays an RFQ date and a title above the item table, matching the
// house format: a small italic date line, then a bold merged title banner, then
// the column headers. Neither carries a label — they're read back positionally
// (the title is the row just above the header). These placeholder strings seed
// the blank template and are treated as "unfilled" by the parser so an
// untouched template doesn't import its own hint text as the title.
const TITLE_PLACEHOLDER = "RFQ TITLE";
const DATE_PLACEHOLDER = "DD.MM.YYYY";

// Parses the template's date line into a Date (UTC midday, to keep the calendar
// day stable across timezones). Accepts a real Excel date cell, dd.mm.yyyy /
// dd/mm/yyyy (day-first, the house format), and yyyy-mm-dd. Returns undefined
// for the untouched placeholder or anything unrecognised.
function parseTemplateDate(value: unknown, text: string): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const t = text.trim();
  if (t === "" || t.toUpperCase() === DATE_PLACEHOLDER) return undefined;

  const mk = (y: number, mo: number, d: number): Date | undefined => {
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
    const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    return Number.isNaN(dt.getTime()) ? undefined : dt;
  };

  // yyyy-mm-dd (ISO-ish, year first)
  let m = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/.exec(t);
  if (m) return mk(Number(m[1]), Number(m[2]), Number(m[3]));
  // dd.mm.yyyy / dd/mm/yyyy (day first)
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(t);
  if (m) return mk(Number(m[3]), Number(m[2]), Number(m[1]));
  return undefined;
}

// Whether a cell reads as the date line (so it isn't mistaken for the title when
// the title is left blank). The placeholder counts too.
function looksLikeDate(value: unknown, text: string): boolean {
  if (text.trim().toUpperCase() === DATE_PLACEHOLDER) return true;
  return parseTemplateDate(value, text) !== undefined;
}

export type UploadedItem = EntryItem;

export type ParseResult = {
  items: UploadedItem[];
  warnings: string[];
  // The title banner that sits just above the column header row, if filled.
  title?: string;
  // The date line above the title, as an ISO string, if filled. Used to backdate
  // the RFQ's createdAt; absent means "use the normal creation time".
  date?: string;
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
  date?: string;
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

// Pulls the title banner out of the rows above the item table. The title is the
// nearest non-empty row above the header (matching the template's layout). If
// that row is the date line or the untouched placeholder, there's no title.
function extractTitle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: any,
  headerRowIdx: number,
): string | undefined {
  for (let r = headerRowIdx - 1; r >= 1; r--) {
    const row = ws.getRow(r);
    let value: unknown;
    let text: string | undefined;
    for (let c = 1; c <= Math.max(ws.columnCount, 1); c++) {
      const raw = row.getCell(c).value;
      const t = nonEmpty(cellText(raw));
      if (t) {
        value = raw;
        text = t;
        break;
      }
    }
    if (!text) continue; // blank row — keep walking up toward the title
    if (text.toUpperCase() === TITLE_PLACEHOLDER) return undefined;
    if (looksLikeDate(value, text)) return undefined; // title left blank, hit the date line
    return text;
  }
  return undefined;
}

// Pulls the date line out of the rows above the item table — the first cell
// there that parses as a date. Returns an ISO string, or undefined if none.
function extractDate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: any,
  headerRowIdx: number,
): string | undefined {
  for (let r = 1; r < headerRowIdx; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= Math.max(ws.columnCount, 1); c++) {
      const raw = row.getCell(c).value;
      const text = cellText(raw);
      if (!nonEmpty(text)) continue;
      const date = parseTemplateDate(raw, text);
      if (date) return date.toISOString();
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

  // The title banner sits just above the item table's header row; the date
  // line sits above the title.
  const title = extractTitle(ws, headerRowIdx);
  const date = extractDate(ws, headerRowIdx);

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

  return { items, warnings, title, date };
}

// Generates a stub template workbook and triggers a browser download. Lays out
// the house RFQ format above the item table: an italic date line, a spacer, a
// bold merged title banner, then the blue column-header row. Both metadata cells
// carry placeholder hint text the requester overwrites; the parser treats those
// placeholders as unfilled. Mirrors the dynamic-import pattern in
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
  const placeholderColor = "FF94A3B8"; // slate-400, so the hint reads as fill-me

  // Row 2: the date line — small and italic, no label.
  const dateCell = ws.getCell("A2");
  dateCell.value = DATE_PLACEHOLDER;
  dateCell.font = { italic: true, size: 11, color: { argb: placeholderColor } };

  // Row 4: the title banner — bold, large, merged across the table width.
  const headerRowIdx = 5;
  ws.mergeCells(4, 1, 4, TEMPLATE_COLUMNS.length);
  const titleCell = ws.getCell("A4");
  titleCell.value = TITLE_PLACEHOLDER;
  titleCell.font = { bold: true, size: 20, color: { argb: placeholderColor } };

  // Row 5: the column header row.
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
