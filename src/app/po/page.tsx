import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700",
  issued: "bg-emerald-100 text-emerald-700",
  closed: "bg-muted text-muted-foreground",
};

const getPos = unstable_cache(
  async () => {
    return prisma.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { items: true } },
        rfq: { select: { requester: true } },
      },
    });
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
        <ul className="bg-card border border-border rounded-lg divide-y divide-border shadow-sm">
          {pos.map((po) => (
            <li key={po.id}>
              <Link
                href={`/po/${po.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-accent/50 transition-colors"
              >
                <div>
                  <div className="font-medium text-card-foreground">
                    {po.poNumber}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {po.rfq.requester} &middot; {po._count.items} item
                    {po._count.items === 1 ? "" : "s"}
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded uppercase ${
                    STATUS_STYLE[po.status] ?? "bg-muted text-muted-foreground"
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
