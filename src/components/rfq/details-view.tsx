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
import { categoryLabel, departmentLabel, TOTAL_DETAIL_FIELDS } from "@/lib/constants";
import { submitRfq } from "@/lib/actions";
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

function relativeTime(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diffSec = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}

// Currencies surfaced in the conversion banner below the header. Kept narrow and
// ordered by how often our buyers actually transact in them.
const BANNER_CURRENCIES: { code: string; name: string; symbol: string }[] = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
];

export function DetailsView({
  rfq,
  initialItems,
}: {
  rfq: Rfq;
  initialItems: DetailsItemPayload[];
}) {
  const router = useRouter();
  // Items live in client state so progress indicators update without a server roundtrip.
  const [items, setItems] = React.useState<DetailsItemPayload[]>(initialItems);
  const [expanded, setExpanded] = React.useState<string | undefined>(initialItems[0]?.id);
  const [rates, setRates] = React.useState<Record<string, RateInfo>>({});
  const [submitting, setSubmitting] = React.useState(false);
  // Items the user has force-marked as complete even though not all 14 detail
  // fields are populated. Kept client-side — the visual indicator resets on
  // reload, which is fine since the only effect is on the progress dot.
  const [manuallyComplete, setManuallyComplete] = React.useState<Set<string>>(
    () => new Set(),
  );

  function markComplete(itemId: string) {
    setManuallyComplete((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  }

  function patchItem(itemId: string, patch: Partial<DetailsItemPayload>) {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    );
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

  // Pre-load rates for any currency already saved on the items, plus every
  // currency shown in the banner below the header.
  React.useEffect(() => {
    const seen = new Set<string>();
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
  }, [initialItems, loadRate]);

  const refreshBannerRates = React.useCallback(() => {
    BANNER_CURRENCIES.forEach((c) => {
      void loadRate(c.code, true);
    });
  }, [loadRate]);

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

  async function handleSubmit() {
    setSubmitting(true);
    const result = await submitRfq(rfq.id);
    setSubmitting(false);
    if (result.ok) {
      toast.success(`RFQ ${result.rfqNumber} submitted`);
      // No read-only view yet — refresh in place so the status badge updates.
      router.refresh();
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
          <span className="px-1.5 py-px text-[10px] font-medium bg-teal-100 text-teal-700 rounded uppercase tracking-wide">
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
            className="group inline-flex items-center h-8 text-sm font-medium text-slate-700 hover:text-[#274579] transition-colors"
          >
            {/* Pointed tip — a small clipped triangle flush against the body */}
            <span
              aria-hidden
              className="block h-full w-3 group-hover:bg-[#274579]/10 transition-colors"
              style={{ clipPath: "polygon(100% 0, 100% 100%, 0 50%)" }}
            />
            {/* Rounded-square body around the icon and label */}
            <span className="inline-flex items-center gap-1 h-full pl-1 pr-3 group-hover:bg-[#274579]/10 rounded-r-md transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </span>
          </Link>
          <Button
            onClick={handleSubmit}
            disabled={submitting || rfq.status === "submitted"}
            size="sm"
            style={{ backgroundColor: "#274579" }}
            className="text-white hover:opacity-90"
          >
            {submitting ? "Submitting…" : "Quote"}
          </Button>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(
                          `/rfq/${rfq.id}/edit?itemId=${item.id}`,
                        );
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(
                            `/rfq/${rfq.id}/edit?itemId=${item.id}`,
                          );
                        }
                      }}
                      className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      Edit
                    </span>
                    <span
                      role="button"
                      aria-disabled={complete}
                      tabIndex={complete ? -1 : 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (complete) return;
                        markComplete(item.id);
                      }}
                      onKeyDown={(e) => {
                        if (complete) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          markComplete(item.id);
                        }
                      }}
                      className={
                        complete
                          ? "inline-flex items-center px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
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
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

// Subtle strip of currency → Naira conversions. Shrinks to wrap only its
// contents; leads with a refresh button that also doubles as the freshness
// label. Colours are intentionally low-contrast so the strip recedes.
function CurrencyBanner({
  rates,
  freshness,
  onRefresh,
}: {
  rates: Record<string, RateInfo>;
  freshness: string | undefined;
  onRefresh: () => void;
}) {
  return (
    <div className="flex w-fit flex-nowrap items-center gap-x-4 rounded-md bg-slate-50/50 px-2.5 py-1.5 whitespace-nowrap">
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
        aria-label="Refresh currency rates"
      >
        <RefreshCw className="h-3 w-3" />
        <span className="tabular-nums">
          {freshness ? `updated ${relativeTime(freshness)}` : "updating…"}
        </span>
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
