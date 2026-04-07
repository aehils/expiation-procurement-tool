import { NextResponse } from "next/server";
import { fetchRate } from "@/lib/rates";

// Next 15 no longer caches GET route handlers by default; be explicit since this
// route proxies an external API whose freshness is controlled by `fetchRate` itself.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base") ?? "USD";
  const force = searchParams.get("force") === "1";
  const result = await fetchRate(base, { force });
  return NextResponse.json(result);
}
