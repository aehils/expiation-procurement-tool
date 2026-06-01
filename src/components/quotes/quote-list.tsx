"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  FileSpreadsheet,
  FileText,
  MoreVertical,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { deleteQuote, getQuoteExportData } from "@/lib/actions";
import { loadExportConfig } from "@/lib/export/format-config";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "requester", label: "Requester A–Z" },
  { value: "code", label: "Quote code A–Z" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export type QuoteRow = {
  id: string;
  quoteNumber: string;
  rfqId: string;
  rfqNumber: string;
  requester: string;
  selectedItemIds: string[];
  hasPo: boolean;
  createdAt: Date | string;
  total: number;
};

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function QuoteList({ quotes }: { quotes: QuoteRow[] }) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = React.useState<QuoteRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortKey>("newest");

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteQuote(pendingDelete.id);
      toast.success("Quote deleted");
      setPendingDelete(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Could not delete quote");
    } finally {
      setDeleting(false);
    }
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? quotes.filter(
          (qt) =>
            qt.requester.toLowerCase().includes(q) ||
            qt.quoteNumber.toLowerCase().includes(q) ||
            qt.rfqNumber.toLowerCase().includes(q),
        )
      : quotes.slice();
    list.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "requester":
          return a.requester.localeCompare(b.requester);
        case "code":
          return a.quoteNumber.localeCompare(b.quoteNumber);
        case "newest":
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });
    return list;
  }, [quotes, query, sortBy]);

  const toolbar = (
    <div className="flex items-center gap-3 mb-10 pl-8">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search requester or code…"
          className="h-9 w-96 rounded-md border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        />
      </div>
      <div className="relative">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="appearance-none h-9 rounded-md border border-input bg-card pl-3 pr-10 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
      </div>
      <div className="flex-1" />
      <Link
        href="/rfq"
        className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium bg-[#274579] text-white hover:opacity-90 transition-opacity shrink-0"
      >
        <Plus className="w-4 h-4" />
        New Quote
      </Link>
    </div>
  );

  if (quotes.length === 0) {
    return (
      <div>
        {toolbar}
        <div className="text-center py-16 text-muted-foreground">
          <p>No quotes yet.</p>
          <p className="text-sm mt-1">
            Open an RFQ&apos;s quote view, configure it, then save it to see it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        {toolbar}
        {/* Column headers — `border-transparent` reserves the same 1px the
            item card border occupies, so header text left-edges line up with
            value text left-edges below. */}
        <div className="flex items-center gap-3 mb-1.5">
          <span className="w-5 shrink-0" />
          <div className="flex-1 flex items-center pl-4 pr-0 border border-transparent">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
              Requester
            </span>
            <div className="ml-auto flex items-center gap-5 shrink-0">
              <span className="w-32 mr-3 shrink-0" />
              <span className="w-24 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Code
              </span>
              <span className="w-28 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Date
              </span>
              <span className="w-[4.5rem] shrink-0" />
              <span className="w-10 shrink-0" />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No quotes match your search.
          </div>
        ) : (
        <ol className="space-y-1.5">
          {filtered.map((q, i) => (
            <li key={q.id} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground/50 w-5 text-right shrink-0 select-none tabular-nums">
                {i + 1}
              </span>
              <div className="relative flex-1 flex items-center bg-card border border-border rounded-md hover:border-slate-300 hover:shadow-[0_2px_10px_-3px_rgba(15,23,42,0.18)] transition-[border-color,box-shadow] pl-4">
                <Link
                  href={`/quotes/${q.id}?from=list`}
                  aria-label={`Open quote ${q.quoteNumber}`}
                  className="absolute inset-0 rounded-md"
                />
                <span className="relative py-3 text-sm text-card-foreground truncate">
                  {q.requester}
                </span>
                <div className="relative ml-auto flex items-center gap-5 shrink-0">
                  <span className="w-32 mr-3 flex items-center justify-end gap-1 py-3 text-sm tabular-nums text-slate-700">
                    <span className="text-slate-400">₦</span>
                    <span>
                      {q.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                  <span className="w-24 py-3 text-sm font-medium text-muted-foreground">
                    {q.quoteNumber}
                  </span>
                  <span className="w-28 py-3 text-sm text-muted-foreground">
                    {formatDate(q.createdAt)}
                  </span>
                  <Link
                    href={`/rfq/${q.rfqId}/details`}
                    className="relative w-[4.5rem] py-3 text-xs font-medium uppercase tracking-wider text-[#274579] hover:text-blue-600 active:text-blue-700 transition-colors shrink-0"
                  >
                    View RFQ
                  </Link>
                  <QuoteRowMenu
                    quote={q}
                    onRequestDelete={() => setPendingDelete(q)}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete != null}
        title="Delete quote?"
        description={
          <>
            This will permanently delete{" "}
            <span className="font-medium text-slate-700">
              {pendingDelete?.quoteNumber}
            </span>
            . The underlying RFQ and its items are not affected.
          </>
        }
        confirmLabel="Delete Quote"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function QuoteRowMenu({
  quote,
  onRequestDelete,
}: {
  quote: QuoteRow;
  onRequestDelete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function runExport(kind: "pdf" | "xlsx") {
    setOpen(false);
    try {
      const data = await getQuoteExportData(quote.id);
      if (!data || data.selectedItemIds.size === 0) {
        toast.error("No items selected for export");
        return;
      }
      const config = loadExportConfig();
      if (kind === "pdf") {
        const { generateQuotePdf } = await import("@/lib/export/pdf");
        await generateQuotePdf(data, config);
        toast.success("PDF exported");
      } else {
        const { generateQuoteXlsx } = await import("@/lib/export/xlsx");
        await generateQuoteXlsx(data, config);
        toast.success("XLSX exported");
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to export ${kind === "pdf" ? "PDF" : "XLSX"}`);
    }
  }

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${quote.quoteNumber}`}
        className="relative flex items-center justify-center w-10 h-full px-0 py-3 text-muted-foreground/50 hover:text-foreground active:text-foreground transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-md shadow-lg py-1 min-w-[200px]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => runExport("pdf")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FileText className="h-3.5 w-3.5 text-red-500" />
            Export PDF
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => runExport("xlsx")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
            Export Spreadsheet
          </button>
          {quote.hasPo ? (
            <button
              type="button"
              role="menuitem"
              disabled
              title="A purchase order already exists for this quote"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Create PO
            </button>
          ) : (
            <Link
              role="menuitem"
              href={`/po/new?rfqId=${quote.rfqId}`}
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ShoppingCart className="h-3.5 w-3.5 text-[#274579]" />
              Create PO
            </Link>
          )}
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onRequestDelete();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-destructive hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Quote
          </button>
        </div>
      )}
    </div>
  );
}
