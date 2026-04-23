"use client";

import * as React from "react";
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
import { CURRENCIES, UNITS_OF_MEASURE } from "@/lib/constants";
import type { RateInfo } from "./details-view";

// Subset of RfqItem the details view actually renders. Defined here so we don't
// import the Prisma type into client components.
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
  ogBoxPrice: number | null;
  nairaUnitPrice: number | null;
  boxPrice: number | null;
  nairaOverridden: boolean;
  brand: string | null;
};

// All input values are held as strings so users can type freely (partial
// numbers, empty values, etc.). We coerce on save.
export type ItemDraft = {
  mProductCode: string;
  unitQuantity: string;
  uom: string;
  manufacturerName: string;
  vendor: string;
  vendorLocation: string;
  productLink: string;
  countryOfOrigin: string;
  vendorDeliveryTimeline: string;
  originalCurrency: string;
  ogUnitPrice: string;
  ogBoxPrice: string;
  nairaUnitPrice: string;
  boxPrice: string;
};

function toInputString(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function initialDraftFromItem(item: DetailsItemPayload): ItemDraft {
  return {
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
    ogBoxPrice: toInputString(item.ogBoxPrice),
    nairaUnitPrice: toInputString(item.nairaUnitPrice),
    boxPrice: toInputString(item.boxPrice),
  };
}

export function parseDraftNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function ItemDetailForm({
  item,
  draft,
  overridden,
  rate,
  onDraftChange,
  onOverriddenChange,
  onLoadRate,
}: {
  item: DetailsItemPayload;
  draft: ItemDraft;
  overridden: boolean;
  rate: RateInfo | undefined;
  onDraftChange: (patch: Partial<ItemDraft>) => void;
  onOverriddenChange: (value: boolean) => void;
  onLoadRate: (base: string, force?: boolean) => Promise<void> | void;
}) {
  // --- Currency / conversion handlers -------------------------------------------------

  function handleCurrencyChange(value: string) {
    const next: Partial<ItemDraft> = { originalCurrency: value };
    if (value && value !== "NGN") void onLoadRate(value);
    if (value === "NGN" && !overridden) {
      // Mirror og into naira directly when the source currency IS naira.
      const og = parseDraftNumber(draft.ogUnitPrice);
      const ogBox = parseDraftNumber(draft.ogBoxPrice);
      if (og !== null) next.nairaUnitPrice = String(og);
      if (ogBox !== null) next.boxPrice = String(ogBox);
    }
    onDraftChange(next);
  }

  // When the rate arrives or changes, recompute naira fields if not overridden.
  // Pure draft mutation — no network call.
  React.useEffect(() => {
    if (overridden) return;
    if (!rate || rate.error) return;
    if (!draft.originalCurrency || draft.originalCurrency === "NGN") return;

    const og = parseDraftNumber(draft.ogUnitPrice);
    const ogBox = parseDraftNumber(draft.ogBoxPrice);
    const patch: Partial<ItemDraft> = {};
    let touched = false;

    if (og !== null) {
      const computed = +(og * rate.rate).toFixed(2);
      if (String(computed) !== draft.nairaUnitPrice) {
        patch.nairaUnitPrice = String(computed);
        touched = true;
      }
    }
    if (ogBox !== null) {
      const computed = +(ogBox * rate.rate).toFixed(2);
      if (String(computed) !== draft.boxPrice) {
        patch.boxPrice = String(computed);
        touched = true;
      }
    }
    if (touched) onDraftChange(patch);
    // Intentionally depend only on the rate/override flag — re-running on every
    // keystroke would fight the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate, overridden]);

  function handleOgPriceBlur(field: "ogUnitPrice" | "ogBoxPrice") {
    const value = parseDraftNumber(draft[field]);
    if (overridden || !rate || rate.error || !draft.originalCurrency) return;
    if (value === null) return;
    const multiplier = draft.originalCurrency === "NGN" ? 1 : rate.rate;
    const computed = +(value * multiplier).toFixed(2);
    if (field === "ogUnitPrice") {
      onDraftChange({ nairaUnitPrice: String(computed) });
    } else {
      onDraftChange({ boxPrice: String(computed) });
    }
  }

  function handleNairaEdit(field: "nairaUnitPrice" | "boxPrice", value: string) {
    onDraftChange({ [field]: value });
    if (!overridden) onOverriddenChange(true);
  }

  return (
    <div className="space-y-5">
      {/* Split row: product + quantity (left) | vendor (right), with a casual
          vertical divider between the two halves on md+ screens. */}
      <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-slate-200/80">
        {/* LEFT HALF */}
        <div className="md:pr-5 space-y-5">
          <Section title="Product identification" layout="stack">
            <Field label="Manufacturer">
              <Input
                className="h-8 text-xs"
                value={draft.manufacturerName}
                onChange={(e) =>
                  onDraftChange({ manufacturerName: e.target.value })
                }
              />
            </Field>
            <Field label="Manufacturer Product Code" required>
              <Input
                className="h-8 text-xs"
                value={draft.mProductCode}
                onChange={(e) =>
                  onDraftChange({ mProductCode: e.target.value })
                }
              />
            </Field>
            <Field label="Country of Origin">
              <Input
                className="h-8 text-xs"
                value={draft.countryOfOrigin}
                onChange={(e) =>
                  onDraftChange({ countryOfOrigin: e.target.value })
                }
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
                onChange={(e) =>
                  onDraftChange({ unitQuantity: e.target.value })
                }
              />
            </Field>
            <Field label="Unit of Measure" required>
              <Select
                value={draft.uom}
                onValueChange={(v) => onDraftChange({ uom: v })}
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
                onChange={(e) => onDraftChange({ vendor: e.target.value })}
              />
            </Field>
            <Field label="Vendor Location">
              <Input
                className="h-8 text-xs"
                value={draft.vendorLocation}
                onChange={(e) =>
                  onDraftChange({ vendorLocation: e.target.value })
                }
              />
            </Field>
            <Field label="Product Link">
              <Input
                type="url"
                placeholder="https://"
                className="h-8 text-xs"
                value={draft.productLink}
                onChange={(e) => onDraftChange({ productLink: e.target.value })}
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
                  onDraftChange({ vendorDeliveryTimeline: e.target.value })
                }
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Section: pricing */}
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
            onChange={(e) => onDraftChange({ ogUnitPrice: e.target.value })}
            onBlur={() => handleOgPriceBlur("ogUnitPrice")}
          />
        </Field>
        <Field label="Original Box Price">
          <Input
            type="number"
            min="0"
            step="0.01"
            className="h-8 text-xs"
            value={draft.ogBoxPrice}
            onChange={(e) => onDraftChange({ ogBoxPrice: e.target.value })}
            onBlur={() => handleOgPriceBlur("ogBoxPrice")}
          />
        </Field>
        <Field label="Naira Unit Price (₦)" required>
          <Input
            type="number"
            min="0"
            step="0.01"
            className="h-8 text-xs"
            value={draft.nairaUnitPrice}
            onChange={(e) => handleNairaEdit("nairaUnitPrice", e.target.value)}
          />
        </Field>
        <Field label="Box Price (₦)">
          <Input
            type="number"
            min="0"
            step="0.01"
            className="h-8 text-xs"
            value={draft.boxPrice}
            onChange={(e) => handleNairaEdit("boxPrice", e.target.value)}
          />
        </Field>

        <div className="flex items-end justify-end pr-10 pb-1">
          <ItemTotals
            requestQuantity={item.requestQuantity}
            nairaUnitPrice={draft.nairaUnitPrice}
            boxPrice={draft.boxPrice}
          />
        </div>

        {overridden && (
          <div className="md:col-span-3 flex items-center gap-2 text-[11px] text-amber-700">
            <span>
              Naira values are manually overridden — auto-conversion paused.
            </span>
            <button
              type="button"
              className="underline hover:no-underline"
              onClick={() => onOverriddenChange(false)}
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

function ItemTotals({
  requestQuantity,
  nairaUnitPrice,
  boxPrice,
}: {
  requestQuantity: number;
  nairaUnitPrice: string;
  boxPrice: string;
}) {
  const qty = requestQuantity;
  const total =
    qty > 0 && parseFloat(nairaUnitPrice) > 0
      ? qty * parseFloat(nairaUnitPrice)
      : qty > 0 && parseFloat(boxPrice) > 0
        ? qty * parseFloat(boxPrice)
        : null;

  if (total === null) return null;
  return (
    <span className="text-base text-slate-500">
      <span className="font-bold">Item Total:</span> ₦{fmt(total)}
    </span>
  );
}
