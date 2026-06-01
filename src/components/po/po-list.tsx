"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteDraftPo } from "@/lib/actions";

export type PoRow = {
  id: string;
  poNumber: string;
  status: string;
  createdAt: Date | string;
  rfq: { requester: string };
};

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PoList({ pos: initial }: { pos: PoRow[] }) {
  const router = useRouter();
  const [pos, setPos] = useState(initial);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (deleting) return;
    setDeleting(id);
    startTransition(async () => {
      await deleteDraftPo(id);
      setPos((prev) => prev.filter((p) => p.id !== id));
      setDeleting(null);
      router.refresh();
    });
  }

  if (pos.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>No purchase orders yet.</p>
        <p className="text-sm mt-1">
          Complete and quote an RFQ first, then create a PO from it.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Column headers */}
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
        {pos.map((po, i) => (
          <li key={po.id} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground/50 w-5 text-right shrink-0 select-none tabular-nums">
              {i + 1}
            </span>
            <div className="flex-1 flex items-center bg-card border border-border rounded-md overflow-hidden hover:bg-accent/30 transition-colors">
              <Link
                href={`/po/${po.id}?from=list`}
                className="flex-1 flex items-center pl-4 pr-0 py-3"
              >
                <span className="flex-1 text-sm text-card-foreground truncate pr-4">
                  {po.rfq.requester}
                </span>
                <span className="w-32 text-sm font-medium text-card-foreground shrink-0">
                  {po.poNumber}
                </span>
                <span className="w-28 text-sm text-muted-foreground shrink-0">
                  {formatDate(po.createdAt)}
                </span>
                <span className="w-28 text-xs font-medium uppercase text-[#274579] shrink-0">
                  {po.status}
                </span>
              </Link>
              <button
                onClick={() => handleDelete(po.id)}
                disabled={po.status !== "draft" || deleting === po.id}
                className="flex items-center justify-center w-10 h-full px-0 py-3 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5 transition-colors border-l border-border shrink-0 disabled:opacity-20 disabled:pointer-events-none"
                aria-label={`Delete ${po.poNumber}`}
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
