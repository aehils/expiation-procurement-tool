import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DetailsView } from "@/components/rfq/details-view";
import type { DetailsItemPayload } from "@/components/rfq/item-detail-form";

export const dynamic = "force-dynamic";

export default async function RfqDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rfq = await prisma.rfq.findUnique({
    where: { id },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  if (!rfq) notFound();

  const items: DetailsItemPayload[] = rfq.items.map((it) => ({
    id: it.id,
    itemCategory: it.itemCategory,
    department: it.department,
    itemName: it.itemName,
    requestQuantity: it.requestQuantity,
    mProductCode: it.mProductCode,
    unitQuantity: it.unitQuantity,
    uom: it.uom,
    manufacturerName: it.manufacturerName,
    vendor: it.vendor,
    vendorLocation: it.vendorLocation,
    productLink: it.productLink,
    countryOfOrigin: it.countryOfOrigin,
    vendorDeliveryTimeline: it.vendorDeliveryTimeline,
    originalCurrency: it.originalCurrency,
    ogUnitPrice: it.ogUnitPrice,
    ogBoxPrice: it.ogBoxPrice,
    nairaUnitPrice: it.nairaUnitPrice,
    boxPrice: it.boxPrice,
    nairaOverridden: it.nairaOverridden,
    brand: it.brand,
  }));

  return (
    <DetailsView
      rfq={{
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
        requester: rfq.requester,
        status: rfq.status,
        createdAt: rfq.createdAt.toISOString(),
      }}
      initialItems={items}
    />
  );
}
