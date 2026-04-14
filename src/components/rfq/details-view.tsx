"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Coins } from "lucide-react";
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

  return (
    <div className="max-w-6xl mx-auto px-8 py-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-8 px-8 py-4 mb-6 bg-background/95 backdrop-blur border-b border-slate-200">
        <div className="flex items-center gap-6">
          <Link href="/rfq/new">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-xl font-semibold text-slate-800 truncate">
                Request for Quote
              </div>
              {rfq.status === "submitted" ? (
                <span className="px-1.5 py-px text-[10px] font-medium bg-teal-100 text-teal-700 rounded uppercase tracking-wide">
                  Submitted
                </span>
              ) : (
                <span className="px-1.5 py-px text-[10px] font-medium bg-slate-200 text-slate-600 rounded uppercase tracking-wide">
                  Draft
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {rfq.rfqNumber} · Requester: {rfq.requester}
            </div>
          </div>

          <RateRefresh
            info={bannerFreshness}
            onRefresh={refreshBannerRates}
          />

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

      <CurrencyBanner rates={rates} />

      <div className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-800 tracking-tight">
          RFQ Details
        </h1>
        <p className="text-muted-foreground mt-1">
          Fill in vendor, pricing, and sourcing info for each item. Progress
          auto-saves on blur.
        </p>
      </div>

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

// Compact pill in the sticky header: a coins glyph, a refresh button, and the
// "updated X ago" label all bound into a single non-obtrusive container.
function RateRefresh({
  info,
  onRefresh,
}: {
  info: string | undefined;
  onRefresh: () => void;
}) {
  return (
    <div className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 pl-2 pr-1 py-1 text-xs text-slate-600">
      <Coins className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
      <span className="tabular-nums text-slate-500">
        {info ? `updated ${relativeTime(info)}` : "updating…"}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        className="flex items-center justify-center h-5 w-5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-200"
        aria-label="Refresh currency rates"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Subtle strip of currency → Naira conversions. Intentionally minimal: just
// the symbol and the price — no headings, no descriptions.
function CurrencyBanner({ rates }: { rates: Record<string, RateInfo> }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-2.5">
      {BANNER_CURRENCIES.map((c) => {
        const info = rates[c.code];
        return (
          <div key={c.code} className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-sm font-semibold text-slate-500">
              {c.symbol}
            </span>
            {info?.error ? (
              <span className="text-xs text-amber-700">unavailable</span>
            ) : info ? (
              <span className="text-sm font-medium text-slate-800">
                ₦
                {info.rate.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </span>
            ) : (
              <span className="inline-block w-14 h-3.5 rounded bg-slate-200/70 animate-pulse" />
            )}
          </div>
        );
      })}
    </div>
  );
}
