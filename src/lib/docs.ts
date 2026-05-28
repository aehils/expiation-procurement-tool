export type DocType = "rfq" | "po";

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
