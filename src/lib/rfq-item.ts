import type { RfqItem } from "@prisma/client";
import type { DetailsItemPayload } from "@/components/rfq/item-detail-form";

// Maps a persisted RfqItem row to the payload shape the quote/export UI expects.
export function toDetailsPayload(it: RfqItem): DetailsItemPayload {
  return {
    id: it.id,
    itemCategory: it.itemCategory ?? null,
    department: it.department ?? null,
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
    nairaUnitPrice: it.nairaUnitPrice,
    nairaOverridden: it.nairaOverridden,
    tax: it.tax,
    taxMode: (it.taxMode as "amount" | "percent" | null) ?? null,
    domesticShippingCost: it.domesticShippingCost,
    domesticShippingNaira: it.domesticShippingNaira,
    intlShippingCost: it.intlShippingCost,
    intlShippingNaira: it.intlShippingNaira,
    brand: it.brand,
    markedComplete: it.markedComplete,
  };
}
