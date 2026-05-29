import Link from "next/link";
import { Plus } from "lucide-react";
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

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold text-slate-800 tracking-tight">
          Requests for Quotation
        </h1>
        <Link
          href="/rfq/new"
          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium bg-[#274579] text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New RFQ
        </Link>
      </div>

      <RfqList rfqs={rfqs} />
    </div>
  );
}
