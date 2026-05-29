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
  status: string;
};

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
              className="flex-1 flex items-center gap-4 px-4 py-3"
            >
              <span className="flex-1 font-medium text-sm text-card-foreground">
                {rfq.rfqNumber}
              </span>
              <span className="text-xs font-medium px-2 py-1 rounded uppercase bg-[#274579]/10 text-[#274579] shrink-0 w-24 text-center">
                {STATUS_LABEL[rfq.status] ?? rfq.status}
              </span>
            </Link>
            <button
              onClick={() => handleDelete(rfq.id)}
              disabled={deleting === rfq.id}
              className="flex items-center justify-center w-10 h-full px-0 py-3 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 transition-colors border-l border-border shrink-0 disabled:opacity-40"
              aria-label={`Delete ${rfq.rfqNumber}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
