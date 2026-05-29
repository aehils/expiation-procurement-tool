"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteRfq } from "@/lib/actions";

const STATUS_LABEL: Record<string, string> = {
  details: "In Progress",
  quoted: "Quoted",
  ordered: "Ordered",
};

type RfqItem = {
  id: string;
  rfqNumber: string;
  requester: string;
  status: string;
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

export function RfqList({ rfqs: initial }: { rfqs: RfqItem[] }) {
  const router = useRouter();
  const [rfqs, setRfqs] = useState(initial);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

  if (rfqs.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>No RFQs yet.</p>
        <Link
          href="/rfq/new"
          className="text-primary hover:underline mt-2 inline-block"
        >
          Start your first RFQ
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Column headers — sit on the background above the list, aligned with columns below */}
      <div className="flex items-center gap-3 mb-1.5">
        <span className="w-5 shrink-0" />
        <div className="flex-1 flex items-center pl-4 pr-0">
          <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            Requester
          </span>
          <span className="w-32 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            Code
          </span>
          <span className="w-28 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            Date
          </span>
          <span className="w-28 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            Status
          </span>
          <span className="w-10 shrink-0" />
        </div>
      </div>

      <ol className="space-y-1.5">
        {rfqs.map((rfq, i) => (
          <li key={rfq.id} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground/50 w-5 text-right shrink-0 select-none tabular-nums">
              {i + 1}
            </span>
            <div className="flex-1 flex items-center bg-card border border-border rounded-md overflow-hidden hover:bg-accent/30 transition-colors">
              <Link
                href={
                  rfq.status === "ordered"
                    ? `/rfq/${rfq.id}/quote`
                    : `/rfq/${rfq.id}/details`
                }
                className="flex-1 flex items-center pl-4 pr-0 py-3"
              >
                <span className="flex-1 text-sm text-card-foreground truncate pr-4">
                  {rfq.requester}
                </span>
                <span className="w-32 text-sm font-medium text-card-foreground shrink-0">
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
                className="flex items-center justify-center w-10 h-full px-0 py-3 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5 transition-colors border-l border-border shrink-0 disabled:opacity-40"
                aria-label={`Delete ${rfq.rfqNumber}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
