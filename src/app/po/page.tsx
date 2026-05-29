import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma, withDbRetry } from "@/lib/db";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[#274579]/10 text-[#274579]",
  issued: "bg-[#274579]/10 text-[#274579]",
  closed: "bg-[#274579]/10 text-[#274579]",
};

const getPos = unstable_cache(
  async () => {
    return withDbRetry(() =>
      prisma.purchaseOrder.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { items: true } },
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
    <div className="max-w-4xl mx-auto px-8 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Purchase Orders
        </h1>
        <p className="text-muted-foreground mt-1">
          All purchase orders across your organisation.
        </p>
      </header>

      {pos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No purchase orders yet.</p>
          <p className="text-sm mt-1">
            Complete and quote an RFQ first, then create a PO from it.
          </p>
        </div>
      ) : (
        <ul className="rounded-lg overflow-hidden border border-border border-l-[3px] border-l-slate-400 dark:border-l-slate-500 bg-card shadow-sm divide-y divide-border">
          {pos.map((po) => (
            <li key={po.id}>
              <Link
                href={`/po/${po.id}`}
                className="flex items-center justify-between pl-4 pr-5 py-3.5 hover:bg-accent/50 transition-colors"
              >
                <span className="font-medium text-card-foreground text-sm">
                  {po.poNumber}
                </span>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded uppercase ${
                    STATUS_STYLE[po.status] ?? "bg-[#274579]/10 text-[#274579]"
                  }`}
                >
                  {po.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
