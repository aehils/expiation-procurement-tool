"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
    if (!confirm("Remove this item from the RFQ?")) return;
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
  }

  function handleEdit(tempId: string) {
    const target = items.find((it) => it.tempId === tempId);
    if (!target) return;
    const { tempId: _omit, ...rest } = target;
    void _omit;
    setForm(rest);
    setQuantityRaw(
      target.requestQuantity ? String(target.requestQuantity) : "",
    );
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
    <div className="max-w-7xl mx-auto px-4 py-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-800 tracking-tight">
              New Request for Quote
            </h2>
            <span className="px-1.5 py-px text-[10px] font-medium bg-slate-200 text-slate-600 rounded uppercase tracking-wide">
              Draft
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">#{rfqNumber}</p>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="RFQ options"
            onClick={() => setMenuOpen((o) => !o)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-200 text-slate-900 text-xl leading-none font-black"
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-md shadow-lg z-10 py-1">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  clearAllItems();
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                Clear all items
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left column: Requester + Form */}
        <div className="lg:col-span-7 space-y-4">
          {/* Requester input — belongs to the RFQ as a whole, not per-item */}
          <div className="bg-white rounded-md shadow-xl px-4 py-3 border border-slate-100">
            <Label htmlFor="requester" className="mb-1 block text-xs">
              Requester *
            </Label>
            <Input
              id="requester"
              value={requester}
              onChange={(e) => setRequester(e.target.value)}
              placeholder="Name of the client who sent this request"
              className="h-8 text-xs"
            />
          </div>

          {/* Form */}
          <div className="bg-white rounded-md shadow-xl p-4 border border-slate-100">
            <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Item Category *</Label>
                <Select
                  value={form.itemCategory}
                  onValueChange={(v) => patchForm("itemCategory", v)}
                >
                  <SelectTrigger className="h-8 text-xs">
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
                <Label className="mb-1 block text-xs">Department *</Label>
                <Select
                  value={form.department}
                  onValueChange={(v) => patchForm("department", v)}
                >
                  <SelectTrigger className="h-8 text-xs">
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
                <Label className="mb-1 block text-xs">Request Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantityRaw}
                  onChange={(e) => setQuantityRaw(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Item Name *</Label>
              <Input
                value={form.itemName}
                onChange={(e) => patchForm("itemName", e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Brand</Label>
                <Input
                  value={form.brand ?? ""}
                  onChange={(e) => patchForm("brand", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Model</Label>
                <Input
                  value={form.model ?? ""}
                  onChange={(e) => patchForm("model", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Size</Label>
                <Input
                  value={form.size ?? ""}
                  onChange={(e) => patchForm("size", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1 block text-xs">Specification</Label>
              <Textarea
                rows={2}
                value={form.specification ?? ""}
                onChange={(e) => patchForm("specification", e.target.value)}
                className="text-xs py-1.5"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs">Item Description</Label>
              <Textarea
                rows={2}
                value={form.itemDescription ?? ""}
                onChange={(e) => patchForm("itemDescription", e.target.value)}
                className="text-xs py-1.5"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs">Additional Notes</Label>
              <Textarea
                rows={2}
                value={form.additionalNotes ?? ""}
                onChange={(e) => patchForm("additionalNotes", e.target.value)}
                className="text-xs py-1.5"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                style={{ backgroundColor: "#276e79" }}
                className="flex-1 hover:opacity-90 text-white"
              >
                Add Item
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearForm}
                className="px-6"
              >
                Clear Form
              </Button>
            </div>
          </form>
          </div>
        </div>

        {/* Added items panel */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-md shadow-xl border border-slate-100 h-full flex flex-col">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-800">Added</h3>
              <span className="text-xs text-slate-400">{items.length} Items</span>
            </div>

            <div className="flex-1 px-4 pb-3 overflow-auto">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                  <p className="text-sm font-medium">No items added yet</p>
                  <p className="mt-0.5 text-xs">Add Item to RFQ</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.tempId}
                      className="bg-slate-50 border border-slate-200 rounded p-2.5 hover:shadow-md transition-shadow"
                    >
                      <div className="font-semibold text-xs text-slate-800 break-words">
                        {item.itemName}
                      </div>
                      <div className="mt-0.5">
                        <span className="inline-block px-1.5 py-px text-[10px] font-medium bg-teal-100 text-teal-700 rounded uppercase tracking-wide">
                          {categoryLabel(item.itemCategory)}
                        </span>
                      </div>
                      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                        <div>
                          <dt className="text-slate-400">Department</dt>
                          <dd className="text-slate-700">
                            {departmentLabel(item.department)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Quantity</dt>
                          <dd className="text-slate-700">
                            {item.requestQuantity}
                          </dd>
                        </div>
                        {item.size && (
                          <div>
                            <dt className="text-slate-400">Size</dt>
                            <dd className="text-slate-700">{item.size}</dd>
                          </div>
                        )}
                        {item.brand && (
                          <div>
                            <dt className="text-slate-400">Brand</dt>
                            <dd className="text-slate-700">{item.brand}</dd>
                          </div>
                        )}
                        {item.model && (
                          <div>
                            <dt className="text-slate-400">Model</dt>
                            <dd className="text-slate-700">{item.model}</dd>
                          </div>
                        )}
                        {item.specification && (
                          <div className="col-span-2">
                            <dt className="text-slate-400">Spec</dt>
                            <dd className="text-slate-700 line-clamp-1">
                              {item.specification}
                            </dd>
                          </div>
                        )}
                      </dl>
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleEdit(item.tempId)}
                          className="text-xs text-slate-500 hover:text-slate-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.tempId)}
                          className="text-xs text-slate-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="px-4 pb-4 pt-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleProceed}
                  disabled={submitting}
                  style={{ backgroundColor: "#274579" }}
                  className="w-full hover:opacity-90 text-white"
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
