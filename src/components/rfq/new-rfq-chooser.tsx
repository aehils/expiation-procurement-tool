"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload } from "lucide-react";

// Anchored dropdown shown beneath a "New RFQ" trigger. The parent wraps the
// trigger and this chooser in a `relative` container; the chooser positions
// itself absolutely against it. Outside-click and Escape both close.
export function NewRfqChooser({
  open,
  onClose,
  align = "end",
}: {
  open: boolean;
  onClose: () => void;
  // Whether to align the dropdown's right edge ("end") or left edge ("start")
  // with the trigger. Use "end" for right-side header buttons, "start" when
  // there's plenty of room to the right (e.g. the home action card).
  align?: "start" | "end";
}) {
  const router = useRouter();
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      // Treat the wrapping trigger element as "inside" so clicking the same
      // button that opened the menu lets its onClick toggle it closed instead
      // of fighting the outside-click handler.
      if (target.closest("[data-new-rfq-anchor]")) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Start a new RFQ"
      className={`absolute z-50 top-full mt-1.5 w-64 bg-white rounded-md shadow-xl border border-slate-200 overflow-hidden ${
        align === "end" ? "right-0" : "left-0"
      }`}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => go("/rfq/new")}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
      >
        <FileText className="h-4 w-4 text-[#274579] mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-800">
            Enter details
          </div>
          <div className="text-[11px] text-slate-500 leading-snug">
            Fill out an item form for each line.
          </div>
        </div>
      </button>
      <div className="h-px bg-slate-100" />
      <button
        type="button"
        role="menuitem"
        onClick={() => go("/rfq/new/upload")}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
      >
        <Upload className="h-4 w-4 text-[#274579] mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-800">
            Upload spreadsheet
          </div>
          <div className="text-[11px] text-slate-500 leading-snug">
            Parse items from an .xlsx matching the template.
          </div>
        </div>
      </button>
    </div>
  );
}
