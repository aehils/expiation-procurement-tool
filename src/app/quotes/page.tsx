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
            createdAt: true,
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
          createdAt: q.createdAt,
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
    <div className="max-w-screen-2xl mx-auto px-6 py-4">
      <h1 className="text-3xl font-semibold text-slate-800 tracking-tight mb-12 pl-8">
        Quotes
      </h1>

      <QuoteList quotes={rows} />
    </div>
  );
}
