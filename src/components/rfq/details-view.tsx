"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
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
  proceedToQuote,
  toggleItemComplete,
  type PersistedRate,
} from "@/lib/actions";
import { ItemDetailForm, type DetailsItemPayload } from "./item-detail-form";
import { RfqStepper } from "./rfq-stepper";
import { CurrencyBanner, type RateInfo } from "./currency-banner";

type Rfq = {
  id: string;
  rfqNumber: string;
  requester: string;
  status: string;
  createdAt: string;
  purchaseOrders: { id: string; poNumber: string; status: string }[];
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
  "nairaUnitPrice",
  "tax",
  "domesticShippingCost",
  "intlShippingCost",
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
  const searchParams = useSearchParams();
  const fromList = searchParams.get("from") === "list";
  // Items live in client state so progress indicators update without a server roundtrip.
  const [items, setItems] = React.useState<DetailsItemPayload[]>(initialItems);
  const [expanded, setExpanded] = React.useState<string | undefined>(undefined);
  const [rates, setRates] = React.useState<Record<string, RateInfo>>(() => {
    const seed: Record<string, RateInfo> = {};
    for (const r of initialBannerRates) {
      seed[r.code] = { rate: r.rate, fetchedAt: r.fetchedAt };
    }
    return seed;
  });
  const [refreshing, setRefreshing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [showCompleteWarning, setShowCompleteWarning] = React.useState(false);
  function handleToggleComplete(itemId: string, currentValue: boolean) {
    const next = !currentValue;
    patchItem(itemId, { markedComplete: next });
    void toggleItemComplete(itemId, next);
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

  function isComplete(item: DetailsItemPayload) {
    return countFilled(item) === TOTAL_DETAIL_FIELDS || item.markedComplete;
  }

  const incompleteCount = items.reduce(
    (n, it) => (isComplete(it) ? n : n + 1),
    0,
  );
  const allComplete = incompleteCount === 0;

  const alreadyQuoted = rfq.status === "quoted" || rfq.status === "ordered";

  async function handleSubmit() {
    // Once an RFQ has been quoted (or ordered), the button just reopens the
    // quote page for export — no need to re-run the status transition.
    if (alreadyQuoted) {
      router.push(`/rfq/${rfq.id}/quote`);
      return;
    }
    if (!allComplete) {
      setShowCompleteWarning(true);
      return;
    }
    setShowCompleteWarning(false);
    setSubmitting(true);
    await proceedToQuote(rfq.id);
    router.push(`/rfq/${rfq.id}/quote`);
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
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-3 mb-6">
        {fromList ? (
          <Link
            href="/rfq"
            className="-ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-1 text-sm font-semibold uppercase tracking-wide text-slate-600 rounded-md active:bg-slate-200 active:text-slate-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to RFQ<span className="font-semibold text-[0.88em] tracking-normal -ml-[2px] relative top-[1px]">s</span>
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
          Request for Quote
        </h2>
        <div className="flex items-center gap-2">
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
          {rfq.status === "ordered" ? (
            <span className="px-2 py-0.5 text-xs font-medium bg-[#274579]/10 text-[#274579] rounded uppercase tracking-wide">
              Ordered
            </span>
          ) : rfq.status === "quoted" ? (
            <span className="px-2 py-0.5 text-xs font-medium bg-[#274579]/10 text-[#274579] rounded uppercase tracking-wide">
              Quoted
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs font-medium bg-[#274579]/10 text-[#274579] rounded uppercase tracking-wide">
              In Progress
            </span>
          )}
        </div>
      </div>

      {/* Stepper pushed rightward via ml-auto (consumes left free space) so it sits next to
          the divider. Divider has symmetric mx-6 gaps, so the spacing on either side matches. */}
      <div className="flex flex-wrap items-center gap-y-3 mb-4 px-1">
        <div className="ml-auto">
          <RfqStepper currentStep={2} rfqId={rfq.id} />
        </div>
        <div aria-hidden="true" className="h-8 w-px bg-slate-300 mx-6" />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
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
              className="h-8 text-xs w-64 bg-slate-100 border border-slate-300 focus-visible:bg-slate-50 focus-visible:border-slate-400"
            />
          </div>
          <CurrencyBanner
            rates={rates}
            freshness={bannerFreshness}
            refreshing={refreshing}
            onRefresh={refreshBannerRates}
          />
        </div>
      </div>

      {rfq.purchaseOrders.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          <span className="text-xs text-emerald-800">
            {rfq.purchaseOrders.length === 1
              ? "A purchase order has been created for this quote."
              : `${rfq.purchaseOrders.length} purchase orders have been created for this quote.`}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {rfq.purchaseOrders.map((po) => (
              <Link
                key={po.id}
                href={`/po/${po.id}`}
                className="inline-flex items-center rounded border border-emerald-300 bg-white px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                View PO #{po.poNumber}
              </Link>
            ))}
          </div>
        </div>
      )}

      <h3 className="mt-6 mb-4 pl-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
          const complete = isComplete(item);
          return (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger>
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-xs font-medium text-muted-foreground tabular-nums shrink-0 w-5 text-center">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0 ml-3">
                    <div className="font-semibold text-sm text-slate-800 truncate">
                      {item.itemName}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {categoryLabel(item.itemCategory)} •{" "}
                      {departmentLabel(item.department)} • Qty:{" "}
                      {item.requestQuantity}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 mr-2">
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
                      aria-disabled={allFieldsFilled}
                      tabIndex={allFieldsFilled ? -1 : 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (allFieldsFilled) return;
                        handleToggleComplete(item.id, item.markedComplete);
                      }}
                      onKeyDown={(e) => {
                        if (allFieldsFilled) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          handleToggleComplete(item.id, item.markedComplete);
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
                    <div className="text-[11px] text-muted-foreground tabular-nums w-10 text-right shrink-0">
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

      <div className="mt-6 flex items-center justify-end gap-3">
        {showCompleteWarning && !allComplete && (
          <p className="text-xs text-orange-600 font-medium">
            {incompleteCount === 1
              ? "1 item still needs to be completed"
              : `${incompleteCount} items still need to be completed`}
            {" "}before proceeding.
          </p>
        )}
        <Button
          onClick={handleSubmit}
          disabled={submitting}
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

