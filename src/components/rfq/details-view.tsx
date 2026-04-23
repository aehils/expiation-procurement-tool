"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BANNER_CURRENCIES,
  categoryLabel,
  departmentLabel,
  TOTAL_DETAIL_FIELDS,
} from "@/lib/constants";
import {
  refreshBannerCurrencyRates,
  saveRfqItems,
  submitRfq,
  type PersistedRate,
} from "@/lib/actions";
import type { UpdateItemInput } from "@/lib/schemas";
import {
  ItemDetailForm,
  initialDraftFromItem,
  parseDraftNumber,
  type DetailsItemPayload,
  type ItemDraft,
} from "./item-detail-form";

export type RateInfo = { rate: number; fetchedAt: string; error?: string };

type Rfq = {
  id: string;
  rfqNumber: string;
  requester: string;
  status: string;
  createdAt: string;
};

const DETAIL_KEYS: (keyof ItemDraft)[] = [
  "mProductCode",
  "unitQuantity",
  "uom",
  "manufacturerName",
  "vendor",
  "vendorLocation",
  "productLink",
  "countryOfOrigin",
  "vendorDeliveryTimeline",
  "originalCurrency",
  "ogUnitPrice",
  "ogBoxPrice",
  "nairaUnitPrice",
  "boxPrice",
];

const NUMERIC_KEYS = new Set<keyof ItemDraft>([
  "unitQuantity",
  "ogUnitPrice",
  "ogBoxPrice",
  "nairaUnitPrice",
  "boxPrice",
]);

// Count how many detail fields the draft has populated. Drives the progress
// indicator on each accordion row, so it must follow whatever the user has
// typed locally (not the last-saved canonical value).
function countFilledFromDraft(draft: ItemDraft): number {
  return DETAIL_KEYS.reduce((acc, key) => {
    const raw = draft[key];
    if (raw.trim() === "") return acc;
    if (NUMERIC_KEYS.has(key)) {
      const n = parseDraftNumber(raw);
      if (n === null) return acc;
    }
    return acc + 1;
  }, 0);
}

// Compute the minimal patch to send to the server — only fields whose
// normalized draft value differs from the canonical item. Returns null if the
// item has no changes. Includes `nairaOverridden` when the override flag was
// flipped. This is the single source of truth for both dirty detection and
// the save payload.
function computePatch(
  draft: ItemDraft,
  overridden: boolean,
  item: DetailsItemPayload,
): UpdateItemInput | null {
  const patch: Record<string, unknown> = {};
  let changed = false;

  for (const key of DETAIL_KEYS) {
    const raw = draft[key];
    if (NUMERIC_KEYS.has(key)) {
      const next = parseDraftNumber(raw);
      const current = item[key as keyof DetailsItemPayload] as number | null;
      if ((next ?? null) !== (current ?? null)) {
        patch[key] = next;
        changed = true;
      }
    } else {
      const next = raw.trim() === "" ? null : raw;
      const current = (item[key as keyof DetailsItemPayload] ?? null) as
        | string
        | null;
      if (next !== current) {
        patch[key] = next;
        changed = true;
      }
    }
  }

  if (overridden !== item.nairaOverridden) {
    patch.nairaOverridden = overridden;
    changed = true;
  }

  return changed ? (patch as UpdateItemInput) : null;
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 5) return "Updated now";
  if (diffSec < 60) return `Updated ${diffSec}s ago`;
  if (diffSec < 3600) return `Updated ${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `Updated ${Math.round(diffSec / 3600)}h ago`;
  return `Updated ${Math.round(diffSec / 86400)}d ago`;
}

export function DetailsView({
  rfq,
  initialItems,
  initialBannerRates = [],
}: {
  rfq: Rfq;
  initialItems: DetailsItemPayload[];
  initialBannerRates?: PersistedRate[];
}) {
  const router = useRouter();
  // Canonical server-reflected state. Mutated only after a successful save.
  const [items, setItems] = React.useState<DetailsItemPayload[]>(initialItems);
  // Per-item drafts live at this level because Radix AccordionContent unmounts
  // collapsed panels — keeping drafts in the child would lose typed-but-unsaved
  // edits whenever an item collapses.
  const [drafts, setDrafts] = React.useState<Record<string, ItemDraft>>(() => {
    const seed: Record<string, ItemDraft> = {};
    for (const it of initialItems) seed[it.id] = initialDraftFromItem(it);
    return seed;
  });
  const [overrides, setOverrides] = React.useState<Record<string, boolean>>(
    () => {
      const seed: Record<string, boolean> = {};
      for (const it of initialItems) seed[it.id] = it.nairaOverridden;
      return seed;
    },
  );
  const [expanded, setExpanded] = React.useState<string | undefined>(
    initialItems[0]?.id,
  );
  const [rates, setRates] = React.useState<Record<string, RateInfo>>(() => {
    const seed: Record<string, RateInfo> = {};
    for (const r of initialBannerRates) {
      seed[r.code] = { rate: r.rate, fetchedAt: r.fetchedAt };
    }
    return seed;
  });
  const [refreshing, setRefreshing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [manuallyComplete, setManuallyComplete] = React.useState<Set<string>>(
    () => new Set(),
  );

  // Map of itemId → patch for every item whose draft differs from canonical.
  // Recomputed on each render; cheap at this scale (≤ a few dozen items).
  const dirtyPatches = React.useMemo(() => {
    const out: { itemId: string; patch: UpdateItemInput }[] = [];
    for (const item of items) {
      const d = drafts[item.id];
      if (!d) continue;
      const patch = computePatch(d, overrides[item.id] ?? false, item);
      if (patch) out.push({ itemId: item.id, patch });
    }
    return out;
  }, [items, drafts, overrides]);

  const isDirty = dirtyPatches.length > 0;

  function toggleManuallyComplete(itemId: string) {
    setManuallyComplete((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function patchDraft(itemId: string, patch: Partial<ItemDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }));
  }

  function setOverride(itemId: string, value: boolean) {
    setOverrides((prev) => ({ ...prev, [itemId]: value }));
  }

  const loadRate = React.useCallback(async (base: string, force = false) => {
    if (!base || base === "NGN") {
      setRates((r) => ({
        ...r,
        [base]: { rate: 1, fetchedAt: new Date().toISOString() },
      }));
      return;
    }
    try {
      const res = await fetch(
        `/api/rate?base=${encodeURIComponent(base)}${force ? "&force=1" : ""}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if ("error" in data) {
        setRates((r) => ({
          ...r,
          [base]: { rate: 0, fetchedAt: "", error: data.error },
        }));
      } else {
        setRates((r) => ({
          ...r,
          [base]: { rate: data.rate, fetchedAt: data.fetchedAt },
        }));
      }
    } catch (err) {
      setRates((r) => ({
        ...r,
        [base]: {
          rate: 0,
          fetchedAt: "",
          error: err instanceof Error ? err.message : "Network error",
        },
      }));
    }
  }, []);

  React.useEffect(() => {
    const seen = new Set<string>(Object.keys(rates));
    initialItems.forEach((it) => {
      if (it.originalCurrency && !seen.has(it.originalCurrency)) {
        seen.add(it.originalCurrency);
        void loadRate(it.originalCurrency);
      }
    });
    BANNER_CURRENCIES.forEach((c) => {
      if (!seen.has(c.code)) {
        seen.add(c.code);
        void loadRate(c.code);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItems, loadRate]);

  const refreshBannerRates = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const results = await refreshBannerCurrencyRates();
      setRates((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.error) {
            next[r.code] = { rate: 0, fetchedAt: "", error: r.error };
          } else {
            next[r.code] = { rate: r.rate, fetchedAt: r.fetchedAt };
          }
        }
        return next;
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't refresh currency rates",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  const bannerFreshness = React.useMemo(() => {
    let oldest = "";
    for (const c of BANNER_CURRENCIES) {
      const info = rates[c.code];
      if (!info || !info.fetchedAt) return undefined;
      if (!oldest || info.fetchedAt < oldest) oldest = info.fetchedAt;
    }
    return oldest || undefined;
  }, [rates]);

  // Returns true when the server reflects the user's current drafts (either
  // because we just saved, or because there was nothing to save).
  async function handleSave(): Promise<boolean> {
    if (dirtyPatches.length === 0) return true;
    setSaving(true);
    try {
      await saveRfqItems(rfq.id, dirtyPatches);
      // Merge each patch into the canonical items array so the next dirty
      // comparison shows the item as clean.
      setItems((prev) =>
        prev.map((it) => {
          const entry = dirtyPatches.find((p) => p.itemId === it.id);
          if (!entry) return it;
          return { ...it, ...(entry.patch as Partial<DetailsItemPayload>) };
        }),
      );
      toast.success("Changes saved");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (saving || submitting) return;
    // Save-then-submit: submit validates server-side against the saved row, so
    // we must flush drafts first or the user's latest edits won't be seen.
    const saved = await handleSave();
    if (!saved) return;
    setSubmitting(true);
    const result = await submitRfq(rfq.id);
    setSubmitting(false);
    if (result.ok) {
      toast.success(`RFQ ${result.rfqNumber} submitted`);
      router.push(`/rfq/${rfq.id}/quote`);
    } else {
      const first = result.missing[0];
      toast.error(
        `${result.missing.length} item(s) incomplete. "${first.itemName}" is missing: ${first.fields.join(", ")}`,
      );
      setExpanded(first.itemId);
    }
  }

  async function copyRfqId() {
    try {
      await navigator.clipboard.writeText(rfq.rfqNumber);
      toast.success("RFQ ID copied");
    } catch {
      toast.error("Could not copy RFQ ID");
    }
  }

  // Warn on full-page unload (tab close / reload) when drafts are dirty.
  // Intra-app navigation is guarded separately below via confirmLeaveIfDirty.
  React.useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  function confirmLeaveIfDirty(): boolean {
    if (!isDirty) return true;
    return window.confirm(
      "You have unsaved changes. Leave without saving?",
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-4">
      {/* Top area — matches step 1 (entry view) so moving between pages feels static */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-slate-800 tracking-tight">
          Prepare Quote
        </h2>
        <button
          type="button"
          onClick={copyRfqId}
          title="Copy RFQ ID"
          className="group inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors"
        >
          <span>#{rfq.rfqNumber}</span>
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
        </button>
        {rfq.status === "submitted" ? (
          <span className="px-1.5 py-px text-[10px] font-medium bg-[#274579]/10 text-[#274579] rounded uppercase tracking-wide">
            Submitted
          </span>
        ) : (
          <span className="px-1.5 py-px text-[10px] font-medium bg-slate-200 text-slate-600 rounded uppercase tracking-wide">
            Draft
          </span>
        )}
        <div className="relative">
          <button
            type="button"
            aria-label="RFQ options"
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-200 text-slate-900 text-xl leading-none font-black"
          >
            ⋮
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/rfq/${rfq.id}/edit`}
            onClick={(e) => {
              if (!confirmLeaveIfDirty()) e.preventDefault();
            }}
            className="inline-flex items-center gap-1 h-8 px-3 text-sm font-medium text-slate-700 rounded-md hover:bg-[#274579]/10 hover:text-[#274579] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>
      </div>

      {/* Requester row (mirrors step 1 exactly) with the currency banner inline beside it */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
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
              className="h-8 text-xs flex-1 bg-slate-100 border border-slate-300 focus-visible:bg-slate-50 focus-visible:border-slate-400"
            />
          </div>
        </div>
        <div className="lg:col-span-5 flex items-center justify-end">
          <CurrencyBanner
            rates={rates}
            freshness={bannerFreshness}
            refreshing={refreshing}
            onRefresh={refreshBannerRates}
          />
        </div>
      </div>

      <h3 className="mb-4 pl-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Items
      </h3>

      <Accordion
        type="single"
        collapsible
        value={expanded}
        onValueChange={(v) => setExpanded(v || undefined)}
        className="space-y-2"
      >
        {items.map((item, index) => {
          const draft = drafts[item.id];
          const filled = draft ? countFilledFromDraft(draft) : 0;
          const allFieldsFilled = filled === TOTAL_DETAIL_FIELDS;
          const complete = allFieldsFilled || manuallyComplete.has(item.id);
          return (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger>
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-xs font-medium text-muted-foreground tabular-nums shrink-0 w-5 text-center">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-800 truncate">
                      {item.itemName}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {categoryLabel(item.itemCategory)} •{" "}
                      {departmentLabel(item.department)} • Qty:{" "}
                      {item.requestQuantity}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirmLeaveIfDirty()) return;
                        router.push(`/rfq/${rfq.id}/edit?itemId=${item.id}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!confirmLeaveIfDirty()) return;
                          router.push(`/rfq/${rfq.id}/edit?itemId=${item.id}`);
                        }
                      }}
                      className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      Edit
                    </span>
                    <span
                      role="button"
                      aria-disabled={allFieldsFilled}
                      tabIndex={allFieldsFilled ? -1 : 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (allFieldsFilled) return;
                        toggleManuallyComplete(item.id);
                      }}
                      onKeyDown={(e) => {
                        if (allFieldsFilled) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleManuallyComplete(item.id);
                        }
                      }}
                      className={
                        allFieldsFilled
                          ? "inline-flex items-center px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                          : complete
                            ? "inline-flex items-center px-2.5 py-1 text-xs font-medium rounded border border-slate-300 bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                            : "inline-flex items-center px-2.5 py-1 text-xs font-medium rounded border border-[#276e79] bg-[#276e79] text-white hover:bg-[#1e5962] hover:border-[#1e5962] transition-colors cursor-pointer"
                      }
                    >
                      Mark as Complete
                    </span>
                    <div className="text-[11px] text-muted-foreground tabular-nums ml-1">
                      {filled} / {TOTAL_DETAIL_FIELDS}
                    </div>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        complete ? "bg-teal-600" : "bg-slate-300"
                      }`}
                    />
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {draft && (
                  <ItemDetailForm
                    item={item}
                    draft={draft}
                    overridden={overrides[item.id] ?? false}
                    rate={
                      draft.originalCurrency
                        ? rates[draft.originalCurrency]
                        : undefined
                    }
                    onDraftChange={(patch) => patchDraft(item.id, patch)}
                    onOverriddenChange={(v) => setOverride(item.id, v)}
                    onLoadRate={loadRate}
                  />
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <div className="mt-6 flex justify-end gap-2">
        {rfq.status !== "submitted" && (
          <Button
            onClick={handleSave}
            disabled={!isDirty || saving || submitting}
            size="sm"
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        )}
        <Button
          onClick={
            rfq.status === "submitted"
              ? () => router.push(`/rfq/${rfq.id}/quote`)
              : handleSubmit
          }
          disabled={saving || submitting}
          size="sm"
          style={{ backgroundColor: "#274579" }}
          className="text-white hover:opacity-90"
        >
          {submitting ? "Submitting…" : "Proceed to Quote"}
        </Button>
      </div>
    </div>
  );
}

// Subtle strip of currency → Naira conversions. Shrinks to wrap only its
// contents; leads with a refresh button that also doubles as the freshness
// label. Colours are intentionally low-contrast so the strip recedes.
function CurrencyBanner({
  rates,
  freshness,
  refreshing,
  onRefresh,
}: {
  rates: Record<string, RateInfo>;
  freshness: string | undefined;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [, forceTick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const id = setInterval(forceTick, 30_000);
    return () => clearInterval(id);
  }, []);

  const label = refreshing
    ? "Updating…"
    : freshness
      ? relativeTime(freshness)
      : "Not yet updated";

  return (
    <div className="flex w-fit flex-nowrap items-center gap-x-4 rounded-md bg-slate-50/50 px-2.5 py-1.5 whitespace-nowrap">
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors disabled:cursor-wait disabled:opacity-60"
        aria-label="Refresh currency rates"
      >
        <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
        <span className="tabular-nums">{label}</span>
      </button>
      {BANNER_CURRENCIES.map((c) => {
        const info = rates[c.code];
        return (
          <div key={c.code} className="flex items-baseline gap-1 tabular-nums">
            <span className="text-xs font-medium text-slate-400">
              {c.symbol}
            </span>
            {info?.error ? (
              <span className="text-[11px] text-amber-600/80">unavailable</span>
            ) : info ? (
              <span className="text-xs text-slate-500">
                ₦
                {info.rate.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </span>
            ) : (
              <span className="inline-block w-12 h-3 rounded bg-slate-200/60 animate-pulse" />
            )}
          </div>
        );
      })}
    </div>
  );
}
