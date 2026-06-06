"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createPurchaseOrder } from "@/lib/actions";
import { quoteNumberFromRfq } from "@/lib/docs";
import { formatNaira } from "@/lib/export/types";

type RfqItemForPo = {
  id: string;
  itemName: string;
  itemCategory: string | null;
  department: string | null;
  requestQuantity: number;
  vendor: string | null;
  vendorLocation: string | null;
  brand: string | null;
  mProductCode: string | null;
  manufacturerName: string | null;
  uom: string | null;
  countryOfOrigin: string | null;
  vendorDeliveryTimeline: string | null;
  nairaUnitPrice: number | null;
  tax: number | null;
  taxMode: string | null;
  domesticShippingNaira: number | null;
  intlShippingNaira: number | null;
};

function computeTotalPerUnit(item: RfqItemForPo): number {
  const unitPrice = item.nairaUnitPrice ?? 0;
  const taxAmt =
    item.tax == null
      ? 0
      : item.taxMode === "percent"
        ? unitPrice * (item.tax / 100)
        : item.tax;
  const qty = item.requestQuantity || 1;
  const domPerUnit =
    item.domesticShippingNaira != null
      ? item.domesticShippingNaira / qty
      : 0;
  const intlPerUnit =
    item.intlShippingNaira != null ? item.intlShippingNaira / qty : 0;
  return unitPrice + taxAmt + domPerUnit + intlPerUnit;
}

function CheckIcon() {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function PoCreationView({
  rfq,
  items,
}: {
  rfq: { id: string; rfqNumber: string; requester: string };
  items: RfqItemForPo[];
}) {
  const router = useRouter();
  const quoteNumber = quoteNumberFromRfq(rfq.rfqNumber);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [quantities, setQuantities] = React.useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        items.map((it) => [it.id, String(it.requestQuantity)]),
      ),
  );
  const [markup, setMarkup] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const markupFactor = 1 + (parseFloat(markup) || 0) / 100;

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getQty(id: string): number {
    return parseFloat(quantities[id]) || 0;
  }

  const grandTotal = items
    .filter((it) => selected.has(it.id))
    .reduce((sum, it) => {
      const totalPerUnit = computeTotalPerUnit(it);
      return sum + totalPerUnit * getQty(it.id) * markupFactor;
    }, 0);

  async function handleCreate() {
    if (selected.size === 0) {
      toast.error("Select at least one item");
      return;
    }
    const qtyOverrides: Record<string, number> = {};
    for (const id of selected) {
      const q = getQty(id);
      if (q <= 0) {
        toast.error("All selected items must have a quantity > 0");
        return;
      }
      const item = items.find((it) => it.id === id);
      if (item && q !== item.requestQuantity) {
        qtyOverrides[id] = q;
      }
    }

    setSubmitting(true);
    try {
      const result = await createPurchaseOrder({
        rfqId: rfq.id,
        selectedItemIds: Array.from(selected),
        markupFactor,
        quantityOverrides:
          Object.keys(qtyOverrides).length > 0 ? qtyOverrides : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(`Purchase order ${result.poNumber} created`);
      router.push(`/po/${result.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create purchase order",
      );
      setSubmitting(false);
    }
  }

  // Group items by vendor for visual clarity
  const byVendor = React.useMemo(() => {
    const groups = new Map<string, RfqItemForPo[]>();
    for (const item of items) {
      const vendor = item.vendor || "Unassigned";
      const list = groups.get(vendor) ?? [];
      list.push(item);
      groups.set(vendor, list);
    }
    return Array.from(groups.entries());
  }, [items]);

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 h-8 px-3 text-sm font-medium text-slate-700 rounded-md active:bg-slate-200 active:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Home
        </Link>
        <h2 className="text-lg font-semibold text-slate-800 tracking-tight">
          Create Purchase Order
        </h2>
      </div>

      {/* Source quote info */}
      <div className="bg-slate-50 border border-slate-200 rounded-md px-5 py-3 mb-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Based on Quote
            </span>
            <div className="font-mono text-slate-800">{quoteNumber}</div>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Requester
            </span>
            <div className="text-slate-800">{rfq.requester}</div>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Items in Quote
            </span>
            <div className="text-slate-800">{items.length}</div>
          </div>
        </div>
      </div>

      {/* Markup + selection count */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-4">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="poMarkup"
            className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
            style={{ color: "#274579" }}
          >
            Global Markup
          </Label>
          <div className="relative flex items-center">
            <Input
              id="poMarkup"
              type="number"
              min="0"
              max="999"
              step="0.1"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              placeholder="0"
              className="h-8 w-20 text-xs text-right pr-6 bg-slate-100 border border-slate-300"
            />
            <span className="absolute right-2 text-xs text-slate-400 pointer-events-none">
              %
            </span>
          </div>
        </div>
        <span className="text-xs text-slate-400 tabular-nums">
          {selected.size} of {items.length} item
          {items.length !== 1 ? "s" : ""} selected
        </span>
      </div>

      {/* Items grouped by vendor */}
      <div className="space-y-4 mb-6">
        {byVendor.map(([vendor, vendorItems]) => (
          <div
            key={vendor}
            className="border border-slate-200 rounded-md overflow-hidden"
          >
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                {vendor}
              </span>
            </div>
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-white border-b border-slate-100">
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    Item Name
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    UOM
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">
                    Quoted Qty
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500 w-28">
                    PO Qty
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">
                    Unit Price
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">
                    Line Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendorItems.map((item) => {
                  const checked = selected.has(item.id);
                  const totalPerUnit = computeTotalPerUnit(item);
                  const lineTotal =
                    totalPerUnit * getQty(item.id) * markupFactor;
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-slate-50 last:border-0 transition-all ${
                        checked
                          ? "hover:bg-slate-50"
                          : "opacity-50 hover:opacity-70"
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          className={`w-3.5 h-3.5 rounded border mx-auto flex items-center justify-center transition-colors ${
                            checked
                              ? "bg-[#274579] border-[#274579]"
                              : "bg-white border-slate-300 hover:border-slate-400"
                          }`}
                        >
                          {checked && <CheckIcon />}
                        </button>
                      </td>
                      <td
                        className="px-3 py-2.5 font-medium text-slate-800 cursor-pointer"
                        onClick={() => toggleItem(item.id)}
                      >
                        {item.itemName}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {item.uom ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">
                        {item.requestQuantity}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Input
                          type="number"
                          min="0.01"
                          step="1"
                          value={quantities[item.id] ?? ""}
                          onChange={(e) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          disabled={!checked}
                          className="h-7 w-20 text-xs text-right ml-auto bg-white border-slate-300 disabled:opacity-40"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                        {formatNaira(
                          (item.nairaUnitPrice ?? 0) * markupFactor,
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-slate-800 tabular-nums">
                        {checked ? formatNaira(lineTotal) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="mb-6">
        <Label
          htmlFor="poNotes"
          className="text-xs font-semibold uppercase tracking-wide mb-1.5 block"
          style={{ color: "#274579" }}
        >
          Notes
        </Label>
        <Textarea
          id="poNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Delivery instructions, payment terms, or other notes..."
          className="text-sm min-h-[80px] bg-slate-50 border-slate-300"
        />
      </div>

      {/* Footer: grand total + create button */}
      <div className="flex flex-wrap items-center justify-between gap-y-3 border-t border-slate-200 pt-4">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Grand Total
          </span>
          <div className="text-lg font-semibold text-slate-800">
            {selected.size > 0 ? formatNaira(grandTotal) : "—"}
          </div>
        </div>
        <Button
          onClick={handleCreate}
          disabled={submitting || selected.size === 0}
          style={{ backgroundColor: "#274579" }}
          className="text-white hover:opacity-90 px-6"
        >
          {submitting ? "Creating..." : "Create Purchase Order"}
        </Button>
      </div>
    </div>
  );
}
