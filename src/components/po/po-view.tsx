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
import {
  issuePo,
  closePo,
  deleteDraftPo,
  updatePoItemQuantity,
  updatePoNotes,
} from "@/lib/actions";
import { formatNaira } from "@/lib/export/types";

type PoItemData = {
  id: string;
  rfqItemId: string;
  itemName: string;
  itemCategory: string;
  department: string;
  vendor: string;
  vendorLocation: string | null;
  brand: string | null;
  mProductCode: string | null;
  manufacturerName: string | null;
  uom: string | null;
  countryOfOrigin: string | null;
  vendorDeliveryTimeline: string | null;
  quantity: number;
  nairaUnitPrice: number;
  taxAmount: number | null;
  domesticShippingNaira: number | null;
  intlShippingNaira: number | null;
  totalPerUnit: number;
  lineTotal: number;
};

type PoData = {
  id: string;
  poNumber: string;
  rfqId: string;
  status: string;
  notes: string | null;
  markupFactor: number;
  createdAt: string;
  items: PoItemData[];
  rfq: { rfqNumber: string; requester: string };
};

function CopyIcon() {
  return (
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
  );
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-[#274579]/10 text-[#274579]",
  issued: "bg-[#274579]/10 text-[#274579]",
  closed: "bg-[#274579]/10 text-[#274579]",
};

export function PoView({ po }: { po: PoData }) {
  const router = useRouter();
  const isDraft = po.status === "draft";
  const isIssued = po.status === "issued";
  const quoteNumber = po.rfq.rfqNumber.replace("RFQ-", "QU-");

  const [quantities, setQuantities] = React.useState<Record<string, string>>(
    () =>
      Object.fromEntries(po.items.map((it) => [it.id, String(it.quantity)])),
  );
  const [notes, setNotes] = React.useState(po.notes ?? "");
  const [acting, setActing] = React.useState(false);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function getQty(id: string): number {
    return parseFloat(quantities[id]) || 0;
  }

  const grandTotal = po.items.reduce((sum, it) => {
    const qty = isDraft ? getQty(it.id) : it.quantity;
    return sum + it.totalPerUnit * qty * po.markupFactor;
  }, 0);

  function handleQtyChange(itemId: string, value: string) {
    setQuantities((prev) => ({ ...prev, [itemId]: value }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const qty = parseFloat(value);
      if (!qty || qty <= 0) return;
      try {
        await updatePoItemQuantity(itemId, qty);
      } catch {
        toast.error("Failed to save quantity");
      }
    }, 600);
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await updatePoNotes(po.id, value);
      } catch {
        toast.error("Failed to save notes");
      }
    }, 600);
  }

  async function handleIssue() {
    setActing(true);
    try {
      await issuePo(po.id);
      toast.success("Purchase order issued");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to issue PO",
      );
    }
    setActing(false);
  }

  async function handleClose() {
    setActing(true);
    try {
      await closePo(po.id);
      toast.success("Purchase order closed");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to close PO",
      );
    }
    setActing(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this draft purchase order?")) return;
    setActing(true);
    try {
      await deleteDraftPo(po.id);
      toast.success("Draft purchase order deleted");
      router.push("/");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete PO",
      );
    }
    setActing(false);
  }

  async function copyPoNumber() {
    try {
      await navigator.clipboard.writeText(po.poNumber);
      toast.success("PO number copied");
    } catch {
      toast.error("Could not copy PO number");
    }
  }

  // Group items by vendor
  const byVendor = React.useMemo(() => {
    const groups = new Map<string, PoItemData[]>();
    for (const item of po.items) {
      const vendor = item.vendor || "Unassigned";
      const list = groups.get(vendor) ?? [];
      list.push(item);
      groups.set(vendor, list);
    }
    return Array.from(groups.entries());
  }, [po.items]);

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 h-8 px-3 text-sm font-medium text-slate-700 rounded-md hover:bg-[#274579]/10 hover:text-[#274579] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Home
        </Link>
        <h2 className="text-lg font-semibold text-slate-800 tracking-tight">
          Purchase Order
        </h2>
        <button
          type="button"
          onClick={copyPoNumber}
          title="Copy PO number"
          className="group inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors"
        >
          <span>#{po.poNumber}</span>
          <CopyIcon />
        </button>
        <span
          className={`px-1.5 py-px text-[10px] font-medium rounded uppercase tracking-wide ${STATUS_STYLES[po.status] ?? STATUS_STYLES.draft}`}
        >
          {po.status}
        </span>
      </div>

      {/* Metadata row */}
      <div className="bg-slate-50 border border-slate-200 rounded-md px-5 py-3 mb-6">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Source Quote
            </span>
            <div className="font-mono text-slate-800">
              <Link
                href={`/rfq/${po.rfqId}/quote`}
                className="hover:text-[#274579] transition-colors"
              >
                {quoteNumber}
              </Link>
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Requester
            </span>
            <div className="text-slate-800">{po.rfq.requester}</div>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Created
            </span>
            <div className="text-slate-800">
              {new Date(po.createdAt).toLocaleDateString()}
            </div>
          </div>
          {po.markupFactor !== 1 && (
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Markup
              </span>
              <div className="text-slate-800">
                {((po.markupFactor - 1) * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Items table grouped by vendor */}
      <div className="mb-3 pl-1">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Order Lines
        </h3>
      </div>

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
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    Item Name
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">
                    UOM
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500 w-28">
                    Quantity
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
                  const qty = isDraft ? getQty(item.id) : item.quantity;
                  const lineTotal =
                    item.totalPerUnit * qty * po.markupFactor;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="px-3 py-2.5 font-medium text-slate-800">
                        {item.itemName}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {item.uom ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {isDraft ? (
                          <Input
                            type="number"
                            min="0.01"
                            step="1"
                            value={quantities[item.id] ?? ""}
                            onChange={(e) =>
                              handleQtyChange(item.id, e.target.value)
                            }
                            className="h-7 w-20 text-xs text-right ml-auto bg-white border-slate-300"
                          />
                        ) : (
                          <span className="tabular-nums">{item.quantity}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                        {formatNaira(item.nairaUnitPrice * po.markupFactor)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-slate-800 tabular-nums">
                        {formatNaira(lineTotal)}
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
        {isDraft ? (
          <Textarea
            id="poNotes"
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Delivery instructions, payment terms, or other notes..."
            className="text-sm min-h-[80px] bg-slate-50 border-slate-300"
          />
        ) : (
          <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-4 py-3 min-h-[60px]">
            {po.notes || (
              <span className="text-slate-400 italic">No notes</span>
            )}
          </div>
        )}
      </div>

      {/* Footer: grand total + actions */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Grand Total
          </span>
          <div className="text-lg font-semibold text-slate-800">
            {formatNaira(grandTotal)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isDraft && (
            <>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={acting}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                Delete Draft
              </Button>
              <Button
                onClick={handleIssue}
                disabled={acting}
                style={{ backgroundColor: "#274579" }}
                className="text-white hover:opacity-90 px-6"
              >
                {acting ? "Issuing..." : "Issue Purchase Order"}
              </Button>
            </>
          )}
          {isIssued && (
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={acting}
              className="text-slate-600"
            >
              {acting ? "Closing..." : "Close PO"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
