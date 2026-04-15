import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { EntryView, type InitialEntryItem } from "@/components/rfq/entry-view";

export const metadata = {
  title: "Edit RFQ • Expiation",
};

export const dynamic = "force-dynamic";

// Lets the user step back from the details view into the entry form with
// their existing requester + items pre-populated. Submitted RFQs are not
// editable — we bounce those straight back to the details page.
export default async function EditRfqPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ itemId?: string }>;
}) {
  const { id } = await params;
  const { itemId } = await searchParams;
  const rfq = await prisma.rfq.findUnique({
    where: { id },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  if (!rfq) notFound();
  if (rfq.status === "submitted") {
    redirect(`/rfq/${rfq.id}/details`);
  }

  const initialItems: InitialEntryItem[] = rfq.items.map((it) => ({
    id: it.id,
    itemCategory: it.itemCategory,
    department: it.department,
    itemName: it.itemName,
    itemDescription: it.itemDescription,
    requestQuantity: it.requestQuantity,
    size: it.size,
    specification: it.specification,
    brand: it.brand,
    model: it.model,
    additionalNotes: it.additionalNotes,
  }));

  // When arriving from the details view's per-item Edit button, auto-load
  // that item into the form so the user doesn't have to click Edit again.
  const initialEditItemId =
    itemId && initialItems.some((it) => it.id === itemId) ? itemId : undefined;

  return (
    <EntryView
      draftId={rfq.id}
      rfqNumber={rfq.rfqNumber}
      initialRequester={rfq.requester}
      initialItems={initialItems}
      mode="edit"
      initialEditItemId={initialEditItemId}
    />
  );
}
