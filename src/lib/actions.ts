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

export async function createRfq(input: CreateRfqInput): Promise<{ id: string; rfqNumber: string }> {
  const parsed = createRfqSchema.parse(input);

  // Retry the unique rfqNumber a couple of times in the unlikely case of a collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const rfqNumber = generateRfqNumber();
    try {
      const created = await prisma.rfq.create({
        data: {
          rfqNumber,
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
      return { id: created.id, rfqNumber: created.rfqNumber };
    } catch (err) {
      // P2002 = unique constraint violation; retry with a fresh suffix.
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed to allocate a unique RFQ number after 5 attempts");
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
