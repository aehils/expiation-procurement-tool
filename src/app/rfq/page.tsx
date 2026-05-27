import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  details: "In Progress",
  quoted: "Quoted",
  ordered: "Ordered",
};

const STATUS_STYLE: Record<string, string> = {
  quoted: "bg-[#274579]/10 text-[#274579]",
  ordered: "bg-emerald-100 text-emerald-700",
};

export default async function RfqListPage() {
  const rfqs = await prisma.rfq.findMany({
    where: { status: { not: "draft" } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Requests for Quotation
        </h1>
        <p className="text-muted-foreground mt-1">
          All RFQs across your organisation.
        </p>
      </header>

      <Link
        href="/rfq/new"
        className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-md text-sm font-medium bg-[#274579] text-white hover:opacity-90 transition-opacity mb-8"
      >
        New RFQ
      </Link>

      {rfqs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No RFQs yet.</p>
          <Link
            href="/rfq/new"
            className="text-primary hover:underline mt-2 inline-block"
          >
            Start your first RFQ
          </Link>
        </div>
      ) : (
        <ul className="bg-card border border-border rounded-lg divide-y divide-border shadow-sm">
          {rfqs.map((rfq) => (
            <li key={rfq.id}>
              <Link
                href={
                  rfq.status === "ordered"
                    ? `/rfq/${rfq.id}/quote`
                    : `/rfq/${rfq.id}/details`
                }
                className="flex items-center justify-between px-5 py-4 hover:bg-accent/50 transition-colors"
              >
                <div>
                  <div className="font-medium text-card-foreground">
                    {rfq.rfqNumber}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {rfq.requester} &middot; {rfq._count.items} item
                    {rfq._count.items === 1 ? "" : "s"}
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded uppercase ${
                    STATUS_STYLE[rfq.status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {STATUS_LABEL[rfq.status] ?? rfq.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
