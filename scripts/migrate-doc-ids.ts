// One-time migration: rewrites every Rfq.rfqNumber, Quote.quoteNumber, and
// PurchaseOrder.poNumber from the legacy `PREFIX-YYYYMMDD-XXXX` shape to the
// new 10-char shape produced by generateDocNumber in src/lib/actions.ts:
//   {PP}{4-char date hash}{XXXX}
// Run once with: `npx tsx scripts/migrate-doc-ids.ts`
//
// Idempotent: rows whose ID no longer matches the legacy pattern are skipped,
// so a re-run is a no-op.

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashDateToBase32 } from "../src/lib/docs";

const LEGACY = /^(RFQ|QU|PO)-(\d{8})-([A-Z2-9]{4})$/;

// "RFQ" docs become "RQ" docs; quotes and POs keep their 2-char prefix.
const NEW_PREFIX: Record<string, string> = { RFQ: "RQ", QU: "QU", PO: "PO" };

function toNewId(oldId: string): string | null {
  const m = LEGACY.exec(oldId);
  if (!m) return null;
  const [, oldPrefix, yyyymmdd, suffix] = m;
  const yyyy = Number(yyyymmdd.slice(0, 4));
  const mm = Number(yyyymmdd.slice(4, 6));
  const dd = Number(yyyymmdd.slice(6, 8));
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  return `${NEW_PREFIX[oldPrefix]}${hashDateToBase32(date)}${suffix}`;
}

async function main() {
  const [rfqs, quotes, pos] = await Promise.all([
    prisma.rfq.findMany({ select: { id: true, rfqNumber: true } }),
    prisma.quote.findMany({ select: { id: true, quoteNumber: true } }),
    prisma.purchaseOrder.findMany({ select: { id: true, poNumber: true } }),
  ]);

  const rfqUpdates = rfqs
    .map((r) => ({ id: r.id, oldId: r.rfqNumber, newId: toNewId(r.rfqNumber) }))
    .filter((u): u is { id: string; oldId: string; newId: string } => u.newId !== null);

  const quoteUpdates = quotes
    .map((q) => ({ id: q.id, oldId: q.quoteNumber, newId: toNewId(q.quoteNumber) }))
    .filter((u): u is { id: string; oldId: string; newId: string } => u.newId !== null);

  const poUpdates = pos
    .map((p) => ({ id: p.id, oldId: p.poNumber, newId: toNewId(p.poNumber) }))
    .filter((u): u is { id: string; oldId: string; newId: string } => u.newId !== null);

  console.log(
    `Scanned: ${rfqs.length} RFQs, ${quotes.length} Quotes, ${pos.length} POs`,
  );
  console.log(
    `Eligible for migration: ${rfqUpdates.length} RFQs, ${quoteUpdates.length} Quotes, ${poUpdates.length} POs`,
  );

  if (rfqUpdates.length + quoteUpdates.length + poUpdates.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  await prisma.$transaction([
    ...rfqUpdates.map((u) =>
      prisma.rfq.update({ where: { id: u.id }, data: { rfqNumber: u.newId } }),
    ),
    ...quoteUpdates.map((u) =>
      prisma.quote.update({ where: { id: u.id }, data: { quoteNumber: u.newId } }),
    ),
    ...poUpdates.map((u) =>
      prisma.purchaseOrder.update({ where: { id: u.id }, data: { poNumber: u.newId } }),
    ),
  ]);

  for (const u of rfqUpdates) console.log(`rfq    ${u.oldId} -> ${u.newId}`);
  for (const u of quoteUpdates) console.log(`quote  ${u.oldId} -> ${u.newId}`);
  for (const u of poUpdates) console.log(`po     ${u.oldId} -> ${u.newId}`);
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
