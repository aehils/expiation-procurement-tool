import { unstable_cache } from "next/cache";
import { prisma, withDbRetry } from "@/lib/db";
import { RfqList } from "@/components/rfq/rfq-list";

const getRfqs = unstable_cache(
  async () => {
    return withDbRetry(() =>
      prisma.rfq.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true } } },
      }),
    );
  },
  ["rfq-list"],
  { tags: ["rfqs"] },
);

export default async function RfqListPage() {
  const rfqs = await getRfqs();
  const rows = rfqs.map((r) => ({
    id: r.id,
    rfqNumber: r.rfqNumber,
    requester: r.requester,
    status: r.status,
    createdAt: r.createdAt,
    itemCount: r._count.items,
  }));

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-4">
      <h1 className="text-3xl font-semibold text-slate-800 tracking-tight mb-12 pl-8">
        Requests for Quote
      </h1>

      <RfqList rfqs={rows} />
    </div>
  );
}
