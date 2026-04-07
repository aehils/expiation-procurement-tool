import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const recentRfqs = await prisma.rfq.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { _count: { select: { items: true } } },
  });

  return (
    <main className="max-w-4xl mx-auto px-8 py-16">
      <header className="mb-12">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-800">
          Expiation Procurement
        </h1>
        <p className="text-slate-600 mt-2">
          Internal RFQ workflow tool — capture requests, source vendors, finalize quotes.
        </p>
      </header>

      <Link href="/rfq/new">
        <Button
          size="lg"
          style={{ backgroundColor: "#274579" }}
          className="text-white hover:opacity-90"
        >
          Start a new RFQ
        </Button>
      </Link>

      {recentRfqs.length > 0 && (
        <section className="mt-16">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
            Recent RFQs
          </h2>
          <ul className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200 shadow-sm">
            {recentRfqs.map((rfq) => (
              <li key={rfq.id}>
                <Link
                  href={`/rfq/${rfq.id}/details`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
                >
                  <div>
                    <div className="font-medium text-slate-800">{rfq.rfqNumber}</div>
                    <div className="text-sm text-slate-500">
                      {rfq.requester} • {rfq._count.items} item
                      {rfq._count.items === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded uppercase ${
                      rfq.status === "submitted"
                        ? "bg-teal-100 text-teal-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {rfq.status}
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
