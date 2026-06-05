"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload } from "lucide-react";

// Two-option chooser shown from the "New RFQ" entry points. Picking a path
// here keeps the entry view and upload page focused on one task each.
export function NewRfqChooser({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Start a new RFQ"
        className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
      >
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-base font-semibold text-slate-800">
            Start a new RFQ
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            How do you want to add the items?
          </p>
        </div>
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => go("/rfq/new")}
            className="group flex flex-col items-start gap-2 p-3.5 rounded-md border border-slate-200 bg-white hover:border-[#274579] hover:shadow-md transition-all text-left"
          >
            <div className="w-9 h-9 rounded-md bg-[#274579]/10 flex items-center justify-center group-hover:bg-[#274579]/15 transition-colors">
              <FileText size={18} className="text-[#274579]" />
            </div>
            <div className="text-sm font-semibold text-slate-800">
              Enter details
            </div>
            <div className="text-[11px] text-slate-500 leading-snug">
              Fill out an item form for each line in the RFQ.
            </div>
          </button>
          <button
            type="button"
            onClick={() => go("/rfq/new/upload")}
            className="group flex flex-col items-start gap-2 p-3.5 rounded-md border border-slate-200 bg-white hover:border-[#274579] hover:shadow-md transition-all text-left"
          >
            <div className="w-9 h-9 rounded-md bg-[#274579]/10 flex items-center justify-center group-hover:bg-[#274579]/15 transition-colors">
              <Upload size={18} className="text-[#274579]" />
            </div>
            <div className="text-sm font-semibold text-slate-800">
              Upload spreadsheet
            </div>
            <div className="text-[11px] text-slate-500 leading-snug">
              Parse items from an .xlsx matching the RFQ template.
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
