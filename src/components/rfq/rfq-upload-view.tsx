"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  parseRfqWorkbook,
  downloadRfqTemplate,
  writeStoredUploadedItems,
  TEMPLATE_COLUMNS,
  type ParseResult,
} from "@/lib/rfq-upload";

type ParseState = {
  fileName: string;
  result: ParseResult;
};

export function RfqUploadView() {
  const router = useRouter();
  const [parseState, setParseState] = React.useState<ParseState | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  async function ingestFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Please choose a .xlsx spreadsheet.");
      return;
    }
    setParsing(true);
    try {
      const result = await parseRfqWorkbook(file);
      setParseState({ fileName: file.name, result });
      if (result.items.length === 0) {
        toast.error(
          result.warnings[0] ?? "No items found in the uploaded sheet.",
        );
      } else {
        toast.success(
          `Found ${result.items.length} item${result.items.length === 1 ? "" : "s"}.`,
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't read that spreadsheet. Is it a valid .xlsx file?");
    } finally {
      setParsing(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void ingestFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void ingestFile(file);
  }

  async function handleDownloadTemplate() {
    try {
      await downloadRfqTemplate();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't generate the template file.");
    }
  }

  function handleContinue() {
    if (!parseState || parseState.result.items.length === 0) return;
    writeStoredUploadedItems({
      items: parseState.result.items,
      fileName: parseState.fileName,
    });
    router.push("/rfq/new");
  }

  function handleStartOver() {
    setParseState(null);
  }

  const items = parseState?.result.items ?? [];
  const warnings = parseState?.result.warnings ?? [];

  return (
    <div className="max-w-screen-md mx-auto px-6 py-4">
      <div className="flex items-center justify-between gap-2 mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="-ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-1 text-sm font-semibold uppercase tracking-wide text-slate-600 rounded-md active:bg-slate-200 active:text-slate-900 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <h2 className="text-3xl font-semibold text-slate-800 tracking-tight">
          Upload Spreadsheet
        </h2>
        <div className="w-12" />
      </div>

      <p className="text-sm text-slate-600 mb-4">
        Drop in an .xlsx matching the RFQ template. Whatever it carries gets
        pre-filled — anything missing stays blank for you to finish on the next
        page.
      </p>

      {!parseState && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-lg border-2 border-dashed transition-colors p-10 text-center ${
            dragOver
              ? "border-[#274579] bg-[#274579]/5"
              : "border-slate-300 bg-white"
          }`}
        >
          <div className="mx-auto w-12 h-12 rounded-full bg-[#274579]/10 flex items-center justify-center">
            <Upload className="h-5 w-5 text-[#274579]" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-800">
            {parsing ? "Parsing…" : "Drop a spreadsheet here"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            or pick a file from your computer
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button
              type="button"
              size="sm"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
              style={{ backgroundColor: "#274579" }}
              className="text-white hover:opacity-90"
            >
              Choose file
            </Button>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Download template
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileInput}
            className="hidden"
          />
          <p className="mt-5 text-[11px] text-slate-400 leading-relaxed">
            Template columns: {TEMPLATE_COLUMNS.join(" · ")}
          </p>
        </div>
      )}

      {parseState && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="h-5 w-5 text-[#274579] shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {parseState.fileName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {items.length} item{items.length === 1 ? "" : "s"} parsed
                    {warnings.length > 0
                      ? ` · ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
                      : ""}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartOver}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                Start over
              </button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
              <div className="px-4 py-2.5 border-b border-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Preview
              </div>
              <ul className="max-h-80 overflow-auto divide-y divide-slate-100">
                {items.map((it, i) => (
                  <li
                    key={i}
                    className="px-4 py-2.5 text-xs flex items-start gap-3"
                  >
                    <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded bg-slate-200 text-slate-600 text-[10px] font-semibold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 truncate">
                        {it.itemName}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Qty: {it.requestQuantity}
                        {it.uom ? ` · ${it.uom}` : ""}
                        {it.vendor ? ` · ${it.vendor}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-amber-900 mb-1.5">
                Parser notes
              </div>
              <ul className="space-y-0.5 text-[11px] text-amber-800 list-disc list-inside">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleStartOver}
            >
              Choose another file
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={items.length === 0}
              onClick={handleContinue}
              style={{ backgroundColor: "#274579" }}
              className="text-white hover:opacity-90"
            >
              Continue to review
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
