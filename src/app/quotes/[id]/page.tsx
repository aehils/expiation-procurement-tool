import { notFound } from "next/navigation";
import { prisma, withDbRetry } from "@/lib/db";
import { QuoteView } from "@/components/rfq/quote-view";
import { toDetailsPayload } from "@/lib/rfq-item";
import { parseQuoteConfig } from "@/lib/quote-config";

export const dynamic = "force-dynamic";

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await withDbRetry(() =>
    prisma.quote.findUnique({
      where: { id },
      include: {
        rfq: { include: { items: { orderBy: { createdAt: "asc" } } } },
      },
    }),
  );

  if (!quote) notFound();

  const items = quote.rfq.items.map(toDetailsPayload);

  return (
    <QuoteView
      rfq={{
        id: quote.rfq.id,
        rfqNumber: quote.rfq.rfqNumber,
        requester: quote.rfq.requester,
        status: quote.rfq.status,
      }}
      items={items}
      listBackHref="/quotes"
      listBackLabel="Back to Quotes"
      hasSavedQuote
      initialConfig={parseQuoteConfig(quote.config)}
      initialUpdatedAt={quote.updatedAt.toISOString()}
    />
  );
}
