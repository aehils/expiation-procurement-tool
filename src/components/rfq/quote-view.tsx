"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, MessageSquareText, MoreVertical, Percent, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DetailsItemPayload } from "./item-detail-form";
import { ExportMenu } from "./export-menu";
import { saveQuote } from "@/lib/actions";
import { quoteNumberFromRfq } from "@/lib/docs";
import type { QuoteConfig } from "@/lib/schemas";
import {
  COLUMNS,
  type ColKey,
  formatNaira,
  cellValueRaw,
  markupFactorForItem,
  quoteTotalNaira,
} from "@/lib/export/types";

const NAIRA_COLS = new Set<ColKey>(["nairaUnitPrice", "tax", "shipping", "totalPrice"]);

const COLUMN_KEYS = new Set<string>(COLUMNS.map((c) => c.key));

type Rfq = {
  id: string;
  rfqNumber: string;
  requester: string;
  status: string;
};

function cellValue(item: DetailsItemPayload, key: ColKey, markupFactor: number): React.ReactNode {
  const raw = cellValueRaw(item, key, markupFactor);
  if (NAIRA_COLS.has(key)) {
    return raw != null ? formatNaira(raw as number) : "—";
  }
  return raw ?? "—";
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

function formatRelativeTime(date: Date, now: number): string {
  const diff = Math.max(0, now - date.getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString();
}

export function QuoteView({
  rfq,
  items,
  listBackHref,
  listBackLabel,
  hasSavedQuote = false,
  initialConfig = null,
  initialUpdatedAt = null,
}: {
  rfq: Rfq;
  items: DetailsItemPayload[];
  listBackHref?: string;
  listBackLabel?: React.ReactNode;
  hasSavedQuote?: boolean;
  initialConfig?: QuoteConfig | null;
  initialUpdatedAt?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromList = searchParams.get("from") === "list";
  const quoteNumber = quoteNumberFromRfq(rfq.rfqNumber);

  const [selectedItems, setSelectedItems] = React.useState<Set<string>>(() => {
    const itemIds = new Set(items.map((i) => i.id));
    if (initialConfig) {
      return new Set(initialConfig.items.filter((id) => itemIds.has(id)));
    }
    return itemIds;
  });
  const [enabledCols, setEnabledCols] = React.useState<Set<ColKey>>(() => {
    if (initialConfig) {
      return new Set(
        initialConfig.columns.filter((c): c is ColKey => COLUMN_KEYS.has(c)),
      );
    }
    return new Set(COLUMNS.filter((c) => c.defaultOn).map((c) => c.key));
  });
  const [globalMarkup, setGlobalMarkup] = React.useState(
    initialConfig && initialConfig.markup > 0 ? String(initialConfig.markup) : "",
  );
  const [notes, setNotes] = React.useState<Record<string, string>>(
    () => initialConfig?.notes ?? {},
  );
  const [noteEditorItemId, setNoteEditorItemId] = React.useState<string | null>(null);
  const [noteDraft, setNoteDraft] = React.useState("");
  const [customMarkups, setCustomMarkups] = React.useState<Record<string, number>>(
    () => initialConfig?.customMarkups ?? {},
  );
  const [markupEditorItemId, setMarkupEditorItemId] = React.useState<string | null>(null);
  const [markupDraft, setMarkupDraft] = React.useState("");
  const [saved, setSaved] = React.useState(hasSavedQuote);
  const [saving, setSaving] = React.useState(false);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(initialUpdatedAt);
  const [nowTick, setNowTick] = React.useState<number | null>(null);

  React.useEffect(() => {
    setNowTick(Date.now());
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
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

  async function handleSaveQuote() {
    setSaving(true);
    try {
      const trimmedNotes: Record<string, string> = {};
      for (const [id, body] of Object.entries(notes)) {
        const trimmed = body.trim();
        if (trimmed) trimmedNotes[id] = trimmed;
      }
      const itemIds = new Set(items.map((i) => i.id));
      const trimmedCustomMarkups: Record<string, number> = {};
      for (const [id, pct] of Object.entries(customMarkups)) {
        if (itemIds.has(id)) trimmedCustomMarkups[id] = pct;
      }
      const result = await saveQuote(rfq.id, {
        columns: visibleCols.map((c) => c.key),
        items: [...selectedItems],
        markup: parseFloat(globalMarkup) || 0,
        notes: trimmedNotes,
        customMarkups: trimmedCustomMarkups,
      });
      setSaved(true);
      setUpdatedAt(result.updatedAt);
      toast.success("Quote saved");
    } catch (err) {
      console.error(err);
      toast.error("Could not save quote");
    } finally {
      setSaving(false);
    }
  }

  function openNoteEditor(itemId: string) {
    setNoteDraft(notes[itemId] ?? "");
    setNoteEditorItemId(itemId);
    setMenuOpenItemId(null);
  }

  function saveNoteDraft() {
    if (!noteEditorItemId) return;
    setNotes((prev) => {
      const next = { ...prev };
      const trimmed = noteDraft.trim();
      if (trimmed) next[noteEditorItemId] = trimmed;
      else delete next[noteEditorItemId];
      return next;
    });
    setNoteEditorItemId(null);
  }

  function openMarkupEditor(itemId: string) {
    const existing = customMarkups[itemId];
    setMarkupDraft(existing != null ? String(existing) : "");
    setMarkupEditorItemId(itemId);
    setMenuOpenItemId(null);
  }

  function saveMarkupDraft() {
    if (!markupEditorItemId) return;
    setCustomMarkups((prev) => {
      const next = { ...prev };
      const trimmed = markupDraft.trim();
      if (trimmed === "") {
        delete next[markupEditorItemId];
      } else {
        const parsed = parseFloat(trimmed);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 999) {
          next[markupEditorItemId] = parsed;
        }
      }
      return next;
    });
    setMarkupEditorItemId(null);
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
    <div className="max-w-screen-2xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-6">
        {fromList && listBackHref ? (
          <Link
            href={listBackHref}
            className="-ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-1 text-sm font-semibold uppercase tracking-wide text-slate-600 rounded-md active:bg-slate-200 active:text-slate-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {listBackLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => router.back()}
            className="-ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-1 text-sm font-semibold uppercase tracking-wide text-slate-600 rounded-md active:bg-slate-200 active:text-slate-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        )}
        <h2 className="text-3xl font-semibold text-slate-800 tracking-tight">
          Quote
        </h2>
        <div className="flex items-center gap-2">
          {(() => {
            if (nowTick == null) {
              return <span className="text-xs text-slate-400">&nbsp;</span>;
            }
            if (!updatedAt) {
              return (
                <span className="text-xs text-slate-400 italic">Unsaved</span>
              );
            }
            const date = new Date(updatedAt);
            return (
              <span
                className="text-xs text-slate-500"
                title={date.toLocaleString()}
              >
                Updated {formatRelativeTime(date, nowTick)}
              </span>
            );
          })()}
          <button
            type="button"
            onClick={copyQuoteId}
            title="Copy Quote ID"
            className="group inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors"
          >
            <span>#{quoteNumber}</span>
            <CopyIcon />
          </button>
        </div>
      </div>

      {/* Requester + actions row */}
      <div className="flex items-center justify-end gap-3 mb-10 px-1">
        <div className="flex items-stretch h-8 rounded-md overflow-hidden border border-[#274579]/30 bg-[#274579]/10">
          <span className="flex items-center px-3 text-[11px] font-semibold uppercase tracking-wide text-[#274579]">
            Total
          </span>
          <span className="flex items-center w-44 px-3 bg-slate-100 border-l border-[#274579]/20 text-xs tabular-nums text-slate-700">
            <span className="text-slate-500">₦</span>
            <span className="ml-auto">
              {quoteTotalNaira(items, selectedItems, markupFactor, customMarkups).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
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
            className="h-8 text-xs w-64 bg-slate-100 border border-slate-300 cursor-default"
          />
        </div>
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
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
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
          onClick={handleSaveQuote}
          disabled={saving}
          className="gap-1.5 text-white"
          style={{ backgroundColor: "#276E79" }}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : saved ? "Update" : "Save Quote"}
        </Button>
        <ExportMenu
          data={{
            quoteNumber,
            rfqNumber: rfq.rfqNumber,
            requester: rfq.requester,
            items,
            selectedItemIds: selectedItems,
            enabledColumns: visibleCols.map((c) => c.key),
            markupFactor,
            notes,
            customMarkups,
          }}
        />
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between gap-3 mb-3 pl-1 pr-1">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Quote Lines
        </h3>
        <span className="text-xs text-slate-400 tabular-nums">
          {selectedItems.size} of {items.length} item
          {items.length !== 1 ? "s" : ""} selected
        </span>
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
      </div>

      {/* Items table — outer div is the positioning anchor; overflow lives one level in */}
      <div ref={outerRef} className="relative rounded-md border border-[#274579]/35 ml-1 mr-5">
        <div className="overflow-x-auto overflow-y-hidden rounded-md">
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
                      {(() => {
                        const factor = markupFactorForItem(item.id, markupFactor, customMarkups);
                        return visibleCols.map((col) => (
                          <td key={col.key} className={`px-3 py-2.5 text-slate-600 ${col.wrap ? "max-w-[280px] whitespace-normal break-words" : ""}`}>
                            {cellValue(item, col.key, factor)}
                          </td>
                        ));
                      })()}
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
          const hasNote = Boolean(notes[item.id]?.trim());
          const hasCustomMarkup = customMarkups[item.id] != null;
          return (
            <div
              key={item.id}
              className="absolute flex items-center"
              style={{ top: pos.top, height: pos.height, left: "calc(100% + 6px)", width: 28 }}
              onMouseEnter={() => { cancelHoverClear(); setHoveredItemId(item.id); }}
              onMouseLeave={scheduleHoverClear}
            >
              {isActive ? (
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
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-md shadow-md py-1 min-w-[160px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openNoteEditor(item.id);
                        }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        <span>{hasNote ? "Edit Note" : "Add Note"}</span>
                        {hasNote && (
                          <MessageSquareText className="h-3 w-3 text-[#274579]/70" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openMarkupEditor(item.id);
                        }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        <span>{hasCustomMarkup ? "Edit Custom Markup" : "Custom Markup"}</span>
                        {hasCustomMarkup && (
                          <Percent className="h-3 w-3 text-[#274579]/70" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : hasNote ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openNoteEditor(item.id);
                  }}
                  title={notes[item.id]}
                  className="w-6 h-6 flex items-center justify-center rounded text-[#274579]/70 hover:text-[#274579] hover:bg-slate-200 transition-colors"
                >
                  <MessageSquareText className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          );
        })}

        {/* Custom-markup edge badges — pinned to the table's right inner edge,
            sitting over the rightmost cell content. Always visible (not hover-
            gated) so the per-line override stays discoverable. */}
        {items.map((item) => {
          const pos = rowPositions.get(item.id);
          if (!pos) return null;
          const pct = customMarkups[item.id];
          if (pct == null) return null;
          return (
            <button
              key={`mk-${item.id}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openMarkupEditor(item.id);
              }}
              onMouseEnter={() => { cancelHoverClear(); setHoveredItemId(item.id); }}
              onMouseLeave={scheduleHoverClear}
              title={`Custom markup: ${pct}% (overrides global)`}
              className="absolute z-10 inline-flex items-center justify-center w-[18px] h-[18px] rounded-md bg-[#274579] text-white text-[10px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.15)] ring-1 ring-white/40 hover:bg-[#1f3963] transition-colors"
              style={{
                top: pos.top + (pos.height - 18) / 2,
                right: 6,
              }}
            >
              %
            </button>
          );
        })}
      </div>

      {/* Custom markup editor modal */}
      {markupEditorItemId && (() => {
        const item = items.find((i) => i.id === markupEditorItemId);
        if (!item) return null;
        const hadMarkup = customMarkups[markupEditorItemId] != null;
        const globalPct = parseFloat(globalMarkup) || 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMarkupEditorItemId(null)}
            />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  {hadMarkup ? "Edit custom markup" : "Set custom markup"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {item.itemName}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Label
                    htmlFor="customMarkupInput"
                    className="text-xs font-semibold uppercase tracking-wide text-[#274579] whitespace-nowrap"
                  >
                    Markup
                  </Label>
                  <div className="relative flex items-center">
                    <Input
                      id="customMarkupInput"
                      type="number"
                      min="0"
                      max="999"
                      step="0.1"
                      value={markupDraft}
                      onChange={(e) => setMarkupDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveMarkupDraft();
                        }
                      }}
                      autoFocus
                      placeholder="0"
                      className="h-8 w-24 text-xs text-right pr-6 bg-slate-100 border border-slate-300 focus-visible:bg-slate-50 focus-visible:border-slate-400"
                    />
                    <span className="absolute right-2 text-xs text-slate-400 pointer-events-none">
                      %
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Overrides the global markup ({globalPct}%) for this line only.
                </p>
              </div>
              <div className="px-5 py-3 border-t border-slate-200 flex justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomMarkups((prev) => {
                      const next = { ...prev };
                      delete next[markupEditorItemId];
                      return next;
                    });
                    setMarkupEditorItemId(null);
                  }}
                  disabled={!hadMarkup}
                  className="text-xs text-slate-600"
                >
                  Remove
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMarkupEditorItemId(null)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveMarkupDraft}
                    className="text-xs text-white"
                    style={{ backgroundColor: "#274579" }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Note editor modal */}
      {noteEditorItemId && (() => {
        const item = items.find((i) => i.id === noteEditorItemId);
        if (!item) return null;
        const hadNote = Boolean(notes[noteEditorItemId]?.trim());
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setNoteEditorItemId(null)}
            />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  {hadNote ? "Edit note" : "Add note"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {item.itemName}
                </p>
                <Textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  autoFocus
                  className="mt-3 text-xs min-h-[110px]"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Notes don&apos;t appear in this table — they appear under the item on the exported quote.
                </p>
              </div>
              <div className="px-5 py-3 border-t border-slate-200 flex justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNotes((prev) => {
                      const next = { ...prev };
                      delete next[noteEditorItemId];
                      return next;
                    });
                    setNoteEditorItemId(null);
                  }}
                  disabled={!hadNote}
                  className="text-xs text-slate-600"
                >
                  Remove
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNoteEditorItemId(null)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveNoteDraft}
                    className="text-xs text-white"
                    style={{ backgroundColor: "#274579" }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
