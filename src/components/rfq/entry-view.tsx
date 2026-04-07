"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { CATEGORIES, DEPARTMENTS, categoryLabel, departmentLabel } from "@/lib/constants";
import { finalizeDraftRfq } from "@/lib/actions";
import type { EntryItem } from "@/lib/schemas";

type DraftItem = EntryItem & { tempId: string };

const emptyForm: EntryItem = {
  itemCategory: "",
  department: "",
  itemName: "",
  itemDescription: "",
  requestQuantity: 0,
  size: "",
  specification: "",
  brand: "",
  model: "",
  additionalNotes: "",
};

type EntryViewProps = {
  draftId: string;
  rfqNumber: string;
};

export function EntryView({ draftId, rfqNumber }: EntryViewProps) {
  const router = useRouter();
  const [requester, setRequester] = React.useState("");
  const [items, setItems] = React.useState<DraftItem[]>([]);
  const [form, setForm] = React.useState<EntryItem>(emptyForm);
  const [quantityRaw, setQuantityRaw] = React.useState("");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function patchForm<K extends keyof EntryItem>(key: K, value: EntryItem[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function clearForm() {
    setForm(emptyForm);
    setQuantityRaw("");
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(quantityRaw);
    if (
      !form.itemName ||
      !form.itemCategory ||
      !form.department ||
      !qty ||
      qty <= 0
    ) {
      toast.error("Please fill in Item Name, Category, Department, and Quantity.");
      return;
    }
    const item: DraftItem = {
      ...form,
      requestQuantity: qty,
      tempId: crypto.randomUUID(),
    };
    setItems((prev) => [...prev, item]);
    clearForm();
    toast.success("Item added");
  }

  function handleDelete(tempId: string) {
    if (!confirm("Delete this item from the RFQ?")) return;
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
  }

  function clearAllItems() {
    if (items.length === 0) return;
    if (!confirm("Clear ALL items from this RFQ? This cannot be undone.")) return;
    setItems([]);
  }

  async function handleProceed() {
    if (!requester.trim()) {
      toast.error("Please enter a requester name before proceeding.");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one item before proceeding.");
      return;
    }
    setSubmitting(true);
    try {
      const { id } = await finalizeDraftRfq(draftId, {
        requester: requester.trim(),
        items: items.map((it) => {
          const { tempId, ...rest } = it;
          void tempId;
          return rest;
        }),
      });
      router.push(`/rfq/${id}/details`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create RFQ. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-semibold text-slate-800 tracking-tight">
              New Request for Quote
            </h2>
            <span className="px-2.5 py-1 text-xs font-medium bg-slate-200 text-slate-600 rounded uppercase tracking-wide">
              Draft
            </span>
          </div>
          <p className="text-slate-600 mt-1">#{rfqNumber}</p>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="RFQ options"
            onClick={() => setMenuOpen((o) => !o)}
            className="w-11 h-11 flex items-center justify-center rounded hover:bg-slate-200 text-slate-900 text-4xl leading-none font-black"
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-10 py-1">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  clearAllItems();
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Clear all items
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Requester input — belongs to the RFQ as a whole, not per-item */}
      <div className="bg-white rounded-md shadow-xl p-6 border border-slate-100 mb-8">
        <Label htmlFor="requester" className="mb-2 block">
          Requester *
        </Label>
        <Input
          id="requester"
          value={requester}
          onChange={(e) => setRequester(e.target.value)}
          placeholder="Name of the client who sent this request"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form */}
        <div className="lg:col-span-7 bg-white rounded-md shadow-xl p-8 border border-slate-100">
          <form onSubmit={handleAdd} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label className="mb-2 block">Item Category *</Label>
                <Select
                  value={form.itemCategory}
                  onValueChange={(v) => patchForm("itemCategory", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Department *</Label>
                <Select
                  value={form.department}
                  onValueChange={(v) => patchForm("department", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Request Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantityRaw}
                  onChange={(e) => setQuantityRaw(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Item Name *</Label>
              <Input
                value={form.itemName}
                onChange={(e) => patchForm("itemName", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label className="mb-2 block">Brand</Label>
                <Input
                  value={form.brand ?? ""}
                  onChange={(e) => patchForm("brand", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-2 block">Model</Label>
                <Input
                  value={form.model ?? ""}
                  onChange={(e) => patchForm("model", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-2 block">Size</Label>
                <Input
                  value={form.size ?? ""}
                  onChange={(e) => patchForm("size", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Specification</Label>
              <Textarea
                rows={3}
                value={form.specification ?? ""}
                onChange={(e) => patchForm("specification", e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-2 block">Item Description</Label>
              <Textarea
                rows={3}
                value={form.itemDescription ?? ""}
                onChange={(e) => patchForm("itemDescription", e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-2 block">Additional Notes</Label>
              <Textarea
                rows={2}
                value={form.additionalNotes ?? ""}
                onChange={(e) => patchForm("additionalNotes", e.target.value)}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                size="lg"
                style={{ backgroundColor: "#276e79" }}
                className="flex-1 hover:opacity-90 text-white text-base py-5 h-auto"
              >
                Add Item
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={clearForm}
                className="px-10"
              >
                Clear Form
              </Button>
            </div>
          </form>
        </div>

        {/* Added items panel */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-md shadow-xl border border-slate-100 h-full flex flex-col">
            <div className="px-8 pt-8 pb-4 flex items-center justify-between">
              <h3 className="font-semibold text-xl text-slate-800">Added</h3>
              <span className="text-sm text-slate-400">{items.length} Items</span>
            </div>

            <div className="flex-1 p-8 overflow-auto">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                  <p className="text-xl font-medium">No items added yet</p>
                  <p className="mt-2">Add Item to RFQ</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.tempId}
                      className="bg-slate-50 border border-slate-200 rounded p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="font-semibold text-lg">{item.itemName}</div>
                            <span className="px-3 py-px text-xs font-medium bg-teal-100 text-teal-700 rounded uppercase">
                              {categoryLabel(item.itemCategory)}
                            </span>
                          </div>
                          <p className="text-slate-500 text-sm mt-1">
                            {departmentLabel(item.department)} • Qty:{" "}
                            {item.requestQuantity}
                            {item.size ? ` • ${item.size}` : ""}
                          </p>
                          {item.brand && (
                            <p className="text-sm text-slate-600 mt-2">
                              {item.brand}
                              {item.model ? ` • Model ${item.model}` : ""}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.tempId)}
                          className="text-red-400 hover:text-red-600"
                          aria-label="Delete item"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      {item.itemDescription && (
                        <p className="text-slate-600 text-sm mt-3 line-clamp-2">
                          {item.itemDescription}
                        </p>
                      )}
                      {item.additionalNotes && (
                        <div className="mt-4 text-xs bg-white px-3 py-2 rounded border border-slate-100 text-slate-500 italic">
                          {item.additionalNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="px-8 pb-8 pt-4">
                <Button
                  type="button"
                  size="lg"
                  onClick={handleProceed}
                  disabled={submitting}
                  style={{ backgroundColor: "#274579" }}
                  className="w-full hover:opacity-90 text-white text-base py-5 h-auto"
                >
                  {submitting ? "Creating RFQ…" : "Proceed with RFQ"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
