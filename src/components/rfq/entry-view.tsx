"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
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
import { createRfq, updateRfqEntryData } from "@/lib/actions";
import type { EntryItem } from "@/lib/schemas";
import {
  UPLOADED_ITEMS_STORAGE_KEY,
  readStoredUploadedItems,
} from "@/lib/rfq-upload";
import { RfqStepper } from "./rfq-stepper";

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
  rfqNumber: string;
  // Required in edit mode: the persisted RFQ's id. Absent in new mode — no
  // row exists until createRfq runs on submit.
  rfqId?: string;
  // When present, the view operates in edit mode: it pre-fills requester and
  // items, and "Proceed" updates the existing RFQ instead of creating one.
  initialRequester?: string;
  initialItems?: InitialEntryItem[];
  mode?: "new" | "edit";
  // When set, the matching item is pulled out of the list and loaded into the
  // form on mount. Used by the details view's per-item Edit button.
  initialEditItemId?: string;
};

export function EntryView({
  rfqNumber,
  rfqId,
  initialRequester,
  initialItems,
  mode = "new",
  initialEditItemId,
}: EntryViewProps) {
  const router = useRouter();
  const [requester, setRequester] = React.useState(initialRequester ?? "");
  const [items, setItems] = React.useState<DraftItem[]>(() => {
    return (initialItems ?? []).map((it) => ({
      ...it,
      tempId: crypto.randomUUID(),
    }));
  });
  const [form, setForm] = React.useState<EntryItem>(() => {
    if (!initialEditItemId) return emptyForm;
    const target = (initialItems ?? []).find(
      (it) => it.id === initialEditItemId,
    );
    if (!target) return emptyForm;
    const { id: _omit, ...rest } = target;
    void _omit;
    return rest;
  });
  // Tracks the persisted DB id of the item currently loaded in the form so
  // saving replaces it in-place rather than creating a duplicate.
  const [editingItemId, setEditingItemId] = React.useState<string | undefined>(
    initialEditItemId,
  );
  // Tracks the client-side tempId of the item being edited (set for in-page
  // edits where we know the tempId; not set for deep-linked edits via
  // initialEditItemId since tempIds are generated fresh on mount).
  const [editingTempId, setEditingTempId] = React.useState<string | undefined>(
    undefined,
  );
  const [quantityRaw, setQuantityRaw] = React.useState(() => {
    if (!initialEditItemId) return "";
    const target = (initialItems ?? []).find(
      (it) => it.id === initialEditItemId,
    );
    return target?.requestQuantity ? String(target.requestQuantity) : "";
  });
  const [submitting, setSubmitting] = React.useState(false);

  // Hydrate items from a spreadsheet upload handed off via sessionStorage.
  // The upload page at /rfq/new/upload parses the file, stashes the parsed
  // rows, and routes here so the user lands in the same Add Items view they'd
  // see when entering manually — already populated.
  React.useEffect(() => {
    if (mode !== "new") return;
    if (initialItems && initialItems.length > 0) return;
    const stashed = readStoredUploadedItems();
    if (!stashed) return;
    sessionStorage.removeItem(UPLOADED_ITEMS_STORAGE_KEY);
    if (stashed.items.length === 0) return;
    setItems((prev) => {
      if (prev.length > 0) return prev;
      return stashed.items.map((row) => ({
        ...row,
        tempId: crypto.randomUUID(),
      }));
    });
    toast.success(
      `Imported ${stashed.items.length} item${stashed.items.length === 1 ? "" : "s"}.`,
    );
  }, [mode, initialItems]);

  function patchForm<K extends keyof EntryItem>(key: K, value: EntryItem[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function clearForm() {
    setForm(emptyForm);
    setQuantityRaw("");
    setEditingItemId(undefined);
    setEditingTempId(undefined);
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
    const wasEditing = Boolean(editingItemId || editingTempId);
    if (wasEditing) {
      // Update the item in-place — match by tempId when available (in-page
      // edit), otherwise fall back to the persisted DB id (deep-linked edit).
      setItems((prev) =>
        prev.map((it) => {
          const match = editingTempId
            ? it.tempId === editingTempId
            : it.id === editingItemId;
          if (!match) return it;
          return {
            ...form,
            requestQuantity: qty,
            tempId: it.tempId,
            ...(it.id ? { id: it.id } : {}),
          };
        }),
      );
    } else {
      const item: DraftItem = {
        ...form,
        requestQuantity: qty,
        tempId: crypto.randomUUID(),
      };
      setItems((prev) => [...prev, item]);
    }
    clearForm();
    toast.success(wasEditing ? "Item updated" : "Item added");
  }

  function handleDelete(tempId: string) {
    if (!confirm("Remove this item from the RFQ?")) return;
    const target = items.find((it) => it.tempId === tempId);
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
    // If the deleted item was the one being edited, clear the form so the user
    // doesn't accidentally re-add it.
    if (
      editingTempId === tempId ||
      (editingItemId && target?.id === editingItemId)
    ) {
      clearForm();
    }
  }

  function handleEdit(tempId: string) {
    const target = items.find((it) => it.tempId === tempId);
    if (!target) return;
    const { tempId: _omit, id: _existingId, ...rest } = target;
    void _omit;
    setEditingItemId(_existingId);
    setEditingTempId(tempId);
    setForm(rest);
    setQuantityRaw(
      target.requestQuantity ? String(target.requestQuantity) : "",
    );
    // Item stays in the list — it will be updated in-place when the user
    // clicks "Update Item". If they navigate away without saving, the
    // original data is preserved.
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
        if (!rfqId) throw new Error("rfqId is required in edit mode");
        const { id } = await updateRfqEntryData(rfqId, {
          requester: requester.trim(),
          items: items.map((it) => {
            const { tempId, ...rest } = it;
            void tempId;
            return rest;
          }),
        });
        router.push(`/rfq/${id}/details`);
      } else {
        const { id } = await createRfq({
          rfqNumber,
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
    <div className="max-w-screen-2xl mx-auto px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-3 mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="-ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-1 text-sm font-semibold uppercase tracking-wide text-slate-600 rounded-md active:bg-slate-200 active:text-slate-900 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
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
          <span className="px-2 py-0.5 text-xs font-medium bg-[#274579]/10 text-[#274579] rounded uppercase tracking-wide">
            In Progress
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Stepper/requester row — scoped to cols 1-7 (above the form). The Added panel spans
            rows 1-2 in cols 8-12 so its top aligns with this row's top, exceeding the form's
            top by exactly this row's height — regardless of how the row wraps at off-zoom.
            Items are left-aligned so that when the row wraps, the stepper on line 1 sits at
            the same left edge as the requester block on line 2 (stacked directly above it). */}
        <div className="lg:col-span-7 lg:col-start-1 lg:row-start-1">
          <div className="flex flex-wrap items-center gap-y-3 px-1">
            <RfqStepper currentStep={1} rfqId={rfqId} />
            <div aria-hidden="true" className="h-8 w-px bg-slate-300 mx-6" />
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
                value={requester}
                onChange={(e) => setRequester(e.target.value)}
                placeholder="Required Field"
                className="h-8 text-xs w-64 bg-slate-100 border border-slate-300 focus-visible:bg-slate-50 focus-visible:border-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Left column: Form — row 2 */}
        <div className="lg:col-span-7 lg:col-start-1 lg:row-start-2 space-y-4">
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
                  value={form.itemCategory ?? ""}
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
                  value={form.department ?? ""}
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
                style={{ backgroundColor: "#276E79" }}
                className="flex-1 hover:opacity-90 text-white"
              >
                {editingItemId || editingTempId ? "Update Item" : "Add Item"}
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

        {/* Added items panel — spans rows 1-2 so it starts above the form's top, riding into
            the empty row 1 area. Its bottom auto-aligns with the form via grid row sizing. */}
        <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2 min-h-0">
          <div className="bg-white rounded-md shadow-xl border border-slate-100 flex flex-col h-full">
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
                  {items.map((item, index) => {
                    const beingEdited = editingTempId
                      ? item.tempId === editingTempId
                      : editingItemId
                        ? item.id === editingItemId
                        : false;
                    return (
                    <div
                      key={item.tempId}
                      className={`rounded p-2.5 transition-shadow ${
                        beingEdited
                          ? "bg-blue-50/60 border-2 border-blue-300"
                          : "bg-slate-50 border border-slate-200 hover:shadow-md"
                      }`}
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
                      <dl className="mt-3 grid grid-cols-3 gap-x-3 text-xs">
                        <div>
                          <dt className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                            Department
                          </dt>
                          <dd className="text-slate-700 truncate">
                            {departmentLabel(item.department)}
                          </dd>
                        </div>
                        <div className="text-center">
                          <dt className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                            Quantity
                          </dt>
                          <dd className="text-slate-700">
                            {item.requestQuantity}
                          </dd>
                        </div>
                        <div className="text-right">
                          <dt className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                            Size
                          </dt>
                          <dd className="text-slate-700 truncate">
                            {item.size || "—"}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-3 pt-1.5 border-t border-slate-200 flex items-center justify-between gap-3">
                        <span className="inline-block px-1.5 py-px text-[10px] font-medium bg-[#274579]/10 text-[#274579] rounded uppercase tracking-wide">
                          {categoryLabel(item.itemCategory)}
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (!beingEdited) handleEdit(item.tempId);
                            }}
                            className={`text-xs ${
                              beingEdited
                                ? "text-blue-500 font-medium cursor-default"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            {beingEdited ? "Editing" : "Edit"}
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
                    </div>
                    );
                  })}
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
