import { unstable_cache } from "next/cache";
import { prisma, withDbRetry } from "@/lib/db";
import { parseQuoteConfig } from "@/lib/quote-config";
import { QuoteList, type QuoteRow } from "@/components/quotes/quote-list";
import { lineTotalNaira } from "@/lib/export/types";
import type { DetailsItemPayload } from "@/components/rfq/item-detail-form";

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
                items: {
                  select: {
                    id: true,
                    requestQuantity: true,
                    nairaUnitPrice: true,
                    tax: true,
                    taxMode: true,
                    domesticShippingNaira: true,
                    intlShippingNaira: true,
                  },
                  orderBy: { createdAt: "asc" },
                },
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
        const markupFactor = 1 + (config?.markup ?? 0) / 100;
        const selectedSet = new Set(selectedItemIds);
        let total = 0;
        for (const item of q.rfq.items) {
          if (!selectedSet.has(item.id)) continue;
          const line = lineTotalNaira(item as unknown as DetailsItemPayload);
          if (line != null) total += line * markupFactor;
        }
        return {
          id: q.id,
          quoteNumber: q.quoteNumber,
          rfqId: q.rfqId,
          rfqNumber: q.rfq.rfqNumber,
          requester: q.rfq.requester,
          selectedItemIds,
          hasPo: q.rfq.purchaseOrders.length > 0,
          createdAt: q.createdAt,
          total,
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
