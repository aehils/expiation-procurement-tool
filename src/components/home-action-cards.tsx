"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Package, FilePlus } from "lucide-react";
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Link
          href="/rfq/new"
          className="group flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-200 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#274579] flex items-center justify-center group-hover:scale-105 transition-transform">
            <FileText size={28} className="text-white" />
          </div>
          <div>
            <div className="font-semibold text-card-foreground text-lg">
              Start New RFQ
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Create a request for quotation
            </div>
          </div>
        </Link>

        <button
          onClick={() => setPoDialogOpen(true)}
          className="group flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-200 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#274579] flex items-center justify-center group-hover:scale-105 transition-transform">
            <Package size={28} className="text-white" />
          </div>
          <div>
            <div className="font-semibold text-card-foreground text-lg">
              Create Purchase Order
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Generate a PO from a quoted RFQ
            </div>
          </div>
        </button>

        <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-card border border-border opacity-40 cursor-not-allowed text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <FilePlus size={28} className="text-muted-foreground" />
          </div>
          <div>
            <div className="font-semibold text-muted-foreground text-lg">
              Coming Soon
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              New document type
            </div>
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
