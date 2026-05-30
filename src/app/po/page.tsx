import { unstable_cache } from "next/cache";
import { prisma, withDbRetry } from "@/lib/db";
import { PoList, type PoRow } from "@/components/po/po-list";

const getPos = unstable_cache(
  async (): Promise<PoRow[]> => {
    return withDbRetry(() =>
      prisma.purchaseOrder.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          poNumber: true,
          status: true,
          createdAt: true,
          rfq: { select: { requester: true } },
        },
      }),
    );
  },
  ["po-list"],
  { tags: ["purchase-orders"] },
);

export default async function PoListPage() {
  const pos = await getPos();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold text-slate-800 tracking-tight">
          Purchase Orders
        </h1>
      </div>

      <PoList pos={pos} />
    </div>
  );
}
