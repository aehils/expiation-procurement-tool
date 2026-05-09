"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CURRENCIES,
  CURRENCY_SYMBOLS,
  UNITS_OF_MEASURE,
} from "@/lib/constants";
import { updateRfqItem } from "@/lib/actions";
import type { RateInfo } from "./details-view";

export type DetailsItemPayload = {
  id: string;
  itemCategory: string;
  department: string;
  itemName: string;
  requestQuantity: number;
  mProductCode: string | null;
  unitQuantity: number | null;
  uom: string | null;
  manufacturerName: string | null;
  vendor: string | null;
  vendorLocation: string | null;
  productLink: string | null;
  countryOfOrigin: string | null;
  vendorDeliveryTimeline: string | null;
  originalCurrency: string | null;
  ogUnitPrice: number | null;
  nairaUnitPrice: number | null;
  nairaOverridden: boolean;
  tax: number | null;
  taxMode: "amount" | "percent" | null;
  domesticShippingCost: number | null;
  domesticShippingNaira: number | null;
  intlShippingCost: number | null;
  intlShippingNaira: number | null;
  brand: string | null;
};

type FieldKey = Exclude<
  keyof DetailsItemPayload,
  "id" | "itemCategory" | "department" | "itemName" | "requestQuantity"
>;

function toInputString(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function ItemDetailForm({
  item,
  rate,
  onLoadRate,
  onLocalPatch,
}: {
  item: DetailsItemPayload;
  rate: RateInfo | undefined;
  onLoadRate: (base: string, force?: boolean) => Promise<void> | void;
  onLocalPatch: (patch: Partial<DetailsItemPayload>) => void;
}) {
  const [draft, setDraft] = React.useState({
    mProductCode: toInputString(item.mProductCode),
    unitQuantity: toInputString(item.unitQuantity),
    uom: item.uom ?? "",
    manufacturerName: toInputString(item.manufacturerName),
    vendor: toInputString(item.vendor),
    vendorLocation: toInputString(item.vendorLocation),
    productLink: toInputString(item.productLink),
    countryOfOrigin: toInputString(item.countryOfOrigin),
    vendorDeliveryTimeline: toInputString(item.vendorDeliveryTimeline),
    originalCurrency: item.originalCurrency ?? "",
    ogUnitPrice: toInputString(item.ogUnitPrice),
    nairaUnitPrice: toInputString(item.nairaUnitPrice),
    tax: toInputString(item.tax),
    domesticShippingCost: toInputString(item.domesticShippingCost),
    domesticShippingNaira: toInputString(item.domesticShippingNaira),
    intlShippingCost: toInputString(item.intlShippingCost),
    intlShippingNaira: toInputString(item.intlShippingNaira),
  });
  const [overridden, setOverridden] = React.useState(item.nairaOverridden);
  const [taxMode, setTaxMode] = React.useState<"amount" | "percent">(
    item.taxMode ?? "amount",
  );

  function setField<K extends keyof typeof draft>(key: K, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const persist = React.useCallback(
    async (patch: Partial<DetailsItemPayload>) => {
      try {
        await updateRfqItem(item.id, patch);
        onLocalPatch(patch);
      } catch (err) {
        console.error(err);
        toast.error("Couldn't save change. Try again.");
      }
    },
    [item.id, onLocalPatch],
  );

  function parseNumber(raw: string): number | null {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  // --- Currency / conversion handlers -------------------------------------------------

  async function handleCurrencyChange(value: string) {
    setField("originalCurrency", value);
    if (value && value !== "NGN") void onLoadRate(value);
    if (value === "NGN") {
      const og = parseNumber(draft.ogUnitPrice);
      const next: Partial<DetailsItemPayload> = { originalCurrency: "NGN" };
      if (!overridden && og !== null) {
        next.nairaUnitPrice = og;
        setField("nairaUnitPrice", String(og));
      }
      // Mirror shipping costs as-is when source is NGN.
      const dom = parseNumber(draft.domesticShippingCost);
      const intl = parseNumber(draft.intlShippingCost);
      if (dom !== null) {
        next.domesticShippingNaira = dom;
        setField("domesticShippingNaira", String(dom));
      }
      if (intl !== null) {
        next.intlShippingNaira = intl;
        setField("intlShippingNaira", String(intl));
      }
      await persist(next);
    } else {
      await persist({ originalCurrency: value });
    }
  }

  // Recompute naira unit price + naira shipping when the rate or override flag changes.
  React.useEffect(() => {
    if (!rate || rate.error) return;
    if (!draft.originalCurrency) return;
    const multiplier = draft.originalCurrency === "NGN" ? 1 : rate.rate;

    const patch: Partial<DetailsItemPayload> = {};
    let touched = false;

    if (!overridden) {
      const og = parseNumber(draft.ogUnitPrice);
      if (og !== null) {
        const computed = +(og * multiplier).toFixed(2);
        if (String(computed) !== draft.nairaUnitPrice) {
          setField("nairaUnitPrice", String(computed));
          patch.nairaUnitPrice = computed;
          touched = true;
        }
      }
    }

    const dom = parseNumber(draft.domesticShippingCost);
    if (dom !== null) {
      const computed = +(dom * multiplier).toFixed(2);
      if (String(computed) !== draft.domesticShippingNaira) {
        setField("domesticShippingNaira", String(computed));
        patch.domesticShippingNaira = computed;
        touched = true;
      }
    }
    const intl = parseNumber(draft.intlShippingCost);
    if (intl !== null) {
      const computed = +(intl * multiplier).toFixed(2);
      if (String(computed) !== draft.intlShippingNaira) {
        setField("intlShippingNaira", String(computed));
        patch.intlShippingNaira = computed;
        touched = true;
      }
    }
    if (touched) void persist(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate, overridden]);

  function handleOgPriceBlur() {
    const value = parseNumber(draft.ogUnitPrice);
    const patch: Partial<DetailsItemPayload> = { ogUnitPrice: value };
    if (!overridden && rate && !rate.error && draft.originalCurrency) {
      const multiplier = draft.originalCurrency === "NGN" ? 1 : rate.rate;
      if (value !== null) {
        const computed = +(value * multiplier).toFixed(2);
        setField("nairaUnitPrice", String(computed));
        patch.nairaUnitPrice = computed;
      }
    }
    void persist(patch);
  }

  function handleNairaUnitBlur() {
    const value = parseNumber(draft.nairaUnitPrice);
    setOverridden(true);
    void persist({ nairaUnitPrice: value, nairaOverridden: true });
  }

  function handleShippingBlur(kind: "domestic" | "intl") {
    const costKey =
      kind === "domestic" ? "domesticShippingCost" : "intlShippingCost";
    const nairaKey =
      kind === "domestic" ? "domesticShippingNaira" : "intlShippingNaira";
    const value = parseNumber(draft[costKey]);
    const patch: Partial<DetailsItemPayload> = { [costKey]: value };
    if (rate && !rate.error && draft.originalCurrency) {
      const multiplier = draft.originalCurrency === "NGN" ? 1 : rate.rate;
      if (value !== null) {
        const computed = +(value * multiplier).toFixed(2);
        setField(nairaKey, String(computed));
        (patch as Record<string, unknown>)[nairaKey] = computed;
      } else {
        setField(nairaKey, "");
        (patch as Record<string, unknown>)[nairaKey] = null;
      }
    }
    void persist(patch);
  }

  function handleTaxBlur() {
    const value = parseNumber(draft.tax);
    void persist({ tax: value, taxMode });
  }

  function handleTaxModeToggle(mode: "amount" | "percent") {
    if (mode === taxMode) return;
    setTaxMode(mode);
    void persist({ taxMode: mode });
  }

  // --- Generic save-on-blur for non-pricing fields ------------------------------------

  function blurString(field: FieldKey, raw: string) {
    void persist({
      [field]: raw.trim() === "" ? null : raw,
    } as Partial<DetailsItemPayload>);
  }
  function blurNumber(field: FieldKey, raw: string) {
    void persist({
      [field]: parseNumber(raw),
    } as Partial<DetailsItemPayload>);
  }

  // --- Derived summation values -------------------------------------------------------

  const qty = item.requestQuantity || 0;
  const fxMultiplier =
    draft.originalCurrency === "NGN" ? 1 : (rate?.rate ?? 1);

  // All intermediate rows operate in the original currency.
  const ogUnit = parseNumber(draft.ogUnitPrice) ?? 0;
  const taxN = parseNumber(draft.tax);
  const taxAmountOg =
    taxN === null
      ? 0
      : taxMode === "percent"
        ? +(ogUnit * (taxN / 100)).toFixed(2)
        : taxN;
  const domOgTotal = parseNumber(draft.domesticShippingCost) ?? 0;
  const intlOgTotal = parseNumber(draft.intlShippingCost) ?? 0;
  const domPerUnit = qty > 0 ? domOgTotal / qty : 0;
  const intlPerUnit = qty > 0 ? intlOgTotal / qty : 0;
  const perUnitTotalOg = ogUnit + taxAmountOg + domPerUnit + intlPerUnit;
  const perUnitTotalNaira = +(perUnitTotalOg * fxMultiplier).toFixed(2);
  const lineTotal = perUnitTotalNaira * qty;

  const ogSymbol =
    draft.originalCurrency && CURRENCY_SYMBOLS[draft.originalCurrency]
      ? CURRENCY_SYMBOLS[draft.originalCurrency]
      : draft.originalCurrency || "—";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-slate-200/80">
        {/* LEFT HALF */}
        <div className="md:pr-5 space-y-5">
          <Section title="Product identification" layout="stack">
            <Field label="Manufacturer">
              <Input
                className="h-8 text-xs"
                value={draft.manufacturerName}
                onChange={(e) => setField("manufacturerName", e.target.value)}
                onBlur={(e) => blurString("manufacturerName", e.target.value)}
              />
            </Field>
            <Field label="Manufacturer Product Code">
              <Input
                className="h-8 text-xs"
                value={draft.mProductCode}
                onChange={(e) => setField("mProductCode", e.target.value)}
                onBlur={(e) => blurString("mProductCode", e.target.value)}
              />
            </Field>
            <Field label="Country of Origin">
              <Input
                className="h-8 text-xs"
                value={draft.countryOfOrigin}
                onChange={(e) => setField("countryOfOrigin", e.target.value)}
                onBlur={(e) => blurString("countryOfOrigin", e.target.value)}
              />
            </Field>
          </Section>

          <Section title="Quantity" layout="pair">
            <Field label="Unit Quantity" required>
              <Input
                type="number"
                min="0"
                className="h-8 text-xs"
                value={draft.unitQuantity}
                onChange={(e) => setField("unitQuantity", e.target.value)}
                onBlur={(e) => blurNumber("unitQuantity", e.target.value)}
              />
            </Field>
            <Field label="Unit of Measure" required>
              <Select
                value={draft.uom}
                onValueChange={(v) => {
                  setField("uom", v);
                  void persist({ uom: v });
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS_OF_MEASURE.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Section>
        </div>

        {/* RIGHT HALF */}
        <div className="md:pl-5 pt-5 md:pt-0 flex flex-col">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Vendor
          </h3>
          <div className="flex flex-1 flex-col gap-3">
            <Field label="Vendor Name" required>
              <Input
                className="h-8 text-xs"
                value={draft.vendor}
                onChange={(e) => setField("vendor", e.target.value)}
                onBlur={(e) => blurString("vendor", e.target.value)}
              />
            </Field>
            <Field label="Vendor Location">
              <Input
                className="h-8 text-xs"
                value={draft.vendorLocation}
                onChange={(e) => setField("vendorLocation", e.target.value)}
                onBlur={(e) => blurString("vendorLocation", e.target.value)}
              />
            </Field>
            <Field label="Product Link">
              <Input
                type="url"
                placeholder="https://"
                className="h-8 text-xs"
                value={draft.productLink}
                onChange={(e) => setField("productLink", e.target.value)}
                onBlur={(e) => blurString("productLink", e.target.value)}
              />
            </Field>
            <Field
              label="Vendor Delivery Timeline"
              className="flex flex-1 flex-col"
            >
              <Textarea
                className="text-xs py-1.5 flex-1 min-h-[80px] resize-none"
                value={draft.vendorDeliveryTimeline}
                onChange={(e) =>
                  setField("vendorDeliveryTimeline", e.target.value)
                }
                onBlur={(e) =>
                  blurString("vendorDeliveryTimeline", e.target.value)
                }
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Pricing — single row: currency, og unit price, naira unit price */}
      <Section title="Pricing">
        <Field label="Original Currency" required>
          <Select
            value={draft.originalCurrency}
            onValueChange={handleCurrencyChange}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Original Unit Price" required>
          <Input
            type="number"
            min="0"
            step="0.01"
            className="h-8 text-xs"
            value={draft.ogUnitPrice}
            onChange={(e) => setField("ogUnitPrice", e.target.value)}
            onBlur={handleOgPriceBlur}
          />
        </Field>
        <Field label="Naira Unit Price (₦)" required>
          <Input
            type="number"
            min="0"
            step="0.01"
            className="h-8 text-xs"
            value={draft.nairaUnitPrice}
            onChange={(e) => setField("nairaUnitPrice", e.target.value)}
            onBlur={handleNairaUnitBlur}
          />
        </Field>

        {overridden && (
          <div className="md:col-span-3 flex items-center gap-2 text-[11px] text-amber-700">
            <span>
              Naira unit price is manually overridden — auto-conversion paused.
            </span>
            <button
              type="button"
              className="underline hover:no-underline"
              onClick={() => {
                setOverridden(false);
                void persist({ nairaOverridden: false });
              }}
            >
              Resume auto-conversion
            </button>
          </div>
        )}
        {rate?.error &&
          draft.originalCurrency &&
          draft.originalCurrency !== "NGN" && (
            <div className="md:col-span-3 text-[11px] text-amber-700">
              Couldn&apos;t fetch the {draft.originalCurrency}→NGN rate. Enter
              naira values manually.
            </div>
          )}
      </Section>

      {/* Tax + Shipping + per-item summation */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Tax &amp; Shipping
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-3 items-start">
          {/* Row 1 col 1: Tax field with the mode toggle nested inside the input */}
          <div>
            <Label className="mb-1 block text-xs">Tax</Label>
            <div className="relative h-8">
              <Input
                type="number"
                min="0"
                step="0.01"
                className="h-8 text-xs pr-[60px]"
                value={draft.tax}
                onChange={(e) => setField("tax", e.target.value)}
                onBlur={handleTaxBlur}
                placeholder={
                  taxMode === "percent" ? "Tax rate" : "Tax amount per unit"
                }
              />
              <div className="absolute inset-y-1 right-1 inline-flex items-stretch rounded border border-slate-200 overflow-hidden text-[11px] leading-none">
                <button
                  type="button"
                  onClick={() => handleTaxModeToggle("amount")}
                  aria-pressed={taxMode === "amount"}
                  className={
                    taxMode === "amount"
                      ? "px-1.5 bg-[#274579] text-white"
                      : "px-1.5 bg-white text-slate-500 hover:bg-slate-50"
                  }
                  title="Tax as a fixed amount"
                  tabIndex={-1}
                >
                  {ogSymbol}
                </button>
                <button
                  type="button"
                  onClick={() => handleTaxModeToggle("percent")}
                  aria-pressed={taxMode === "percent"}
                  className={
                    taxMode === "percent"
                      ? "px-1.5 border-l border-slate-200 bg-[#274579] text-white"
                      : "px-1.5 border-l border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }
                  title="Tax as a percentage of unit price"
                  tabIndex={-1}
                >
                  %
                </button>
              </div>
            </div>
          </div>
          {/* Row 1 col 2: empty placeholder to keep grid alignment */}
          <div className="hidden md:block" />

          {/* Summation table — spans all three rows on the right column */}
          <div className="md:row-span-3 md:col-start-3 md:row-start-1 self-stretch">
            <SummationTable
              ogSymbol={ogSymbol}
              qty={qty}
              unitPrice={ogUnit}
              taxAmount={taxAmountOg}
              taxMode={taxMode}
              taxRaw={taxN}
              domPerUnit={domPerUnit}
              intlPerUnit={intlPerUnit}
              perUnitTotalOg={perUnitTotalOg}
              perUnitTotalNaira={perUnitTotalNaira}
              lineTotal={lineTotal}
              isNgn={draft.originalCurrency === "NGN"}
            />
          </div>

          {/* Row 2: Domestic shipping */}
          <Field label="Domestic Shipping Cost">
            <Input
              type="number"
              min="0"
              step="0.01"
              className="h-8 text-xs"
              value={draft.domesticShippingCost}
              onChange={(e) =>
                setField("domesticShippingCost", e.target.value)
              }
              onBlur={() => handleShippingBlur("domestic")}
            />
          </Field>
          <Field label="Domestic Shipping (Naira)">
            <Input
              type="number"
              min="0"
              step="0.01"
              readOnly
              className="h-8 text-xs bg-slate-50"
              value={draft.domesticShippingNaira}
              placeholder="Auto"
            />
          </Field>

          {/* Row 3: International shipping */}
          <Field label="International Shipping Cost">
            <Input
              type="number"
              min="0"
              step="0.01"
              className="h-8 text-xs"
              value={draft.intlShippingCost}
              onChange={(e) => setField("intlShippingCost", e.target.value)}
              onBlur={() => handleShippingBlur("intl")}
            />
          </Field>
          <Field label="International Shipping (Naira)">
            <Input
              type="number"
              min="0"
              step="0.01"
              readOnly
              className="h-8 text-xs bg-slate-50"
              value={draft.intlShippingNaira}
              placeholder="Auto"
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

function Section({
  title,
  layout = "grid",
  children,
}: {
  title: string;
  layout?: "grid" | "stack" | "pair";
  children: React.ReactNode;
}) {
  const contentClass =
    layout === "stack"
      ? "space-y-3"
      : layout === "pair"
        ? "grid grid-cols-2 gap-3"
        : "grid grid-cols-1 md:grid-cols-3 gap-3";
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </h3>
      <div className={contentClass}>{children}</div>
    </section>
  );
}

function Field({
  label,
  full,
  required,
  className,
  children,
}: {
  label: string;
  full?: boolean;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const classes =
    [full ? "md:col-span-3" : "", className ?? ""].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={classes}>
      <Label className="mb-1 block text-xs">
        {label}
        {required && (
          <span className="text-slate-400 font-normal"> (Required)</span>
        )}
      </Label>
      {children}
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function SummationTable({
  ogSymbol,
  qty,
  unitPrice,
  taxAmount,
  taxMode,
  taxRaw,
  domPerUnit,
  intlPerUnit,
  perUnitTotalOg,
  perUnitTotalNaira,
  lineTotal,
  isNgn,
}: {
  ogSymbol: string;
  qty: number;
  unitPrice: number;
  taxAmount: number;
  taxMode: "amount" | "percent";
  taxRaw: number | null;
  domPerUnit: number;
  intlPerUnit: number;
  perUnitTotalOg: number;
  perUnitTotalNaira: number;
  lineTotal: number;
  isNgn: boolean;
}) {
  const taxNote =
    taxRaw !== null && taxMode === "percent"
      ? ` (${taxRaw}% of unit)`
      : "";
  return (
    <div className="flex h-full flex-col rounded-md border border-slate-200 bg-slate-50/60 p-2.5 text-[11px]">
      <Row label="Unit Price" value={unitPrice} symbol={ogSymbol} />
      <Row label={`+ Tax${taxNote}`} value={taxAmount} symbol={ogSymbol} muted={taxAmount === 0} />
      <Row
        label="+ Domestic Shipping"
        value={domPerUnit}
        symbol={ogSymbol}
        muted={domPerUnit === 0}
      />
      <Row
        label="+ Intl Shipping"
        value={intlPerUnit}
        symbol={ogSymbol}
        muted={intlPerUnit === 0}
      />
      <div className="my-1 border-t border-slate-200" />
      <Row label="Per-unit Total" value={perUnitTotalOg} symbol={ogSymbol} bold />
      {!isNgn && (
        <Row label="Per-unit (NGN)" value={perUnitTotalNaira} symbol="₦" bold />
      )}
      <Row label={`Quantity ×${qty}`} value={unitPrice * qty} symbol={ogSymbol} muted />
      <div className="my-1 border-t border-slate-200" />
      <div className="flex items-baseline justify-between">
        <span className="font-semibold text-slate-700">Item Total</span>
        <span className="font-semibold text-slate-800 tabular-nums">
          ₦{fmt(lineTotal)}
        </span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  symbol,
  bold,
  muted,
}: {
  label: string;
  value: number | null;
  symbol: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between leading-5 ${muted ? "text-slate-400" : "text-slate-600"}`}
    >
      <span className={bold ? "font-semibold" : ""}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""}`}>
        {value === null ? "" : `${symbol}${fmt(value)}`}
      </span>
    </div>
  );
}
