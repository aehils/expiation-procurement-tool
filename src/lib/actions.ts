"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { customAlphabet } from "nanoid";
import { prisma, withDbRetry } from "./db";
import { type DocRef, rfqHref, hashDateToBase32, quoteNumberFromRfq } from "./docs";
import { BANNER_CURRENCIES } from "./constants";
import { fetchRate } from "./rates";
import {
  createRfqSchema,
  updateItemSchema,
  updateRfqEntryDataSchema,
  createPoSchema,
  updatePoItemQuantitySchema,
  quoteConfigSchema,
  type CreateRfqInput,
  type UpdateItemInput,
  type UpdateRfqEntryDataInput,
  type CreatePoInput,
  type QuoteConfig,
} from "./schemas";
import { encodeQuoteConfig, parseQuoteConfig } from "./quote-config";
import { toDetailsPayload } from "./rfq-item";
import { COLUMNS } from "./export/types";
import type { ExportQuoteData, ColKey } from "./export/types";

const docSuffix = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);

// 10-char doc number: 2-char type prefix + 4-char date hash + 4-char random.
function generateDocNumber(prefix: string): string {
  return `${prefix}${hashDateToBase32(new Date())}${docSuffix()}`;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

// Returns a candidate rfqNumber for the entry view to display while the user
// fills in the form. Pure: no DB row is created, so abandoned form sessions
// don't leave orphan rows behind. The actual INSERT happens in createRfq when
// the user submits.
export async function previewRfqNumber(): Promise<{ rfqNumber: string }> {
  return { rfqNumber: generateDocNumber("RQ") };
}

// Persists the entry form to a new RFQ row in a single INSERT. The candidate
// rfqNumber from previewRfqNumber is reused if available, falling back to a
// fresh one on the rare (~1-in-1M same-day) unique-violation.
export async function createRfq(
  input: CreateRfqInput & { rfqNumber?: string },
): Promise<{ id: string; rfqNumber: string }> {
  const parsed = createRfqSchema.parse(input);

  const created = await withDbRetry(async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const rfqNumber =
        attempt === 0 && input.rfqNumber
          ? input.rfqNumber
          : generateDocNumber("RQ");
      try {
        return await prisma.rfq.create({
          data: {
            rfqNumber,
            title: parsed.title || null,
            requester: parsed.requester,
            status: "details",
            items: {
              create: parsed.items.map((item) => ({
                itemCategory: item.itemCategory || null,
                department: item.department || null,
                itemName: item.itemName,
                itemDescription: item.itemDescription || null,
                requestQuantity: item.requestQuantity,
                size: item.size || null,
                specification: item.specification || null,
                brand: item.brand || null,
                model: item.model || null,
                additionalNotes: item.additionalNotes || null,
                // Second-stage fields, populated only when an upload carried them.
                uom: item.uom ?? null,
                vendor: item.vendor ?? null,
                productLink: item.productLink ?? null,
                ogUnitPrice: item.ogUnitPrice ?? null,
                nairaUnitPrice: item.nairaUnitPrice ?? null,
                // If the upload provided an NGN price, lock it from being
                // overwritten by the live FX recalc on the details page.
                nairaOverridden:
                  item.nairaOverridden ??
                  (item.nairaUnitPrice != null ? true : false),
                tax: item.tax ?? null,
                taxMode:
                  item.taxMode ?? (item.tax != null ? "amount" : null),
                domesticShippingCost: item.domesticShippingCost ?? null,
                domesticShippingNaira: item.domesticShippingNaira ?? null,
                intlShippingCost: item.intlShippingCost ?? null,
                intlShippingNaira: item.intlShippingNaira ?? null,
              })),
            },
          },
        });
      } catch (err) {
        if (isUniqueViolation(err)) continue;
        throw err;
      }
    }
    throw new Error("Failed to allocate a unique RFQ number after 5 attempts");
  });

  revalidateTag("rfqs");
  revalidatePath("/");
  return { id: created.id, rfqNumber: created.rfqNumber };
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

  const existing = await withDbRetry(() =>
    prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { items: { select: { id: true } } },
    }),
  );
  if (!existing) throw new Error("RFQ not found");

  const keepIds = new Set(
    parsed.items.map((it) => it.id).filter((id): id is string => Boolean(id)),
  );
  const toDelete = existing.items
    .map((it) => it.id)
    .filter((id) => !keepIds.has(id));

  await withDbRetry(() =>
    prisma.$transaction([
    prisma.rfq.update({
      where: { id: rfqId },
      data: { title: parsed.title || null, requester: parsed.requester },
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
        itemCategory: item.itemCategory || null,
        department: item.department || null,
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
    ]),
  );

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

  await withDbRetry(() => prisma.rfqItem.update({ where: { id: itemId }, data }));
  return { ok: true };
}

export async function toggleItemComplete(
  itemId: string,
  value: boolean,
): Promise<void> {
  await withDbRetry(() =>
    prisma.rfqItem.update({
      where: { id: itemId },
      data: { markedComplete: value },
    }),
  );
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
    const rows = await withDbRetry(() =>
      prisma.currencyRate.findMany({
        where: { code: { in: BANNER_CURRENCIES.map((c) => c.code) } },
      }),
    );
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
        await withDbRetry(() =>
          prisma.currencyRate.upsert({
            where: { code: c.code },
            create: { code: c.code, rate: result.rate, fetchedAt: pulledAt },
            update: { rate: result.rate, fetchedAt: pulledAt },
          }),
        );
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

export async function proceedToQuote(rfqId: string): Promise<void> {
  const rfq = await withDbRetry(() =>
    prisma.rfq.findUnique({
      where: { id: rfqId },
      select: { rfqNumber: true, items: { select: { id: true } } },
    }),
  );
  if (!rfq) throw new Error("RFQ not found");

  await withDbRetry(() =>
    prisma.rfq.update({
      where: { id: rfqId },
      data: { status: "quoted" },
    }),
  );

  // Materialise a quote row so the RFQ appears under Quotes the moment it's
  // marked quoted — otherwise status "quoted" and the Quotes list (which reads
  // the Quote table) disagree. Seeds the same defaults the quote view shows,
  // and leaves an already-saved quote untouched. Tolerate the Quote table not
  // existing yet (migration not applied), matching the quote pages' guard.
  try {
    const quoteNumber = quoteNumberFromRfq(rfq.rfqNumber);
    const config = encodeQuoteConfig({
      columns: COLUMNS.filter((c) => c.defaultOn).map((c) => c.key),
      items: rfq.items.map((i) => i.id),
      markup: 0,
    });
    await withDbRetry(() =>
      prisma.quote.upsert({
        where: { rfqId },
        create: { rfqId, quoteNumber, config },
        update: {},
      }),
    );
  } catch {
    // Quote row will be created on the first explicit save instead.
  }

  revalidateTag("rfqs");
  revalidatePath(`/rfq/${rfqId}/details`);
  revalidatePath("/quotes");
}

// ---------------------------------------------------------------------------
// Purchase Order actions
// ---------------------------------------------------------------------------

export async function createPurchaseOrder(
  input: CreatePoInput,
): Promise<{ id: string; poNumber: string }> {
  const parsed = createPoSchema.parse(input);

  const rfq = await withDbRetry(() =>
    prisma.rfq.findUnique({
      where: { id: parsed.rfqId },
      include: { items: true, purchaseOrders: { select: { id: true } } },
    }),
  );
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
      const po = await withDbRetry(() => prisma.$transaction(async (tx) => {
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
                  // PoItem snapshots the source RfqItem, where category/
                  // department are now optional. Default to empty string to
                  // satisfy the still-required PoItem columns.
                  itemCategory: src.itemCategory ?? "",
                  department: src.department ?? "",
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
      }));

      revalidateTag("rfqs");
      revalidateTag("purchase-orders");
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

  const poItem = await withDbRetry(() =>
    prisma.poItem.findUnique({
      where: { id: poItemId },
      include: { po: { select: { status: true, markupFactor: true } } },
    }),
  );
  if (!poItem) throw new Error("PO item not found");
  if (poItem.po.status !== "draft") {
    throw new Error("Cannot edit an issued or closed PO");
  }

  const lineTotal = poItem.totalPerUnit * parsed.quantity * poItem.po.markupFactor;
  await withDbRetry(() =>
    prisma.poItem.update({
      where: { id: poItemId },
      data: { quantity: parsed.quantity, lineTotal },
    }),
  );
}

export async function updatePoNotes(
  poId: string,
  notes: string,
): Promise<void> {
  const po = await withDbRetry(() =>
    prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { status: true },
    }),
  );
  if (!po) throw new Error("PO not found");
  if (po.status !== "draft") {
    throw new Error("Cannot edit an issued or closed PO");
  }
  await withDbRetry(() =>
    prisma.purchaseOrder.update({
      where: { id: poId },
      data: { notes },
    }),
  );
}

export async function issuePo(poId: string): Promise<void> {
  const po = await withDbRetry(() =>
    prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { status: true },
    }),
  );
  if (!po) throw new Error("PO not found");
  if (po.status !== "draft") {
    throw new Error("Only draft POs can be issued");
  }
  await withDbRetry(() =>
    prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: "issued" },
    }),
  );
  revalidateTag("purchase-orders");
  revalidatePath(`/po/${poId}`);
}

export async function closePo(poId: string): Promise<void> {
  const po = await withDbRetry(() =>
    prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { status: true },
    }),
  );
  if (!po) throw new Error("PO not found");
  if (po.status !== "issued") {
    throw new Error("Only issued POs can be closed");
  }
  await withDbRetry(() =>
    prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: "closed" },
    }),
  );
  revalidateTag("purchase-orders");
  revalidatePath(`/po/${poId}`);
}

// ---------------------------------------------------------------------------
// Sidebar navigation: recent documents + global search
// ---------------------------------------------------------------------------

type RfqRow = { id: string; rfqNumber: string; requester: string; status: string };
type PoRow = { id: string; poNumber: string; status: string };
type QuoteRow = { id: string; quoteNumber: string; rfq: { requester: string } };

function toRfqRef(r: RfqRow): DocRef {
  return {
    type: "rfq",
    id: r.id,
    label: r.rfqNumber,
    sublabel: r.requester,
    href: rfqHref(r.id, r.status),
  };
}

function toPoRef(p: PoRow): DocRef {
  return {
    type: "po",
    id: p.id,
    label: p.poNumber,
    sublabel: p.status,
    href: `/po/${p.id}`,
  };
}

function toQuoteRef(q: QuoteRow): DocRef {
  return {
    type: "quote",
    id: q.id,
    label: q.quoteNumber,
    sublabel: q.rfq.requester,
    href: `/quotes/${q.id}`,
  };
}

export async function getRecentDocuments(): Promise<{
  rfqs: DocRef[];
  quotes: DocRef[];
  pos: DocRef[];
}> {
  const [rfqs, quotes, pos] = await withDbRetry(() =>
    Promise.all([
      prisma.rfq.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.quote.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { rfq: { select: { requester: true } } },
      }),
      prisma.purchaseOrder.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]),
  );
  return { rfqs: rfqs.map(toRfqRef), quotes: quotes.map(toQuoteRef), pos: pos.map(toPoRef) };
}

export async function searchDocuments(query: string): Promise<{
  rfqs: DocRef[];
  quotes: DocRef[];
  pos: DocRef[];
}> {
  const q = query.trim();
  if (!q) return { rfqs: [], quotes: [], pos: [] };
  // SQLite `contains` is case-sensitive; doc numbers are uppercase, so match the
  // number fields against the uppercased query and free text against it as typed.
  const upper = q.toUpperCase();
  const [rfqs, quotes, pos] = await withDbRetry(() =>
    Promise.all([
      prisma.rfq.findMany({
        where: {
          OR: [{ rfqNumber: { contains: upper } }, { requester: { contains: q } }],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.quote.findMany({
        where: { quoteNumber: { contains: upper } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { rfq: { select: { requester: true } } },
      }),
      prisma.purchaseOrder.findMany({
        where: { poNumber: { contains: upper } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]),
  );
  return { rfqs: rfqs.map(toRfqRef), quotes: quotes.map(toQuoteRef), pos: pos.map(toPoRef) };
}

export async function saveQuote(
  rfqId: string,
  config: QuoteConfig,
): Promise<{ id: string; quoteNumber: string; updatedAt: string }> {
  const parsed = quoteConfigSchema.parse(config);

  const rfq = await withDbRetry(() =>
    prisma.rfq.findUnique({
      where: { id: rfqId },
      select: { rfqNumber: true },
    }),
  );
  if (!rfq) throw new Error("RFQ not found");

  const quoteNumber = quoteNumberFromRfq(rfq.rfqNumber);
  const encoded = encodeQuoteConfig(parsed);

  const quote = await withDbRetry(() =>
    prisma.quote.upsert({
      where: { rfqId },
      create: { rfqId, quoteNumber, config: encoded },
      update: { config: encoded },
    }),
  );

  revalidateTag("quotes");
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quote.id}`);
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    updatedAt: quote.updatedAt.toISOString(),
  };
}

export async function deleteQuote(quoteId: string): Promise<void> {
  await withDbRetry(() => prisma.quote.delete({ where: { id: quoteId } }));
  revalidateTag("quotes");
  revalidatePath("/quotes");
}

export async function getQuoteExportData(quoteId: string): Promise<ExportQuoteData | null> {
  const quote = await withDbRetry(() =>
    prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        quoteNumber: true,
        config: true,
        rfq: {
          select: {
            rfqNumber: true,
            requester: true,
            items: { orderBy: { createdAt: "asc" } },
          },
        },
      },
    }),
  );
  if (!quote) return null;
  const config = parseQuoteConfig(quote.config);
  const items = quote.rfq.items.map(toDetailsPayload);
  const itemIdSet = new Set(items.map((i) => i.id));
  const selectedItemIds = config
    ? new Set(config.items.filter((id) => itemIdSet.has(id)))
    : itemIdSet;
  const customMarkups: Record<string, number> = {};
  if (config?.customMarkups) {
    for (const [id, pct] of Object.entries(config.customMarkups)) {
      if (itemIdSet.has(id)) customMarkups[id] = pct;
    }
  }
  return {
    quoteNumber: quote.quoteNumber,
    rfqNumber: quote.rfq.rfqNumber,
    requester: quote.rfq.requester,
    items,
    selectedItemIds,
    enabledColumns: (config?.columns ?? []) as ColKey[],
    markupFactor: 1 + (config?.markup ?? 0) / 100,
    notes: config?.notes ?? {},
    customMarkups,
  };
}

export async function deleteRfq(rfqId: string): Promise<void> {
  // PurchaseOrder has no cascade from rfqId, so delete POs (and their PoItems
  // via cascade) before deleting the RFQ (which cascades RfqItems + Quote).
  await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.deleteMany({ where: { rfqId } });
      await tx.rfq.delete({ where: { id: rfqId } });
    }),
  );
  revalidateTag("rfqs");
  revalidateTag("purchase-orders");
  revalidateTag("quotes");
  revalidatePath("/rfq");
  revalidatePath("/quotes");
  revalidatePath("/");
}

export async function deleteDraftPo(poId: string): Promise<string> {
  const po = await withDbRetry(() =>
    prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { status: true, rfqId: true },
    }),
  );
  if (!po) throw new Error("PO not found");
  if (po.status !== "draft") {
    throw new Error("Only draft POs can be deleted");
  }

  await withDbRetry(() =>
    prisma.$transaction([
      prisma.purchaseOrder.delete({ where: { id: poId } }),
      prisma.rfq.update({
        where: { id: po.rfqId },
        data: { status: "quoted" },
      }),
    ]),
  );

  revalidateTag("rfqs");
  revalidateTag("purchase-orders");
  revalidatePath("/");
  return po.rfqId;
}
