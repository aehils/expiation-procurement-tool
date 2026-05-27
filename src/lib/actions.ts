"use server";

import { revalidatePath } from "next/cache";
import { customAlphabet } from "nanoid";
import { prisma } from "./db";
import { BANNER_CURRENCIES } from "./constants";
import { fetchRate } from "./rates";
import {
  createRfqSchema,
  updateItemSchema,
  updateRfqEntryDataSchema,
  createPoSchema,
  updatePoItemQuantitySchema,
  type CreateRfqInput,
  type UpdateItemInput,
  type UpdateRfqEntryDataInput,
  type CreatePoInput,
} from "./schemas";

const docSuffix = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);

function generateDocNumber(prefix: string): string {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(today.getUTCDate()).padStart(2, "0");
  return `${prefix}-${yyyy}${mm}${dd}-${docSuffix()}`;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

// Creates an empty draft RFQ so we can show the user the allocated rfqNumber
// the moment they open the entry view. finalizeDraftRfq later fills in the
// requester + items and flips the status to "details".
export async function createDraftRfq(): Promise<{ id: string; rfqNumber: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const rfqNumber = generateDocNumber("RFQ");
    try {
      const created = await prisma.rfq.create({
        data: {
          rfqNumber,
          requester: "",
          status: "draft",
        },
      });
      return { id: created.id, rfqNumber: created.rfqNumber };
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  throw new Error("Failed to allocate a unique RFQ number after 5 attempts");
}

export async function finalizeDraftRfq(
  rfqId: string,
  input: CreateRfqInput,
): Promise<{ id: string; rfqNumber: string }> {
  const parsed = createRfqSchema.parse(input);

  const existing = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!existing) throw new Error("Draft RFQ not found");
  if (existing.status !== "draft") {
    throw new Error("RFQ has already been finalized");
  }

  const updated = await prisma.rfq.update({
    where: { id: rfqId },
    data: {
      requester: parsed.requester,
      status: "details",
      items: {
        create: parsed.items.map((item) => ({
          itemCategory: item.itemCategory,
          department: item.department,
          itemName: item.itemName,
          itemDescription: item.itemDescription || null,
          requestQuantity: item.requestQuantity,
          size: item.size || null,
          specification: item.specification || null,
          brand: item.brand || null,
          model: item.model || null,
          additionalNotes: item.additionalNotes || null,
        })),
      },
    },
  });
  revalidatePath("/");
  return { id: updated.id, rfqNumber: updated.rfqNumber };
}

// Called when a user navigates Back from the details view to edit the first-
// stage data of an already-finalized RFQ. We patch existing items in place
// (keeping their detail-stage fields intact), create any newly added items,
// and delete items the user removed in the editor.
export async function updateRfqEntryData(
  rfqId: string,
  input: UpdateRfqEntryDataInput,
): Promise<{ id: string; rfqNumber: string }> {
  const parsed = updateRfqEntryDataSchema.parse(input);

  const existing = await prisma.rfq.findUnique({
    where: { id: rfqId },
    include: { items: { select: { id: true } } },
  });
  if (!existing) throw new Error("RFQ not found");

  const keepIds = new Set(
    parsed.items.map((it) => it.id).filter((id): id is string => Boolean(id)),
  );
  const toDelete = existing.items
    .map((it) => it.id)
    .filter((id) => !keepIds.has(id));

  await prisma.$transaction([
    prisma.rfq.update({
      where: { id: rfqId },
      data: { requester: parsed.requester },
    }),
    ...(toDelete.length > 0
      ? [
          prisma.rfqItem.deleteMany({
            where: { id: { in: toDelete }, rfqId },
          }),
        ]
      : []),
    ...parsed.items.map((item) => {
      const entryFields = {
        itemCategory: item.itemCategory,
        department: item.department,
        itemName: item.itemName,
        itemDescription: item.itemDescription || null,
        requestQuantity: item.requestQuantity,
        size: item.size || null,
        specification: item.specification || null,
        brand: item.brand || null,
        model: item.model || null,
        additionalNotes: item.additionalNotes || null,
      };
      if (item.id) {
        return prisma.rfqItem.update({
          where: { id: item.id },
          data: entryFields,
        });
      }
      return prisma.rfqItem.create({
        data: { ...entryFields, rfqId },
      });
    }),
  ]);

  revalidatePath(`/rfq/${rfqId}/details`);
  return { id: existing.id, rfqNumber: existing.rfqNumber };
}

export async function updateRfqItem(
  itemId: string,
  patch: UpdateItemInput,
): Promise<{ ok: true }> {
  const parsed = updateItemSchema.parse(patch);

  // Convert undefined → skip; null/empty → set null; other → set value.
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") {
      data[key] = null;
    } else {
      data[key] = value;
    }
  }

  await prisma.rfqItem.update({ where: { id: itemId }, data });
  return { ok: true };
}

export async function toggleItemComplete(
  itemId: string,
  value: boolean,
): Promise<void> {
  await prisma.rfqItem.update({
    where: { id: itemId },
    data: { markedComplete: value },
  });
}

export type PersistedRate = {
  code: string;
  rate: number;
  fetchedAt: string;
};

// Reads the last-persisted snapshot of the banner currencies. Returns an
// empty list if the table doesn't exist yet (migration not applied) so the
// page still renders and the user can trigger a live pull.
export async function readPersistedBannerRates(): Promise<PersistedRate[]> {
  try {
    const rows = await prisma.currencyRate.findMany({
      where: { code: { in: BANNER_CURRENCIES.map((c) => c.code) } },
    });
    return rows.map((r) => ({
      code: r.code,
      rate: r.rate,
      fetchedAt: r.fetchedAt.toISOString(),
    }));
  } catch (err) {
    console.warn("[currency] could not read persisted rates:", err);
    return [];
  }
}

// Force-refreshes every banner currency against the upstream FX API and
// (best-effort) upserts the result. Returns the fresh snapshot regardless of
// whether the DB write succeeded — so the UI updates even if the CurrencyRate
// migration hasn't been applied yet.
export async function refreshBannerCurrencyRates(): Promise<
  { code: string; rate: number; fetchedAt: string; error?: string }[]
> {
  // Pull-time timestamp rather than the upstream's publish time — that's what
  // "last time we pulled" actually means to the user staring at the banner.
  const pulledAt = new Date();
  const results = await Promise.all(
    BANNER_CURRENCIES.map(async (c) => {
      const result = await fetchRate(c.code, { force: true });
      if ("error" in result) {
        return { code: c.code, rate: 0, fetchedAt: "", error: result.error };
      }
      try {
        await prisma.currencyRate.upsert({
          where: { code: c.code },
          create: { code: c.code, rate: result.rate, fetchedAt: pulledAt },
          update: { rate: result.rate, fetchedAt: pulledAt },
        });
      } catch (err) {
        console.warn(`[currency] could not persist ${c.code} rate:`, err);
      }
      return {
        code: c.code,
        rate: result.rate,
        fetchedAt: pulledAt.toISOString(),
      };
    }),
  );
  return results;
}

export async function saveQuoteConfig(
  rfqId: string,
  markup: number,
  selectedItemIds: string[],
): Promise<void> {
  const allItems = await prisma.rfqItem.findMany({ where: { rfqId }, select: { id: true } });
  await prisma.rfq.update({ where: { id: rfqId }, data: { markup } });
  await Promise.all(
    allItems.map((item) =>
      prisma.rfqItem.update({
        where: { id: item.id },
        data: { selectedForQuote: selectedItemIds.includes(item.id) },
      }),
    ),
  );
  revalidatePath(`/rfq/${rfqId}/quote`);
}

export async function proceedToQuote(rfqId: string): Promise<void> {
  await prisma.rfq.update({
    where: { id: rfqId },
    data: { status: "quoted" },
  });
  revalidatePath(`/rfq/${rfqId}/details`);
}

// ---------------------------------------------------------------------------
// Purchase Order actions
// ---------------------------------------------------------------------------

export async function createPurchaseOrder(
  input: CreatePoInput,
): Promise<{ id: string; poNumber: string }> {
  const parsed = createPoSchema.parse(input);

  const rfq = await prisma.rfq.findUnique({
    where: { id: parsed.rfqId },
    include: { items: true, purchaseOrders: { select: { id: true } } },
  });
  if (!rfq) throw new Error("RFQ not found");
  if (rfq.status !== "quoted") {
    throw new Error("RFQ is not in quoted status");
  }
  if (rfq.purchaseOrders.length > 0) {
    throw new Error("A purchase order already exists for this quote");
  }

  const selectedIds = new Set(parsed.selectedItemIds);
  const selectedItems = rfq.items.filter((it) => selectedIds.has(it.id));
  if (selectedItems.length === 0) {
    throw new Error("None of the selected item IDs belong to this RFQ");
  }

  const overrides = parsed.quantityOverrides ?? {};

  for (let attempt = 0; attempt < 5; attempt++) {
    const poNumber = generateDocNumber("PO");
    try {
      const po = await prisma.$transaction(async (tx) => {
        const created = await tx.purchaseOrder.create({
          data: {
            poNumber,
            rfqId: parsed.rfqId,
            status: "draft",
            notes: parsed.notes ?? null,
            markupFactor: parsed.markupFactor,
            items: {
              create: selectedItems.map((src) => {
                const qty = overrides[src.id] ?? src.requestQuantity;
                const unitPrice = src.nairaUnitPrice ?? 0;
                const taxAmt =
                  src.tax == null
                    ? null
                    : src.taxMode === "percent"
                      ? unitPrice * (src.tax / 100)
                      : src.tax;
                const srcQty = src.requestQuantity || 1;
                const domPerUnit =
                  src.domesticShippingNaira != null
                    ? src.domesticShippingNaira / srcQty
                    : 0;
                const intlPerUnit =
                  src.intlShippingNaira != null
                    ? src.intlShippingNaira / srcQty
                    : 0;
                const totalPerUnit =
                  unitPrice + (taxAmt ?? 0) + domPerUnit + intlPerUnit;
                const lineTotal = totalPerUnit * qty * parsed.markupFactor;

                return {
                  rfqItemId: src.id,
                  itemName: src.itemName,
                  itemCategory: src.itemCategory,
                  department: src.department,
                  vendor: src.vendor ?? "",
                  vendorLocation: src.vendorLocation,
                  brand: src.brand,
                  mProductCode: src.mProductCode,
                  manufacturerName: src.manufacturerName,
                  uom: src.uom,
                  countryOfOrigin: src.countryOfOrigin,
                  vendorDeliveryTimeline: src.vendorDeliveryTimeline,
                  quantity: qty,
                  nairaUnitPrice: unitPrice,
                  taxAmount: taxAmt,
                  domesticShippingNaira: src.domesticShippingNaira,
                  intlShippingNaira: src.intlShippingNaira,
                  totalPerUnit,
                  lineTotal,
                };
              }),
            },
          },
        });

        await tx.rfq.update({
          where: { id: parsed.rfqId },
          data: { status: "ordered" },
        });

        return created;
      });

      revalidatePath("/");
      return { id: po.id, poNumber: po.poNumber };
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  throw new Error("Failed to allocate a unique PO number after 5 attempts");
}

export async function updatePoItemQuantity(
  poItemId: string,
  quantity: number,
): Promise<void> {
  const parsed = updatePoItemQuantitySchema.parse({ quantity });

  const poItem = await prisma.poItem.findUnique({
    where: { id: poItemId },
    include: { po: { select: { status: true, markupFactor: true } } },
  });
  if (!poItem) throw new Error("PO item not found");
  if (poItem.po.status !== "draft") {
    throw new Error("Cannot edit an issued or closed PO");
  }

  const lineTotal = poItem.totalPerUnit * parsed.quantity * poItem.po.markupFactor;
  await prisma.poItem.update({
    where: { id: poItemId },
    data: { quantity: parsed.quantity, lineTotal },
  });
}

export async function updatePoNotes(
  poId: string,
  notes: string,
): Promise<void> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { status: true },
  });
  if (!po) throw new Error("PO not found");
  if (po.status !== "draft") {
    throw new Error("Cannot edit an issued or closed PO");
  }
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { notes },
  });
}

export async function issuePo(poId: string): Promise<void> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { status: true },
  });
  if (!po) throw new Error("PO not found");
  if (po.status !== "draft") {
    throw new Error("Only draft POs can be issued");
  }
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: "issued" },
  });
  revalidatePath(`/po/${poId}`);
}

export async function closePo(poId: string): Promise<void> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { status: true },
  });
  if (!po) throw new Error("PO not found");
  if (po.status !== "issued") {
    throw new Error("Only issued POs can be closed");
  }
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: "closed" },
  });
  revalidatePath(`/po/${poId}`);
}

export async function deleteDraftPo(poId: string): Promise<string> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { status: true, rfqId: true },
  });
  if (!po) throw new Error("PO not found");
  if (po.status !== "draft") {
    throw new Error("Only draft POs can be deleted");
  }

  await prisma.$transaction([
    prisma.purchaseOrder.delete({ where: { id: poId } }),
    prisma.rfq.update({
      where: { id: po.rfqId },
      data: { status: "quoted" },
    }),
  ]);

  revalidatePath("/");
  return po.rfqId;
}
