import { prisma } from "@/lib/db";
import { toDetailsPayload } from "@/lib/rfq-item";
import { parseQuoteConfig } from "@/lib/quote-config";
import { QuoteList, type QuoteRow } from "@/components/quotes/quote-list";

export const dynamic = "force-dynamic";

export default async function QuotesListPage() {
  const quotes = await prisma.quote.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      rfq: {
        include: {
          items: { orderBy: { createdAt: "asc" } },
          purchaseOrders: { select: { id: true } },
        },
      },
    },
  });

  const rows: QuoteRow[] = quotes.map((q) => {
    const config = parseQuoteConfig(q.config);
    const items = q.rfq.items.map(toDetailsPayload);
    const itemIds = new Set(items.map((i) => i.id));
    const selectedItemIds = config
      ? config.items.filter((id) => itemIds.has(id))
      : items.map((i) => i.id);
    return {
      id: q.id,
      quoteNumber: q.quoteNumber,
      rfqId: q.rfqId,
      rfqNumber: q.rfq.rfqNumber,
      requester: q.rfq.requester,
      items,
      selectedItemIds,
      enabledColumns: config?.columns ?? [],
      markup: config?.markup ?? 0,
      hasPo: q.rfq.purchaseOrders.length > 0,
    };
  });

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
