import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/db";

// Trivial query for an external cron (Vercel Cron, GitHub Actions, cron-job.org)
// to hit every 5–10 minutes so Turso never sleeps long enough to cold-start a
// real user request. The retry self-heals if the DB happens to be asleep when
// the cron fires.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.KEEPALIVE_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    await withDbRetry(() => prisma.$queryRaw`SELECT 1`);
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 503 },
    );
  }
}
