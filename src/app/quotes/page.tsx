import { unstable_cache } from "next/cache";
import { prisma, withDbRetry } from "@/lib/db";
import { parseQuoteConfig } from "@/lib/quote-config";
import { QuoteList, type QuoteRow } from "@/components/quotes/quote-list";

const getQuoteRows = unstable_cache(
  async (): Promise<QuoteRow[]> => {
    try {
      const quotes = await withDbRetry(() =>
        prisma.quote.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            quoteNumber: true,
            rfqId: true,
            config: true,
            rfq: {
              select: {
                rfqNumber: true,
                requester: true,
                items: { select: { id: true }, orderBy: { createdAt: "asc" } },
                purchaseOrders: { select: { id: true } },
              },
            },
          },
        }),
      );
      return quotes.map((q) => {
        const config = parseQuoteConfig(q.config);
        const itemIds = q.rfq.items.map((i) => i.id);
        const itemIdSet = new Set(itemIds);
        const selectedItemIds = config
          ? config.items.filter((id) => itemIdSet.has(id))
          : itemIds;
        return {
          id: q.id,
          quoteNumber: q.quoteNumber,
          rfqId: q.rfqId,
          rfqNumber: q.rfq.rfqNumber,
          requester: q.rfq.requester,
          selectedItemIds,
          hasPo: q.rfq.purchaseOrders.length > 0,
        };
      });
    } catch {
      return [];
    }
  },
  ["quotes-list"],
  { tags: ["quotes"] },
);

export default async function QuotesListPage() {
  const rows = await getQuoteRows();

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Quotes
        </h1>
        <p className="text-muted-foreground mt-1">
          Saved quotes across your organisation.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No quotes yet.</p>
          <p className="text-sm mt-1">
            Open an RFQ&apos;s quote view, configure it, then save it to see it here.
          </p>
        </div>
      ) : (
        <QuoteList quotes={rows} />
      )}
    </div>
  );
}
