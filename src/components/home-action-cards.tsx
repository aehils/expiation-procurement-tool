"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Package, Plus } from "lucide-react";
import { QuoteSelectDialog } from "./po/quote-select-dialog";

type QuoteOption = {
  id: string;
  rfqNumber: string;
  requester: string;
  itemCount: number;
  createdAt: string;
};

export function HomeActionCards({ quotes }: { quotes: QuoteOption[] }) {
  const [poDialogOpen, setPoDialogOpen] = React.useState(false);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/rfq/new"
          className="group flex flex-col items-center justify-center gap-3 p-5 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 text-center"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-300 dark:bg-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <FileText size={18} className="text-slate-600 dark:text-slate-200" />
          </div>
          <span className="font-medium text-card-foreground text-sm">Start New RFQ</span>
        </Link>

        <button
          onClick={() => setPoDialogOpen(true)}
          className="group flex flex-col items-center justify-center gap-3 p-5 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 text-center"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-300 dark:bg-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Package size={18} className="text-slate-600 dark:text-slate-200" />
          </div>
          <span className="font-medium text-card-foreground text-sm">Create Purchase Order</span>
        </button>

        <div className="flex flex-col items-center justify-center gap-3 p-5 rounded-xl bg-card border border-border opacity-40 cursor-not-allowed text-center select-none">
          <div className="w-10 h-10 rounded-lg bg-slate-300 dark:bg-slate-600 flex items-center justify-center">
            <Plus size={18} className="text-slate-500 dark:text-slate-300" />
          </div>
        </div>
      </div>

      <QuoteSelectDialog
        quotes={quotes}
        open={poDialogOpen}
        onClose={() => setPoDialogOpen(false)}
      />
    </>
  );
}
