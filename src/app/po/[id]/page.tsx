import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PoView } from "@/components/po/po-view";

export const dynamic = "force-dynamic";

export default async function PoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      rfq: { select: { rfqNumber: true, requester: true } },
    },
  });

  if (!po) notFound();

  return (
    <PoView
      po={{
        id: po.id,
        poNumber: po.poNumber,
        rfqId: po.rfqId,
        status: po.status,
        notes: po.notes,
        markupFactor: po.markupFactor,
        createdAt: po.createdAt.toISOString(),
        items: po.items.map((it) => ({
          id: it.id,
          rfqItemId: it.rfqItemId,
          itemName: it.itemName,
          itemCategory: it.itemCategory,
          department: it.department,
          vendor: it.vendor,
          vendorLocation: it.vendorLocation,
          brand: it.brand,
          mProductCode: it.mProductCode,
          manufacturerName: it.manufacturerName,
          uom: it.uom,
          countryOfOrigin: it.countryOfOrigin,
          vendorDeliveryTimeline: it.vendorDeliveryTimeline,
          quantity: it.quantity,
          nairaUnitPrice: it.nairaUnitPrice,
          taxAmount: it.taxAmount,
          domesticShippingNaira: it.domesticShippingNaira,
          intlShippingNaira: it.intlShippingNaira,
          totalPerUnit: it.totalPerUnit,
          lineTotal: it.lineTotal,
        })),
        rfq: po.rfq,
      }}
    />
  );
}
