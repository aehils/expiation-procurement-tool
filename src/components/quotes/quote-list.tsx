"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, ShoppingCart, Trash2 } from "lucide-react";
import { ExportMenu } from "@/components/rfq/export-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteQuote } from "@/lib/actions";
import type { DetailsItemPayload } from "@/components/rfq/item-detail-form";
import type { ColKey } from "@/lib/export/types";

export type QuoteRow = {
  id: string;
  quoteNumber: string;
  rfqId: string;
  rfqNumber: string;
  requester: string;
  items: DetailsItemPayload[];
  selectedItemIds: string[];
  enabledColumns: string[];
  markup: number;
  hasPo: boolean;
};

export function QuoteList({ quotes }: { quotes: QuoteRow[] }) {
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<QuoteRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (!menuOpenId) return;
    function onDocClick() {
      setMenuOpenId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpenId]);

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

  return (
    <>
      <ul className="bg-card border border-border rounded-lg divide-y divide-border shadow-sm">
        {quotes.map((q) => (
          <li
            key={q.id}
            className="flex items-center justify-between px-5 py-4 hover:bg-accent/50 transition-colors"
          >
            <Link href={`/quotes/${q.id}`} className="min-w-0 flex-1">
              <div className="font-medium text-card-foreground">
                {q.quoteNumber}
              </div>
              <div className="text-sm text-muted-foreground">
                {q.requester} &middot; {q.selectedItemIds.length} item
                {q.selectedItemIds.length === 1 ? "" : "s"}
              </div>
            </Link>

            <div className="flex items-center gap-2 pl-3">
              <ExportMenu
                data={{
                  quoteNumber: q.quoteNumber,
                  rfqNumber: q.rfqNumber,
                  requester: q.requester,
                  items: q.items,
                  selectedItemIds: new Set(q.selectedItemIds),
                  enabledColumns: q.enabledColumns as ColKey[],
                  markupFactor: 1 + q.markup / 100,
                }}
              />

              <div className="relative">
                <button
                  type="button"
                  aria-label="Quote actions"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === q.id ? null : q.id);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>

                {menuOpenId === q.id && (
                  <div
                    className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-md shadow-lg py-1 min-w-[200px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {q.hasPo ? (
                      <div className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-400 cursor-default">
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Purchase order created
                      </div>
                    ) : (
                      <Link
                        href={`/po/new?rfqId=${q.rfqId}`}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Create Purchase Order
                      </Link>
                    )}
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpenId(null);
                        setPendingDelete(q);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Quote
                    </button>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

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
