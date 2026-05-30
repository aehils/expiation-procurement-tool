"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteQuote } from "@/lib/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type QuoteRow = {
  id: string;
  quoteNumber: string;
  rfqId: string;
  rfqNumber: string;
  requester: string;
  selectedItemIds: string[];
  hasPo: boolean;
  createdAt: Date | string;
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

  if (quotes.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>No quotes yet.</p>
        <p className="text-sm mt-1">
          Open an RFQ&apos;s quote view, configure it, then save it to see it here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div>
        {/* Column headers */}
        <div className="flex items-center gap-3 mb-1.5">
          <span className="w-5 shrink-0" />
          <div className="flex-1 flex items-center">
            <span className="w-28 shrink-0" />
            <div className="flex-1 flex items-center pl-4 pr-0">
              <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Requester
              </span>
              <span className="w-32 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Code
              </span>
              <span className="w-28 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Date
              </span>
            </div>
            <span className="w-10 shrink-0" />
          </div>
        </div>

        <ol className="space-y-1.5">
          {quotes.map((q, i) => (
            <li key={q.id} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground/50 w-5 text-right shrink-0 select-none tabular-nums">
                {i + 1}
              </span>
              <div className="flex-1 flex items-center bg-card border border-border rounded-md overflow-hidden hover:border-slate-300 hover:shadow-[0_2px_10px_-3px_rgba(15,23,42,0.18)] transition-[border-color,box-shadow]">
                <Link
                  href={`/rfq/${q.rfqId}/details`}
                  className="relative flex items-center justify-center w-28 py-3 text-xs font-medium uppercase tracking-wider text-[#274579] hover:text-[#1a3258] active:text-[#1a3258] transition-colors shrink-0 after:content-[''] after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:h-1/2 after:w-px after:bg-border"
                >
                  View RFQ
                </Link>
                <Link
                  href={`/quotes/${q.id}`}
                  className="flex-1 flex items-center pl-4 pr-0 py-3"
                >
                  <span className="flex-1 text-sm text-card-foreground truncate pr-4">
                    {q.requester}
                  </span>
                  <span className="w-32 text-sm font-medium text-muted-foreground shrink-0">
                    {q.quoteNumber}
                  </span>
                  <span className="w-28 text-sm text-muted-foreground shrink-0">
                    {formatDate(q.createdAt)}
                  </span>
                </Link>
                <button
                  onClick={() => setPendingDelete(q)}
                  className="relative flex items-center justify-center w-10 h-full px-0 py-3 text-muted-foreground/40 hover:text-destructive active:text-destructive transition-colors shrink-0 before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-1/2 before:w-px before:bg-border"
                  aria-label={`Delete ${q.quoteNumber}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>
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
