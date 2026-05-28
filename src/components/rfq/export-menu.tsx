"use client";

import * as React from "react";
import { Download, FileSpreadsheet, FileText, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadExportConfig } from "@/lib/export/format-config";
import type { ExportQuoteData } from "@/lib/export/types";
import { ExportConfigDialog } from "./export-config-dialog";

type Props =
  | { data: ExportQuoteData; fetchData?: never }
  | { fetchData: () => Promise<ExportQuoteData | null>; data?: never };

export function ExportMenu({ data, fetchData }: Props) {
  const [open, setOpen] = React.useState(false);
  const [configOpen, setConfigOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const cachedRef = React.useRef<ExportQuoteData | null>(null);

  async function resolveData(): Promise<ExportQuoteData | null> {
    if (data) return data;
    if (cachedRef.current) return cachedRef.current;
    const result = await fetchData!();
    cachedRef.current = result;
    return result;
  }

  React.useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleExportXlsx() {
    setOpen(false);
    const resolved = await resolveData();
    if (!resolved || resolved.selectedItemIds.size === 0) {
      toast.error("No items selected for export");
      return;
    }
    try {
      const { generateQuoteXlsx } = await import("@/lib/export/xlsx");
      const config = loadExportConfig();
      await generateQuoteXlsx(resolved, config);
      toast.success("XLSX exported");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export XLSX");
    }
  }

  async function handleExportPdf() {
    setOpen(false);
    const resolved = await resolveData();
    if (!resolved || resolved.selectedItemIds.size === 0) {
      toast.error("No items selected for export");
      return;
    }
    try {
      const { generateQuotePdf } = await import("@/lib/export/pdf");
      const config = loadExportConfig();
      await generateQuotePdf(resolved, config);
      toast.success("PDF exported");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export PDF");
    }
  }

  return (
    <>
      <div ref={menuRef} className="relative">
        <Button
          size="sm"
          style={{ backgroundColor: "#274579" }}
          className="text-white hover:opacity-90 gap-1.5"
          onClick={() => setOpen((v) => !v)}
        >
          <Download className="h-3.5 w-3.5" />
          Export Quote
        </Button>

        {open && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-md shadow-lg py-1 min-w-[180px]">
            <button
              type="button"
              onClick={handleExportPdf}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-red-500" />
              Export as PDF
            </button>
            <button
              type="button"
              onClick={handleExportXlsx}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
              Export as XLSX
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfigOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Export Settings...
            </button>
          </div>
        )}
      </div>

      <ExportConfigDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
      />
    </>
  );
}
