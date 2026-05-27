import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CreatePoButton } from "@/components/po/create-po-button";

export const dynamic = "force-dynamic";

const RFQ_STATUS_LABEL: Record<string, string> = {
  details: "In Progress",
  quoted: "Quoted",
  ordered: "Ordered",
};

const RFQ_STATUS_STYLE: Record<string, string> = {
  quoted: "bg-[#274579]/10 text-[#274579]",
  ordered: "bg-emerald-100 text-emerald-700",
};

const PO_STATUS_STYLE: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700",
  issued: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-600",
};

export default async function HomePage() {
  const [recentRfqs, availableQuotes, recentPos] = await Promise.all([
    prisma.rfq.findMany({
      where: { status: { not: "draft" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { _count: { select: { items: true } } },
    }),
    prisma.rfq.findMany({
      where: {
        status: "quoted",
        purchaseOrders: { none: {} },
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
    prisma.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        _count: { select: { items: true } },
        rfq: { select: { requester: true } },
      },
    }),
  ]);

  const quoteOptions = availableQuotes.map((q) => ({
    id: q.id,
    rfqNumber: q.rfqNumber,
    requester: q.requester,
    itemCount: q._count.items,
    createdAt: q.createdAt.toISOString(),
  }));

  return (
    <main className="max-w-4xl mx-auto px-8 py-16">
      <header className="mb-12">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-800">
          Expiation Procurement
        </h1>
        <p className="text-slate-600 mt-2">
          Internal RFQ workflow tool — capture requests, source vendors,
          finalize quotes.
        </p>
      </header>

      <div className="flex items-center gap-3">
        <Link href="/rfq/new">
          <Button
            size="lg"
            style={{ backgroundColor: "#274579" }}
            className="text-white hover:opacity-90"
          >
            Start a new RFQ
          </Button>
        </Link>
        <CreatePoButton quotes={quoteOptions} />
      </div>

      {recentRfqs.length > 0 && (
        <section className="mt-16">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Recent RFQs
          </h2>
          <ul className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200 shadow-sm">
            {recentRfqs.map((rfq) => (
              <li key={rfq.id}>
                <Link
                  href={
                    rfq.status === "ordered"
                      ? `/rfq/${rfq.id}/quote`
                      : `/rfq/${rfq.id}/details`
                  }
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
                >
                  <div>
                    <div className="font-medium text-slate-800">
                      {rfq.rfqNumber}
                    </div>
                    <div className="text-sm text-slate-500">
                      {rfq.requester} &middot; {rfq._count.items} item
                      {rfq._count.items === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded uppercase ${
                      RFQ_STATUS_STYLE[rfq.status] ??
                      "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {RFQ_STATUS_LABEL[rfq.status] ?? rfq.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recentPos.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Recent Purchase Orders
          </h2>
          <ul className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200 shadow-sm">
            {recentPos.map((po) => (
              <li key={po.id}>
                <Link
                  href={`/po/${po.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
                >
                  <div>
                    <div className="font-medium text-slate-800">
                      {po.poNumber}
                    </div>
                    <div className="text-sm text-slate-500">
                      {po.rfq.requester} &middot; {po._count.items} item
                      {po._count.items === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded uppercase ${
                      PO_STATUS_STYLE[po.status] ??
                      "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {po.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
