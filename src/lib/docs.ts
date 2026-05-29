export type DocType = "rfq" | "quote" | "po";

export type DocRef = {
  type: DocType;
  id: string;
  label: string;
  sublabel: string;
  href: string;
};

// RFQ routing depends on status: an ordered RFQ shows its read-only quote,
// everything else opens the editable details view. Mirrors src/app/rfq/page.tsx.
export function rfqHref(id: string, status: string): string {
  return status === "ordered" ? `/rfq/${id}/quote` : `/rfq/${id}/details`;
}

// Readable base32 alphabet shared with the random doc-number suffix
// (`customAlphabet` in src/lib/actions.ts). Excludes 0/1/I/O.
export const DOC_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// FNV-1a 32-bit. Deterministic, non-cryptographic — good enough for collapsing
// a date string into a short visual fingerprint.
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Compresses a date into 4 chars of the readable alphabet. Same UTC day always
// hashes to the same 4 chars, so documents created together still cluster
// visually, but the result isn't sortable by date.
export function hashDateToBase32(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  let n = fnv1a32(`${yyyy}${mm}${dd}`) % (32 ** 4);
  let out = "";
  for (let i = 0; i < 4; i++) {
    out = DOC_ID_ALPHABET[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

// A quote's number mirrors its RFQ's number with the 2-char prefix swapped.
// Consolidated here so callers don't reach for ad-hoc string replaces.
export function quoteNumberFromRfq(rfqNumber: string): string {
  return `QU${rfqNumber.slice(2)}`;
}
