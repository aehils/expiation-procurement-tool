import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { HomeActionCards } from "@/components/home-action-cards";

const getAvailableQuotes = unstable_cache(
  async () => {
    const rfqs = await prisma.rfq.findMany({
      where: {
        status: "quoted",
        purchaseOrders: { none: {} },
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    });
    return rfqs.map((q) => ({
      id: q.id,
      rfqNumber: q.rfqNumber,
      requester: q.requester,
      itemCount: q._count.items,
      createdAt: q.createdAt.toISOString(),
    }));
  },
  ["home-available-quotes"],
  { tags: ["rfqs"] },
);

export default async function HomePage() {
  const quoteOptions = await getAvailableQuotes();

  return (
    <div className="flex items-center justify-center min-h-screen px-8">
      <div className="max-w-3xl w-full">
        <HomeActionCards quotes={quoteOptions} />
      </div>
    </div>
  );
}
