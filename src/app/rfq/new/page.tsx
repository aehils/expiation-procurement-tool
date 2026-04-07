import { EntryView } from "@/components/rfq/entry-view";
import { createDraftRfq } from "@/lib/actions";

export const metadata = {
  title: "New RFQ • Expiation",
};

// Render as dynamic so each visit reserves a fresh draft RFQ number.
export const dynamic = "force-dynamic";

export default async function NewRfqPage() {
  const draft = await createDraftRfq();
  return <EntryView draftId={draft.id} rfqNumber={draft.rfqNumber} />;
}
