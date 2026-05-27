import { prisma } from "@/lib/db";
import { HomeActionCards } from "@/components/home-action-cards";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const availableQuotes = await prisma.rfq.findMany({
    where: {
      status: "quoted",
      purchaseOrders: { none: {} },
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  const quoteOptions = availableQuotes.map((q) => ({
    id: q.id,
    rfqNumber: q.rfqNumber,
    requester: q.requester,
    itemCount: q._count.items,
    createdAt: q.createdAt.toISOString(),
  }));

  return (
    <div className="flex items-center justify-center min-h-screen px-8">
      <div className="max-w-3xl w-full">
        <HomeActionCards quotes={quoteOptions} />
      </div>
    </div>
  );
}
