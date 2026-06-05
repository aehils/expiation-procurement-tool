"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import { deleteRfq } from "@/lib/actions";
import { NewRfqChooser } from "./new-rfq-chooser";

const STATUS_LABEL: Record<string, string> = {
  details: "In Progress",
  quoted: "Quoted",
  ordered: "Ordered",
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "details", label: "In Progress" },
  { value: "quoted", label: "Quoted" },
  { value: "ordered", label: "Ordered" },
];

type RfqItem = {
  id: string;
  rfqNumber: string;
  requester: string;
  status: string;
  createdAt: Date | string;
  itemCount: number;
};

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function RfqList({ rfqs: initial }: { rfqs: RfqItem[] }) {
  const router = useRouter();
  const [rfqs, setRfqs] = useState(initial);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [, startTransition] = useTransition();
  const [chooserOpen, setChooserOpen] = useState(false);

  function handleDelete(id: string) {
    if (deleting) return;
    setDeleting(id);
    startTransition(async () => {
      await deleteRfq(id);
      setRfqs((prev) => prev.filter((r) => r.id !== id));
      setDeleting(null);
      router.refresh();
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rfqs.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.requester.toLowerCase().includes(q) ||
        r.rfqNumber.toLowerCase().includes(q)
      );
    });
  }, [rfqs, query, statusFilter]);

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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="appearance-none h-9 rounded-md border border-input bg-card pl-3 pr-10 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
      </div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => setChooserOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium bg-[#274579] text-white hover:opacity-90 transition-opacity shrink-0"
      >
        <Plus className="w-4 h-4" />
        New RFQ
      </button>
      <NewRfqChooser
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
      />
    </div>
  );

  if (rfqs.length === 0) {
    return (
      <div>
        {toolbar}
        <div className="text-center py-16 text-muted-foreground">
          <p>No RFQs yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {toolbar}

      {/* Column headers — sit on the background above the list, aligned with columns below */}
      <div className="flex items-center gap-3 mb-1.5">
        <span className="w-5 shrink-0" />
        <div className="flex-1 flex items-center pl-4 pr-0">
          <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Requester
          </span>
          <span className="w-20 shrink-0" />
          <span className="w-32 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Code
          </span>
          <span className="w-28 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Date
          </span>
          <span className="w-28 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Status
          </span>
          <span className="w-10 shrink-0" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No RFQs match your search.
        </div>
      ) : (
        <ol className="space-y-1.5">
          {filtered.map((rfq, i) => (
            <li key={rfq.id} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground/50 w-5 text-right shrink-0 select-none tabular-nums">
                {i + 1}
              </span>
              <div className="flex-1 flex items-center bg-card border border-border rounded-md overflow-hidden hover:border-slate-300 hover:shadow-[0_2px_10px_-3px_rgba(15,23,42,0.18)] transition-[border-color,box-shadow]">
                <Link
                  href={
                    rfq.status === "ordered"
                      ? `/rfq/${rfq.id}/quote?from=list`
                      : `/rfq/${rfq.id}/details?from=list`
                  }
                  className="flex-1 flex items-center pl-4 pr-0 py-3"
                >
                  <span className="flex-1 text-sm text-card-foreground truncate pr-4">
                    {rfq.requester}
                  </span>
                  <span className="w-20 text-xs text-muted-foreground/70 shrink-0 tabular-nums">
                    {rfq.itemCount} item{rfq.itemCount === 1 ? "" : "s"}
                  </span>
                  <span className="w-32 text-sm font-medium text-muted-foreground shrink-0">
                    {rfq.rfqNumber}
                  </span>
                  <span className="w-28 text-sm text-muted-foreground shrink-0">
                    {formatDate(rfq.createdAt)}
                  </span>
                  <span className="w-28 text-xs font-medium uppercase text-[#274579] shrink-0">
                    {STATUS_LABEL[rfq.status] ?? rfq.status}
                  </span>
                </Link>
                <button
                  onClick={() => handleDelete(rfq.id)}
                  disabled={deleting === rfq.id}
                  className="relative flex items-center justify-center w-10 h-full px-0 py-3 text-muted-foreground/40 hover:text-destructive active:text-destructive transition-colors shrink-0 disabled:opacity-40 before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-1/2 before:w-px before:bg-border"
                  aria-label={`Delete ${rfq.rfqNumber}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
