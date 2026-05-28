import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
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
  const rfq = await prisma.rfq.findUnique({
    where: { id },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  if (!rfq) notFound();

  // Read any saved quote separately and tolerate the Quote table not existing
  // yet (migration not applied) — mirrors readPersistedBannerRates' guard so
  // this page keeps working even before the Quotes migration is deployed.
  let savedQuote: { config: string } | null = null;
  try {
    savedQuote = await prisma.quote.findUnique({
      where: { rfqId: rfq.id },
      select: { config: true },
    });
  } catch {
    savedQuote = null;
  }

  const items = rfq.items.map(toDetailsPayload);

  return (
    <QuoteView
      rfq={{
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
        requester: rfq.requester,
        status: rfq.status,
      }}
      items={items}
      backHref={`/rfq/${rfq.id}/details`}
      hasSavedQuote={savedQuote != null}
      initialConfig={parseQuoteConfig(savedQuote?.config)}
    />
  );
}
