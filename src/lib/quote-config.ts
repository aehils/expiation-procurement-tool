import { quoteConfigSchema, type QuoteConfig } from "./schemas";

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
