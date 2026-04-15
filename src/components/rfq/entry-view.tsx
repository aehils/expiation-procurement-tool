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
import { finalizeDraftRfq, updateRfqEntryData } from "@/lib/actions";
import type { EntryItem } from "@/lib/schemas";

// `id` is only present on items already persisted to the DB (edit mode). New
// items added during this session carry `tempId` only, and get created on save.
type DraftItem = EntryItem & { tempId: string; id?: string };

export type InitialEntryItem = EntryItem & { id: string };

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
  // When present, the view operates in edit mode: it pre-fills requester and
  // items, and "Proceed" updates the existing RFQ instead of creating one.
  initialRequester?: string;
  initialItems?: InitialEntryItem[];
  mode?: "new" | "edit";
};

export function EntryView({
  draftId,
  rfqNumber,
  initialRequester,
  initialItems,
  mode = "new",
}: EntryViewProps) {
  const router = useRouter();
  const [requester, setRequester] = React.useState(initialRequester ?? "");
  const [items, setItems] = React.useState<DraftItem[]>(() =>
    (initialItems ?? []).map((it) => ({
      ...it,
      tempId: crypto.randomUUID(),
    })),
  );
  const [form, setForm] = React.useState<EntryItem>(emptyForm);
  // Tracks the persisted id of the item currently loaded in the form (set when
  // the user clicks Edit on an existing item) so it round-trips back into the
  // list when re-added.
  const [editingItemId, setEditingItemId] = React.useState<string | undefined>(
    undefined,
  );
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
    setEditingItemId(undefined);
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
      ...(editingItemId ? { id: editingItemId } : {}),
    };
    setItems((prev) => [...prev, item]);
    const wasEditing = Boolean(editingItemId);
    clearForm();
    toast.success(wasEditing ? "Item updated" : "Item added");
  }

  function handleDelete(tempId: string) {
    if (!confirm("Remove this item from the RFQ?")) return;
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
  }

  function handleEdit(tempId: string) {
    const target = items.find((it) => it.tempId === tempId);
    if (!target) return;
    const { tempId: _omit, id: _existingId, ...rest } = target;
    void _omit;
    // Preserve the persisted id (if any) so re-adding the item keeps it linked
    // to the same RfqItem row and its detail-stage fields.
    setEditingItemId(_existingId);
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

  async function copyRfqId() {
    try {
      await navigator.clipboard.writeText(rfqNumber);
      toast.success("RFQ ID copied");
    } catch {
      toast.error("Could not copy RFQ ID");
    }
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
      if (mode === "edit") {
        const { id } = await updateRfqEntryData(draftId, {
          requester: requester.trim(),
          items: items.map((it) => {
            const { tempId, ...rest } = it;
            void tempId;
            return rest;
          }),
        });
        router.push(`/rfq/${id}/details`);
      } else {
        const { id } = await finalizeDraftRfq(draftId, {
          requester: requester.trim(),
          items: items.map((it) => {
            const { tempId, id: _existingId, ...rest } = it;
            void tempId;
            void _existingId;
            return rest;
          }),
        });
        router.push(`/rfq/${id}/details`);
      }
    } catch (err) {
      console.error(err);
      toast.error(
        mode === "edit"
          ? "Failed to save changes. Please try again."
          : "Failed to create RFQ. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-slate-800 tracking-tight">
          {mode === "edit" ? "Edit Request for Quote" : "New Request for Quote"}
        </h2>
        <button
          type="button"
          onClick={copyRfqId}
          title="Copy RFQ ID"
          className="group inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors"
        >
          <span>#{rfqNumber}</span>
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
        <span className="px-1.5 py-px text-[10px] font-medium bg-slate-200 text-slate-600 rounded uppercase tracking-wide">
          Draft
        </span>
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
            <div className="absolute left-0 mt-1 w-40 bg-white border border-slate-200 rounded-md shadow-lg z-10 py-1">
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
          <div className="flex items-center gap-3 px-1">
            <Label
              htmlFor="requester"
              className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
              style={{ color: "#274579" }}
            >
              Requester
            </Label>
            <Input
              id="requester"
              value={requester}
              onChange={(e) => setRequester(e.target.value)}
              placeholder="Required Field"
              className="h-8 text-xs flex-1 bg-slate-100 border border-slate-300 focus-visible:bg-slate-50 focus-visible:border-slate-400"
            />
          </div>

          {/* Form */}
          <div className="bg-white rounded-md shadow-xl p-4 border border-slate-100">
            <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="mb-1 block text-xs">
                  Item Category{" "}
                  <span className="text-slate-400 font-normal">(Required)</span>
                </Label>
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
                <Label className="mb-1 block text-xs">
                  Department{" "}
                  <span className="text-slate-400 font-normal">(Required)</span>
                </Label>
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
                <Label className="mb-1 block text-xs">
                  Request Quantity{" "}
                  <span className="text-slate-400 font-normal">(Required)</span>
                </Label>
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
              <Label className="mb-1 block text-xs">
                Item Name{" "}
                <span className="text-slate-400 font-normal">(Required)</span>
              </Label>
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
                style={{ backgroundColor: "#4a6aa5" }}
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
        <div className="lg:col-span-5 lg:sticky lg:top-4 lg:self-start">
          <div className="bg-white rounded-md shadow-xl border border-slate-100 flex flex-col lg:h-[calc(100vh-6rem)]">
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
                  {items.map((item, index) => (
                    <div
                      key={item.tempId}
                      className="bg-slate-50 border border-slate-200 rounded p-2.5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          aria-hidden="true"
                          className="shrink-0 w-4 h-4 flex items-center justify-center rounded bg-slate-300 text-slate-50 text-[11px] font-semibold leading-none"
                        >
                          {index + 1}
                        </span>
                        <div className="font-semibold text-xs text-slate-800 break-words">
                          {item.itemName}
                        </div>
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
                  {submitting
                    ? mode === "edit"
                      ? "Saving…"
                      : "Creating RFQ…"
                    : mode === "edit"
                      ? "Save & Continue"
                      : "Proceed with RFQ"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
