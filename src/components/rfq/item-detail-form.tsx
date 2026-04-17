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
import { CURRENCIES, UNITS_OF_MEASURE } from "@/lib/constants";
import { updateRfqItem } from "@/lib/actions";
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
};

type FieldKey = Exclude<keyof DetailsItemPayload, "id" | "itemCategory" | "department" | "itemName" | "requestQuantity">;

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
  // Local string state for every input so users can type freely; we cast on save.
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
    ogBoxPrice: toInputString(item.ogBoxPrice),
    nairaUnitPrice: toInputString(item.nairaUnitPrice),
    boxPrice: toInputString(item.boxPrice),
  });
  const [overridden, setOverridden] = React.useState(item.nairaOverridden);

  function setField<K extends keyof typeof draft>(key: K, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  // Persist a patch to the server and mirror it in the parent's local items array
  // so the progress indicator + rate strip stay in sync without a server roundtrip.
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
      // Mirror og into naira directly when the source currency IS naira.
      const og = parseNumber(draft.ogUnitPrice);
      const ogBox = parseNumber(draft.ogBoxPrice);
      const next: Partial<DetailsItemPayload> = { originalCurrency: "NGN" };
      if (!overridden) {
        if (og !== null) {
          next.nairaUnitPrice = og;
          setField("nairaUnitPrice", String(og));
        }
        if (ogBox !== null) {
          next.boxPrice = ogBox;
          setField("boxPrice", String(ogBox));
        }
      }
      await persist(next);
    } else {
      await persist({ originalCurrency: value });
    }
  }

  // When the rate arrives or changes, recompute naira fields if not overridden.
  React.useEffect(() => {
    if (overridden) return;
    if (!rate || rate.error) return;
    if (!draft.originalCurrency || draft.originalCurrency === "NGN") return;

    const og = parseNumber(draft.ogUnitPrice);
    const ogBox = parseNumber(draft.ogBoxPrice);
    const patch: Partial<DetailsItemPayload> = {};
    let touched = false;

    if (og !== null) {
      const computed = +(og * rate.rate).toFixed(2);
      if (String(computed) !== draft.nairaUnitPrice) {
        setField("nairaUnitPrice", String(computed));
        patch.nairaUnitPrice = computed;
        touched = true;
      }
    }
    if (ogBox !== null) {
      const computed = +(ogBox * rate.rate).toFixed(2);
      if (String(computed) !== draft.boxPrice) {
        setField("boxPrice", String(computed));
        patch.boxPrice = computed;
        touched = true;
      }
    }
    if (touched) void persist(patch);
    // We intentionally don't depend on draft.* string state — only on the rate
    // and override flag — so this only fires on those changes, not every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate, overridden]);

  function handleOgPriceBlur(field: "ogUnitPrice" | "ogBoxPrice") {
    const value = parseNumber(draft[field]);
    const patch: Partial<DetailsItemPayload> = { [field]: value };

    if (!overridden && rate && !rate.error && draft.originalCurrency) {
      const multiplier =
        draft.originalCurrency === "NGN" ? 1 : rate.rate;
      if (value !== null) {
        const computed = +(value * multiplier).toFixed(2);
        if (field === "ogUnitPrice") {
          setField("nairaUnitPrice", String(computed));
          patch.nairaUnitPrice = computed;
        } else {
          setField("boxPrice", String(computed));
          patch.boxPrice = computed;
        }
      }
    }
    void persist(patch);
  }

  function handleNairaBlur(field: "nairaUnitPrice" | "boxPrice") {
    const value = parseNumber(draft[field]);
    setOverridden(true);
    void persist({ [field]: value, nairaOverridden: true });
  }

  // --- Generic save-on-blur for non-pricing fields ------------------------------------

  function blurString(field: FieldKey, raw: string) {
    void persist({ [field]: raw.trim() === "" ? null : raw } as Partial<DetailsItemPayload>);
  }
  function blurNumber(field: FieldKey, raw: string) {
    void persist({ [field]: parseNumber(raw) } as Partial<DetailsItemPayload>);
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
                onChange={(e) => setField("manufacturerName", e.target.value)}
                onBlur={(e) => blurString("manufacturerName", e.target.value)}
              />
            </Field>
            <Field label="Manufacturer Product Code" required>
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
            onChange={(e) => setField("ogUnitPrice", e.target.value)}
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
            onChange={(e) => setField("ogBoxPrice", e.target.value)}
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
            onChange={(e) => setField("nairaUnitPrice", e.target.value)}
            onBlur={() => handleNairaBlur("nairaUnitPrice")}
          />
        </Field>
        <Field label="Box Price (₦)">
          <Input
            type="number"
            min="0"
            step="0.01"
            className="h-8 text-xs"
            value={draft.boxPrice}
            onChange={(e) => setField("boxPrice", e.target.value)}
            onBlur={() => handleNairaBlur("boxPrice")}
          />
        </Field>

        <div className="flex items-end justify-end">
          <ItemTotals
            unitQuantity={draft.unitQuantity}
            nairaUnitPrice={draft.nairaUnitPrice}
            boxPrice={draft.boxPrice}
          />
        </div>

        {overridden && (
          <div className="md:col-span-3 flex items-center gap-2 text-[11px] text-amber-700">
            <span>Naira values are manually overridden — auto-conversion paused.</span>
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
        {rate?.error && draft.originalCurrency && draft.originalCurrency !== "NGN" && (
          <div className="md:col-span-3 text-[11px] text-amber-700">
            Couldn&apos;t fetch the {draft.originalCurrency}→NGN rate. Enter naira values manually.
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
  return n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ItemTotals({
  unitQuantity,
  nairaUnitPrice,
  boxPrice,
}: {
  unitQuantity: string;
  nairaUnitPrice: string;
  boxPrice: string;
}) {
  const qty = parseFloat(unitQuantity);
  const total =
    qty > 0 && parseFloat(nairaUnitPrice) > 0
      ? qty * parseFloat(nairaUnitPrice)
      : qty > 0 && parseFloat(boxPrice) > 0
        ? qty * parseFloat(boxPrice)
        : null;

  if (total === null) return null;
  return (
    <span className="text-xs text-slate-600">
      Item Total: ₦{fmt(total)}
    </span>
  );
}
