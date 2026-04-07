import { NextResponse } from "next/server";
import { fetchRate } from "@/lib/rates";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base") ?? "USD";
  const force = searchParams.get("force") === "1";
  const result = await fetchRate(base, { force });
  return NextResponse.json(result);
}
