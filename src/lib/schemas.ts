import { z } from "zod";
import { REQUIRED_DETAIL_FIELDS } from "./constants";

// First-stage item: what the entry view collects before saving anything.
export const entryItemSchema = z.object({
  itemCategory: z.string().min(1, "Category is required"),
  department: z.string().min(1, "Department is required"),
  itemName: z.string().min(1, "Item name is required"),
  itemDescription: z.string().optional().nullable(),
  requestQuantity: z.number().positive("Quantity must be > 0"),
  size: z.string().optional().nullable(),
  specification: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  additionalNotes: z.string().optional().nullable(),
});
export type EntryItem = z.infer<typeof entryItemSchema>;

export const createRfqSchema = z.object({
  requester: z.string().min(1, "Requester name is required"),
  items: z.array(entryItemSchema).min(1, "At least one item is required"),
});
export type CreateRfqInput = z.infer<typeof createRfqSchema>;

// Same shape as createRfqSchema but each item may carry the id of an existing
// RfqItem so updateRfqEntryData can patch in place rather than replace — which
// preserves any detail-stage fields the user has already filled in.
export const editEntryItemSchema = entryItemSchema.extend({
  id: z.string().optional(),
});
export const updateRfqEntryDataSchema = z.object({
  requester: z.string().min(1, "Requester name is required"),
  items: z.array(editEntryItemSchema).min(1, "At least one item is required"),
});
export type UpdateRfqEntryDataInput = z.infer<typeof updateRfqEntryDataSchema>;

// Second-stage patch: every field optional so partial saves go through.
// Empty strings are treated as "not yet filled" by the UI but still allowed to persist.
export const updateItemSchema = z.object({
  mProductCode: z.string().nullish(),
  unitQuantity: z.number().nullish(),
  uom: z.string().nullish(),
  manufacturerName: z.string().nullish(),
  vendor: z.string().nullish(),
  vendorLocation: z.string().nullish(),
  productLink: z.string().nullish(),
  countryOfOrigin: z.string().nullish(),
  vendorDeliveryTimeline: z.string().nullish(),
  originalCurrency: z.string().nullish(),
  ogUnitPrice: z.number().nullish(),
  ogBoxPrice: z.number().nullish(),
  nairaUnitPrice: z.number().nullish(),
  boxPrice: z.number().nullish(),
  nairaOverridden: z.boolean().optional(),
});
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

// Batch patch for the manual-save flow: one request updates every dirty item
// for an RFQ in a single transaction.
export const updateRfqItemsSchema = z.object({
  rfqId: z.string().min(1),
  patches: z
    .array(z.object({ id: z.string().min(1), patch: updateItemSchema }))
    .min(1),
});
export type UpdateRfqItemsInput = z.infer<typeof updateRfqItemsSchema>;

// Used by submitRfq to confirm every required detail field is filled per item.
export function findMissingDetailFields(
  item: Record<string, unknown>,
): string[] {
  return REQUIRED_DETAIL_FIELDS.filter((key) => {
    const value = item[key];
    if (value === null || value === undefined) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (typeof value === "number" && Number.isNaN(value)) return true;
    return false;
  });
}
