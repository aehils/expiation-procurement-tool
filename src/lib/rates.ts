// Exchange rate fetcher backed by open.er-api.com (free, no API key, supports NGN).
// Wrapped in Next's fetch cache so we don't hammer the upstream every render.

export type RateResult = {
  base: string;
  rate: number;
  fetchedAt: string;
};

export type RateError = {
  base: string;
  error: string;
};

export async function fetchRate(
  base: string,
  opts: { force?: boolean } = {},
): Promise<RateResult | RateError> {
  const upper = base.toUpperCase();
  if (upper === "NGN") {
    return { base: "NGN", rate: 1, fetchedAt: new Date().toISOString() };
  }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${upper}`, {
      // Force a fresh hit when the user clicks "refresh"; otherwise let Next cache for 10 min.
      ...(opts.force ? { cache: "no-store" as const } : { next: { revalidate: 600 } }),
    });
    if (!res.ok) {
      return { base: upper, error: `Upstream returned ${res.status}` };
    }
    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    if (data.result !== "success" || !data.rates || typeof data.rates.NGN !== "number") {
      return { base: upper, error: "Rate API returned unexpected payload" };
    }
    return {
      base: upper,
      rate: data.rates.NGN,
      fetchedAt: data.time_last_update_utc ?? new Date().toISOString(),
    };
  } catch (err) {
    return {
      base: upper,
      error: err instanceof Error ? err.message : "Unknown error fetching rate",
    };
  }
}
