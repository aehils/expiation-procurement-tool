import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PoCreationView } from "@/components/po/po-creation-view";

export const dynamic = "force-dynamic";

export default async function NewPoPage({
  searchParams,
}: {
  searchParams: Promise<{ rfqId?: string }>;
}) {
  const { rfqId } = await searchParams;
  if (!rfqId) redirect("/");

  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    include: {
      items: { where: { markedComplete: true } },
      purchaseOrders: { select: { id: true } },
    },
  });

  if (!rfq || rfq.status !== "quoted") redirect("/");
  if (rfq.purchaseOrders.length > 0) redirect("/");

  const items = rfq.items.map((it) => ({
    id: it.id,
    itemName: it.itemName,
    itemCategory: it.itemCategory,
    department: it.department,
    requestQuantity: it.requestQuantity,
    vendor: it.vendor,
    vendorLocation: it.vendorLocation,
    brand: it.brand,
    mProductCode: it.mProductCode,
    manufacturerName: it.manufacturerName,
    uom: it.uom,
    countryOfOrigin: it.countryOfOrigin,
    vendorDeliveryTimeline: it.vendorDeliveryTimeline,
    nairaUnitPrice: it.nairaUnitPrice,
    tax: it.tax,
    taxMode: it.taxMode,
    domesticShippingNaira: it.domesticShippingNaira,
    intlShippingNaira: it.intlShippingNaira,
  }));

  return (
    <PoCreationView
      rfq={{ id: rfq.id, rfqNumber: rfq.rfqNumber, requester: rfq.requester }}
      items={items}
    />
  );
}
