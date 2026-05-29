"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { quoteNumberFromRfq } from "@/lib/docs";

type QuoteOption = {
  id: string;
  rfqNumber: string;
  requester: string;
  itemCount: number;
  createdAt: string;
};

export function QuoteSelectDialog({
  quotes,
  open,
  onClose,
}: {
  quotes: QuoteOption[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">
            Select a Quote
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Choose which quote the purchase order will be based on.
          </p>
        </div>

        <div className="px-6 py-3 max-h-80 overflow-y-auto">
          {quotes.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No quotes available. Complete an RFQ to create a quote first.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {quotes.map((q) => {
                const quoteNumber = quoteNumberFromRfq(q.rfqNumber);
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(`/po/new?rfqId=${q.id}`);
                      }}
                      className="w-full text-left px-3 py-3 rounded-md hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-slate-800">
                          {quoteNumber}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(q.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {q.requester} &middot; {q.itemCount} item
                        {q.itemCount !== 1 ? "s" : ""}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
