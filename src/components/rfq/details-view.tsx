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
  submitRfq,
  updateRfqItems,
  type PersistedRate,
} from "@/lib/actions";
import type { UpdateItemInput } from "@/lib/schemas";
import { ItemDetailForm, type DetailsItemPayload } from "./item-detail-form";

export type RateInfo = { rate: number; fetchedAt: string; error?: string };

type Rfq = {
  id: string;
  rfqNumber: string;
  requester: string;
  status: string;
  createdAt: string;
};

const DETAIL_KEYS: (keyof DetailsItemPayload)[] = [
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

function countFilled(item: DetailsItemPayload): number {
  return DETAIL_KEYS.reduce((acc, key) => {
    const v = item[key];
    if (v === null || v === undefined) return acc;
    if (typeof v === "string" && v.trim() === "") return acc;
    if (typeof v === "number" && Number.isNaN(v)) return acc;
    return acc + 1;
  }, 0);
}

// Projects an item into the UpdateItemInput shape expected by the batch-save
// server action. Keeps the 14 detail fields + nairaOverridden; drops identity
// and entry-stage fields.
function pickSavableFields(item: DetailsItemPayload): UpdateItemInput {
  return {
    mProductCode: item.mProductCode,
    unitQuantity: item.unitQuantity,
    uom: item.uom,
    manufacturerName: item.manufacturerName,
    vendor: item.vendor,
    vendorLocation: item.vendorLocation,
    productLink: item.productLink,
    countryOfOrigin: item.countryOfOrigin,
    vendorDeliveryTimeline: item.vendorDeliveryTimeline,
    originalCurrency: item.originalCurrency,
    ogUnitPrice: item.ogUnitPrice,
    ogBoxPrice: item.ogBoxPrice,
    nairaUnitPrice: item.nairaUnitPrice,
    boxPrice: item.boxPrice,
    nairaOverridden: item.nairaOverridden,
  };
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
  // Items live in client state so progress indicators update without a server roundtrip.
  const [items, setItems] = React.useState<DetailsItemPayload[]>(initialItems);
  const [expanded, setExpanded] = React.useState<string | undefined>(initialItems[0]?.id);
  const [rates, setRates] = React.useState<Record<string, RateInfo>>(() => {
    const seed: Record<string, RateInfo> = {};
    for (const r of initialBannerRates) {
      seed[r.code] = { rate: r.rate, fetchedAt: r.fetchedAt };
    }
    return seed;
  });
  const [refreshing, setRefreshing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  // Item ids with unsaved changes. Cleared on successful batch save.
  const [dirtyItemIds, setDirtyItemIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  // Kept current across renders so navigation guard listeners can read it
  // without re-registering on every dirty-set change.
  const itemsRef = React.useRef<DetailsItemPayload[]>(initialItems);
  const dirtyRef = React.useRef<Set<string>>(dirtyItemIds);
  // Items the user has force-marked as complete even though not all 14 detail
  // fields are populated. Kept client-side — the visual indicator resets on
  // reload, which is fine since the only effect is on the progress dot.
  const [manuallyComplete, setManuallyComplete] = React.useState<Set<string>>(
    () => new Set(),
  );

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

  function patchItem(itemId: string, patch: Partial<DetailsItemPayload>) {
    setItems((prev) => {
      const next = prev.map((it) =>
        it.id === itemId ? { ...it, ...patch } : it,
      );
      itemsRef.current = next;
      return next;
    });
  }

  function markDirty(itemId: string) {
    setDirtyItemIds((prev) => {
      if (prev.has(itemId)) return prev;
      const next = new Set(prev);
      next.add(itemId);
      dirtyRef.current = next;
      return next;
    });
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

  // Pre-load rates for any currency already saved on the items, plus any
  // banner currency we don't already have a persisted snapshot for. Persisted
  // banner rates are seeded from the server, so on the common path we don't
  // hammer the upstream on every mount — only the user clicking Update does.
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
    // Intentional: only run on mount. `rates` is used as an initial-check guard,
    // not a trigger — re-running on every rate update would re-fetch forever.
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

  // The banner's "updated X ago" reflects the oldest rate we have, so the
  // label never overstates freshness.
  const bannerFreshness = React.useMemo(() => {
    let oldest = "";
    for (const c of BANNER_CURRENCIES) {
      const info = rates[c.code];
      if (!info || !info.fetchedAt) return undefined;
      if (!oldest || info.fetchedAt < oldest) oldest = info.fetchedAt;
    }
    return oldest || undefined;
  }, [rates]);

  // Flush any in-flight keystroke into parent state before we read `items`.
  // The form's draft → parent sync happens on blur, so blurring the focused
  // element synchronously runs that handler.
  function flushActiveElement() {
    if (typeof document === "undefined") return;
    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === "function") active.blur();
  }

  // Runs the batch save for every dirty item. Returns true when the caller is
  // safe to proceed (nothing to save, or save succeeded) and false on error.
  async function handleSave(): Promise<boolean> {
    flushActiveElement();
    const currentDirty = dirtyRef.current;
    if (currentDirty.size === 0) return true;

    const patches = itemsRef.current
      .filter((it) => currentDirty.has(it.id))
      .map((it) => ({ id: it.id, patch: pickSavableFields(it) }));
    if (patches.length === 0) return true;

    setSaving(true);
    try {
      await updateRfqItems(rfq.id, patches);
      setDirtyItemIds(() => {
        const empty = new Set<string>();
        dirtyRef.current = empty;
        return empty;
      });
      toast.success("Saved");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (dirtyRef.current.size > 0) {
      const ok = await handleSave();
      if (!ok) return;
    }
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

  // Auto-save before an in-app navigation (Back link, per-item Edit button,
  // browser back/forward). Returns false if the caller should abort the nav.
  async function saveBeforeNavigate(): Promise<boolean> {
    if (dirtyRef.current.size === 0) return true;
    return handleSave();
  }

  // beforeunload: native prompt for tab-close / refresh / external navigation
  // while dirty. Attaches only when there's unsaved work so clean pages stay
  // silent.
  React.useEffect(() => {
    if (dirtyItemIds.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyItemIds]);

  // popstate: browser back/forward within the app. Route has already changed
  // by the time this fires, so we kick off the batch save in the background
  // and let the toast surface the result on the next page.
  React.useEffect(() => {
    if (dirtyItemIds.size === 0) return;
    const handler = () => {
      void handleSave();
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
    // handleSave is stable enough — it reads through refs — so omitting it
    // from deps keeps the listener from re-registering on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyItemIds]);

  async function copyRfqId() {
    try {
      await navigator.clipboard.writeText(rfq.rfqNumber);
      toast.success("RFQ ID copied");
    } catch {
      toast.error("Could not copy RFQ ID");
    }
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-4">
      {/* Top area — matches step 1 (entry view) so moving between pages feels static */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-slate-800 tracking-tight">
          Request for Quote
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
        {/* Visual-only placeholder to keep the dot-menu slot aligned with step 1;
            actions will be wired up later. */}
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
            onClick={async (e) => {
              if (dirtyRef.current.size === 0) return;
              e.preventDefault();
              const ok = await saveBeforeNavigate();
              if (ok) router.push(`/rfq/${rfq.id}/edit`);
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
          const filled = countFilled(item);
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
                    {/* Nested inside the trigger button, so these act as buttons
                        via role+keyboard rather than real <button> elements to
                        keep the DOM valid. Clicks are stopped from propagating
                        so they don't toggle the accordion. */}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await saveBeforeNavigate();
                        if (ok) {
                          router.push(
                            `/rfq/${rfq.id}/edit?itemId=${item.id}`,
                          );
                        }
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          const ok = await saveBeforeNavigate();
                          if (ok) {
                            router.push(
                              `/rfq/${rfq.id}/edit?itemId=${item.id}`,
                            );
                          }
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
                <ItemDetailForm
                  item={item}
                  rate={
                    item.originalCurrency
                      ? rates[item.originalCurrency]
                      : undefined
                  }
                  onLoadRate={loadRate}
                  onLocalPatch={(patch) => patchItem(item.id, patch)}
                  onMarkDirty={() => markDirty(item.id)}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <div className="mt-6 flex justify-end items-center gap-2">
        {rfq.status !== "submitted" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saving || submitting || dirtyItemIds.size === 0}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        )}
        <Button
          onClick={
            rfq.status === "submitted"
              ? () => router.push(`/rfq/${rfq.id}/quote`)
              : handleSubmit
          }
          disabled={submitting || saving}
          size="sm"
          style={{ backgroundColor: "#274579" }}
          className="text-white hover:opacity-90"
        >
          {submitting
            ? "Submitting…"
            : saving
              ? "Saving…"
              : "Proceed to Quote"}
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
  // Re-render the freshness label every 30s so "Updated now" ticks to
  // "Updated 1m ago" without the user having to interact.
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
