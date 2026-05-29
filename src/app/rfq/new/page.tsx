import { EntryView } from "@/components/rfq/entry-view";
import { previewRfqNumber } from "@/lib/actions";

export const metadata = {
  title: "New RFQ • Expiation",
};

// Render as dynamic so each visit reserves a fresh candidate RFQ number.
// No DB row is created here — createRfq commits on submit.
export const dynamic = "force-dynamic";

export default async function NewRfqPage() {
  const { rfqNumber } = await previewRfqNumber();
  return <EntryView rfqNumber={rfqNumber} />;
}
