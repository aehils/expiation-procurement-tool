import { quoteConfigSchema, type QuoteConfig } from "./schemas";

// Safely decode the JSON `config` string stored on a Quote row. Returns null
// for missing/garbage data so callers can fall back to defaults.
export function parseQuoteConfig(raw: string | null | undefined): QuoteConfig | null {
  if (!raw) return null;
  try {
    const parsed = quoteConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function encodeQuoteConfig(config: QuoteConfig): string {
  return JSON.stringify(config);
}
