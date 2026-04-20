"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Download, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { categoryLabel } from "@/lib/constants";
import type { DetailsItemPayload } from "./item-detail-form";

type ColKey =
  | "requestQuantity"
  | "vendor"
  | "nairaUnitPrice"
  | "boxPrice"
  | "totalPrice"
  | "uom"
  | "brand"
  | "mProductCode"
  | "manufacturerName"
  | "vendorDeliveryTimeline"
  | "countryOfOrigin"
  | "itemCategory"
  | "vendorLocation";

const COLUMNS: { key: ColKey; label: string; defaultOn: boolean; wrap?: boolean }[] = [
  { key: "requestQuantity", label: "Qty", defaultOn: true },
  { key: "vendor", label: "Vendor", defaultOn: true },
  { key: "uom", label: "UOM", defaultOn: false },
  { key: "brand", label: "Brand", defaultOn: false },
  { key: "mProductCode", label: "Product Code", defaultOn: false },
  { key: "manufacturerName", label: "Manufacturer", defaultOn: false },
  { key: "vendorDeliveryTimeline", label: "Lead Time", defaultOn: false, wrap: true },
  { key: "countryOfOrigin", label: "Country of Origin", defaultOn: false },
  { key: "itemCategory", label: "Category", defaultOn: false },
  { key: "vendorLocation", label: "Vendor Location", defaultOn: false },
  { key: "boxPrice", label: "Box Price", defaultOn: false },
  { key: "nairaUnitPrice", label: "Unit Price", defaultOn: true },
  { key: "totalPrice", label: "Total Price", defaultOn: true },
];

type Rfq = {
  id: string;
  rfqNumber: string;
  requester: string;
  status: string;
};

function formatNaira(v: number | null | undefined): string {
  if (v == null) return "—";
  return `₦${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function cellValue(item: DetailsItemPayload, key: ColKey, markupFactor: number): React.ReactNode {
  switch (key) {
    case "nairaUnitPrice":
      return item.nairaUnitPrice != null
        ? formatNaira(item.nairaUnitPrice * markupFactor)
        : "—";
    case "boxPrice":
      return item.boxPrice != null
        ? formatNaira(item.boxPrice * markupFactor)
        : "—";
    case "totalPrice":
      return item.nairaUnitPrice != null
        ? formatNaira(item.requestQuantity * item.nairaUnitPrice * markupFactor)
        : "—";
    case "requestQuantity":
      return item.requestQuantity;
    case "itemCategory":
      return categoryLabel(item.itemCategory);
    case "brand":
      return item.brand ?? "—";
    case "vendor":
      return item.vendor ?? "—";
    case "uom":
      return item.uom ?? "—";
    case "mProductCode":
      return item.mProductCode ?? "—";
    case "manufacturerName":
      return item.manufacturerName ?? "—";
    case "vendorDeliveryTimeline":
      return item.vendorDeliveryTimeline ?? "—";
    case "countryOfOrigin":
      return item.countryOfOrigin ?? "—";
    case "vendorLocation":
      return item.vendorLocation ?? "—";
  }
}

function CheckIcon({ stroke = "white" }: { stroke?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="8"
      height="8"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="8"
      height="8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400 group-hover:text-slate-600"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function QuoteView({
  rfq,
  items,
}: {
  rfq: Rfq;
  items: DetailsItemPayload[];
}) {
  const quoteNumber = rfq.rfqNumber.replace("RFQ-", "QU-");

  const [selectedItems, setSelectedItems] = React.useState<Set<string>>(
    () => new Set(items.map((i) => i.id)),
  );
  const [enabledCols, setEnabledCols] = React.useState<Set<ColKey>>(
    () => new Set(COLUMNS.filter((c) => c.defaultOn).map((c) => c.key)),
  );
  const [globalMarkup, setGlobalMarkup] = React.useState("");
  const [hoveredItemId, setHoveredItemId] = React.useState<string | null>(null);
  const [menuOpenItemId, setMenuOpenItemId] = React.useState<string | null>(null);

  const outerRef = React.useRef<HTMLDivElement>(null);
  const rowRefs = React.useRef<Map<string, HTMLTableRowElement>>(new Map());
  const [rowPositions, setRowPositions] = React.useState<Map<string, { top: number; height: number }>>(new Map());
  const hoverClearTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useLayoutEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const outerTop = outer.getBoundingClientRect().top;
    const next = new Map<string, { top: number; height: number }>();
    for (const [id, row] of rowRefs.current) {
      if (!row) continue;
      const r = row.getBoundingClientRect();
      next.set(id, { top: r.top - outerTop, height: r.height });
    }
    setRowPositions(next);
  }, [items]);

  function scheduleHoverClear() {
    hoverClearTimer.current = setTimeout(() => setHoveredItemId(null), 80);
  }
  function cancelHoverClear() {
    if (hoverClearTimer.current) clearTimeout(hoverClearTimer.current);
  }

  React.useEffect(() => {
    if (!menuOpenItemId) return;
    function onDocClick() { setMenuOpenItemId(null); }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpenItemId]);

  const visibleCols = COLUMNS.filter((c) => enabledCols.has(c.key));
  const allSelected = selectedItems.size === items.length;
  const markupFactor = 1 + (parseFloat(globalMarkup) || 0) / 100;
  const someSelected = selectedItems.size > 0 && !allSelected;

  function toggleItem(id: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedItems(
      allSelected ? new Set() : new Set(items.map((i) => i.id)),
    );
  }

  function toggleCol(key: ColKey) {
    setEnabledCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function copyQuoteId() {
    try {
      await navigator.clipboard.writeText(quoteNumber);
      toast.success("Quote ID copied");
    } catch {
      toast.error("Could not copy Quote ID");
    }
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-slate-800 tracking-tight">
          Quote
        </h2>
        <button
          type="button"
          onClick={copyQuoteId}
          title="Copy Quote ID"
          className="group inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors"
        >
          <span>#{quoteNumber}</span>
          <CopyIcon />
        </button>
        <span className="px-1.5 py-px text-[10px] font-medium bg-slate-200 text-slate-600 rounded uppercase tracking-wide">
          Draft
        </span>
        <div className="relative">
          <button
            type="button"
            aria-label="Quote options"
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-200 text-slate-900 text-xl leading-none font-black"
          >
            ⋮
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/rfq/${rfq.id}/details`}
            className="inline-flex items-center gap-1 h-8 px-3 text-sm font-medium text-slate-700 rounded-md hover:bg-[#274579]/10 hover:text-[#274579] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </div>

      {/* Requester + actions row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <div className="lg:col-span-7">
          <div className="flex items-center gap-3 px-1 max-w-[70%]">
            <Label
              htmlFor="requester"
              className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
              style={{ color: "#274579" }}
            >
              Requester
            </Label>
            <Input
              id="requester"
              value={rfq.requester}
              readOnly
              className="h-8 text-xs flex-1 bg-slate-100 border border-slate-300 cursor-default"
            />
          </div>
        </div>
        <div className="lg:col-span-5 flex items-center justify-end gap-3">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="globalMarkup"
              className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
              style={{ color: "#274579" }}
            >
              Global Markup
            </Label>
            <div className="relative flex items-center">
              <Input
                id="globalMarkup"
                type="number"
                min="0"
                max="999"
                step="0.1"
                value={globalMarkup}
                onChange={(e) => setGlobalMarkup(e.target.value)}
                placeholder="0"
                className="h-8 w-20 text-xs text-right pr-6 bg-slate-100 border border-slate-300 focus-visible:bg-slate-50 focus-visible:border-slate-400"
              />
              <span className="absolute right-2 text-xs text-slate-400 pointer-events-none">
                %
              </span>
            </div>
          </div>
          <Button
            size="sm"
            style={{ backgroundColor: "#274579" }}
            className="text-white hover:opacity-90 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export Quote
          </Button>
        </div>
      </div>

      {/* Section header */}
      <div className="mb-3 pl-1">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Quote Lines
        </h3>
      </div>

      {/* Column toggles */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3 px-1">
        {COLUMNS.map((col) => {
          const active = enabledCols.has(col.key);
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => toggleCol(col.key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                active
                  ? "bg-[#274579] text-white border-[#274579]"
                  : "bg-white text-slate-500 border-slate-300 hover:border-slate-400 hover:text-slate-700"
              }`}
            >
              {active && <CheckIcon />}
              {col.label}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {selectedItems.size} of {items.length} item
          {items.length !== 1 ? "s" : ""} selected
        </span>
      </div>

      {/* Items table — outer div is the positioning anchor; overflow lives one level in */}
      <div ref={outerRef} className="relative rounded-md border border-[#274579]/35">
        <div className="overflow-x-auto overflow-y-hidden rounded-t-md">
          <div className="w-max min-w-full">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-8 px-3 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={toggleAll}
                      aria-label="Select all items"
                      className={`w-3.5 h-3.5 rounded border mx-auto flex items-center justify-center transition-colors ${
                        allSelected
                          ? "bg-[#274579] border-[#274579]"
                          : someSelected
                            ? "bg-[#274579]/50 border-[#274579]/70"
                            : "bg-white border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {allSelected && <CheckIcon />}
                      {someSelected && <MinusIcon />}
                    </button>
                  </th>
                  <th className="w-8 px-2 py-2.5 text-center font-medium text-slate-500 tabular-nums whitespace-nowrap">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-500 whitespace-nowrap">
                    Item Name
                  </th>
                  {visibleCols.map((col) => (
                    <th
                      key={col.key}
                      className={`px-3 py-2.5 text-left font-medium text-slate-500 ${col.wrap ? "max-w-[280px] whitespace-normal" : "whitespace-nowrap"}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const included = selectedItems.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(item.id, el);
                        else rowRefs.current.delete(item.id);
                      }}
                      onMouseEnter={() => { cancelHoverClear(); setHoveredItemId(item.id); }}
                      onMouseLeave={scheduleHoverClear}
                      onClick={() => toggleItem(item.id)}
                      className={`border-b border-slate-100 last:border-0 cursor-pointer transition-all ${
                        included
                          ? "hover:bg-slate-50"
                          : "opacity-40 hover:opacity-60 hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <div
                          className={`w-3.5 h-3.5 rounded border mx-auto flex items-center justify-center transition-colors ${
                            included
                              ? "bg-[#274579] border-[#274579]"
                              : "bg-white border-slate-300"
                          }`}
                        >
                          {included && <CheckIcon />}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center text-slate-400 tabular-nums">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">
                        {item.itemName}
                      </td>
                      {visibleCols.map((col) => (
                        <td key={col.key} className={`px-3 py-2.5 text-slate-600 ${col.wrap ? "max-w-[280px] whitespace-normal break-words" : ""}`}>
                          {cellValue(item, col.key, markupFactor)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Floating three-dot buttons — rendered outside the table's right border */}
        {items.map((item) => {
          const pos = rowPositions.get(item.id);
          if (!pos) return null;
          const isActive = hoveredItemId === item.id || menuOpenItemId === item.id;
          return (
            <div
              key={item.id}
              className="absolute flex items-center"
              style={{ top: pos.top, height: pos.height, left: "calc(100% + 6px)", width: 28 }}
              onMouseEnter={() => { cancelHoverClear(); setHoveredItemId(item.id); }}
              onMouseLeave={scheduleHoverClear}
            >
              {isActive && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenItemId(menuOpenItemId === item.id ? null : item.id);
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                  {menuOpenItemId === item.id && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-md shadow-md py-1 min-w-[140px]">
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        Custom Markup
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
