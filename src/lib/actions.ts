"use server";

import { revalidatePath } from "next/cache";
import { customAlphabet } from "nanoid";
import { prisma } from "./db";
import {
  createRfqSchema,
  updateItemSchema,
  findMissingDetailFields,
  type CreateRfqInput,
  type UpdateItemInput,
} from "./schemas";

const rfqSuffix = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);

function generateRfqNumber(): string {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(today.getUTCDate()).padStart(2, "0");
  return `RFQ-${yyyy}${mm}${dd}-${rfqSuffix()}`;
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
    const rfqNumber = generateRfqNumber();
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

export async function submitRfq(
  rfqId: string,
): Promise<
  | { ok: true; rfqNumber: string }
  | { ok: false; missing: { itemId: string; itemName: string; fields: string[] }[] }
> {
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    include: { items: true },
  });
  if (!rfq) throw new Error("RFQ not found");

  const missing = rfq.items
    .map((item) => ({
      itemId: item.id,
      itemName: item.itemName,
      fields: findMissingDetailFields(item as unknown as Record<string, unknown>),
    }))
    .filter((entry) => entry.fields.length > 0);

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  await prisma.rfq.update({
    where: { id: rfqId },
    data: { status: "submitted" },
  });
  revalidatePath(`/rfq/${rfqId}/details`);
  return { ok: true, rfqNumber: rfq.rfqNumber };
}
