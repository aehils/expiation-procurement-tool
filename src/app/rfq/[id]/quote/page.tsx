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
  const rfq = await withDbRetry(() =>
    prisma.rfq.findUnique({
      where: { id },
      include: { items: { orderBy: { createdAt: "asc" } }, quote: true },
    }),
  );

  if (!rfq) notFound();

  // Read any saved quote separately and tolerate the Quote table not existing
  // yet (migration not applied) — mirrors readPersistedBannerRates' guard so
  // this page keeps working even before the Quotes migration is deployed.
  let savedQuote: { config: string; updatedAt: Date } | null = null;
  try {
    savedQuote = await withDbRetry(() =>
      prisma.quote.findUnique({
        where: { rfqId: rfq.id },
        select: { config: true, updatedAt: true },
      }),
    );
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
      listBackHref="/rfq"
      listBackLabel={
        <>
          Back to RFQ
          <span className="font-semibold text-[0.88em] tracking-normal -ml-[2px] relative top-[1px]">
            s
          </span>
        </>
      }
      hasSavedQuote={savedQuote != null}
      initialConfig={parseQuoteConfig(savedQuote?.config)}
      initialUpdatedAt={savedQuote?.updatedAt.toISOString() ?? null}
    />
  );
}
