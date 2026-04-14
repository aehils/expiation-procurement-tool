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
import { categoryLabel, departmentLabel, TOTAL_DETAIL_FIELDS } from "@/lib/constants";
import { submitRfq } from "@/lib/actions";
import { ItemDetailForm, type DetailsItemPayload } from "./item-detail-form";

export type RateInfo = { rate: number; fetchedAt: string; error?: string };

type Rfq = {
  id: string;
  rfqNumber: string;
  requester: string;
  status: string;
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
    <div className="max-w-6xl mx-auto px-8 py-6">
      {/* Sticky nav */}
      <nav className="sticky top-0 z-20 px-4 py-3 mb-6 bg-slate-50/90 backdrop-blur border border-slate-200 rounded-lg">
        <div className="flex items-center gap-3">
          <Link href="/rfq/new">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>

          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
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

          <div className="ml-auto">
            <Button
              onClick={handleSubmit}
              disabled={submitting || rfq.status === "submitted"}
              style={{ backgroundColor: "#274579" }}
              className="text-white hover:opacity-90"
            >
              {submitting ? "Submitting…" : "Create Quote"}
            </Button>
          </div>
        </div>
      </nav>

      <CurrencyBanner
        rates={rates}
        freshness={bannerFreshness}
        onRefresh={refreshBannerRates}
      />

      <h3 className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Items
      </h3>

      <Accordion
        type="single"
        collapsible
        value={expanded}
        onValueChange={(v) => setExpanded(v || undefined)}
        className="space-y-3"
      >
        {items.map((item, index) => {
          const filled = countFilled(item);
          const complete = filled === TOTAL_DETAIL_FIELDS;
          return (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger>
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-sm font-medium text-muted-foreground tabular-nums shrink-0 w-6 text-center">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base text-slate-800 truncate">
                      {item.itemName}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {categoryLabel(item.itemCategory)} •{" "}
                      {departmentLabel(item.department)} • Qty:{" "}
                      {item.requestQuantity}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {filled} / {TOTAL_DETAIL_FIELDS}
                    </div>
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
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
    <div className="mb-6 flex w-fit flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md bg-slate-50/50 px-2.5 py-1.5">
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
