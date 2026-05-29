import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

const STATUS_LABEL: Record<string, string> = {
  details: "In Progress",
  quoted: "Quoted",
  ordered: "Ordered",
};

const STATUS_STYLE: Record<string, string> = {
  quoted: "bg-[#274579]/10 text-[#274579]",
  ordered: "bg-[#274579]/10 text-[#274579]",
};

const getRfqs = unstable_cache(
  async () => {
    return prisma.rfq.findMany({
      where: { status: { not: "draft" } },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    });
  },
  ["rfq-list"],
  { tags: ["rfqs"] },
);

export default async function RfqListPage() {
  const rfqs = await getRfqs();

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
        <ul className="rounded-lg overflow-hidden border border-border border-l-[3px] border-l-slate-400 dark:border-l-slate-500 bg-card shadow-sm divide-y divide-border">
          {rfqs.map((rfq) => (
            <li key={rfq.id}>
              <Link
                href={
                  rfq.status === "ordered"
                    ? `/rfq/${rfq.id}/quote`
                    : `/rfq/${rfq.id}/details`
                }
                className="flex items-center justify-between pl-4 pr-5 py-3.5 hover:bg-accent/50 transition-colors"
              >
                <span className="font-medium text-card-foreground text-sm">
                  {rfq.rfqNumber}
                </span>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded uppercase ${
                    STATUS_STYLE[rfq.status] ?? "bg-[#274579]/10 text-[#274579]"
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
