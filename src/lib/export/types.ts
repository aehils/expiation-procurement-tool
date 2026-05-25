import type { DetailsItemPayload } from "@/components/rfq/item-detail-form";
import { categoryLabel } from "@/lib/constants";

export type ColKey =
  | "requestQuantity"
  | "vendor"
  | "nairaUnitPrice"
  | "totalPrice"
  | "uom"
  | "brand"
  | "mProductCode"
  | "manufacturerName"
  | "vendorDeliveryTimeline"
  | "countryOfOrigin"
  | "itemCategory"
  | "vendorLocation";

export const COLUMNS: { key: ColKey; label: string; defaultOn: boolean; wrap?: boolean }[] = [
  { key: "requestQuantity", label: "Qty", defaultOn: true },
  { key: "vendor", label: "Vendor", defaultOn: true },
  { key: "uom", label: "UOM", defaultOn: false },
  { key: "brand", label: "Brand", defaultOn: false },
  { key: "mProductCode", label: "Product Code", defaultOn: false },
  { key: "manufacturerName", label: "Manufacturer", defaultOn: false },
  { key: "vendorDeliveryTimeline", label: "Lead Time", defaultOn: false, wrap: true },
  { key: "countryOfOrigin", label: "Country of Origin", defaultOn: false },
  { key: "itemCategory", label: "Category", defaultOn: false },
  { key: "vendorLocation", label: "Vendor Location", defaultOn: false },
  { key: "nairaUnitPrice", label: "Unit Price", defaultOn: true },
  { key: "totalPrice", label: "Total Price", defaultOn: true },
];

export function lineTotalNaira(item: DetailsItemPayload): number | null {
  if (item.nairaUnitPrice == null) return null;
  const qty = item.requestQuantity || 0;
  const unit = item.nairaUnitPrice;
  const taxPerUnit =
    item.tax == null
      ? 0
      : item.taxMode === "percent"
        ? unit * (item.tax / 100)
        : item.tax;
  const domPerUnit =
    qty > 0 && item.domesticShippingNaira != null
      ? item.domesticShippingNaira / qty
      : 0;
  const intlPerUnit =
    qty > 0 && item.intlShippingNaira != null
      ? item.intlShippingNaira / qty
      : 0;
  return (unit + taxPerUnit + domPerUnit + intlPerUnit) * qty;
}

export function formatNaira(v: number | null | undefined): string {
  if (v == null) return "—";
  return `₦${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function cellValueRaw(
  item: DetailsItemPayload,
  key: ColKey,
  markupFactor: number,
): string | number | null {
  switch (key) {
    case "nairaUnitPrice":
      return item.nairaUnitPrice != null
        ? item.nairaUnitPrice * markupFactor
        : null;
    case "totalPrice": {
      const total = lineTotalNaira(item);
      return total != null ? total * markupFactor : null;
    }
    case "requestQuantity":
      return item.requestQuantity;
    case "itemCategory":
      return categoryLabel(item.itemCategory);
    case "brand":
      return item.brand ?? null;
    case "vendor":
      return item.vendor ?? null;
    case "uom":
      return item.uom ?? null;
    case "mProductCode":
      return item.mProductCode ?? null;
    case "manufacturerName":
      return item.manufacturerName ?? null;
    case "vendorDeliveryTimeline":
      return item.vendorDeliveryTimeline ?? null;
    case "countryOfOrigin":
      return item.countryOfOrigin ?? null;
    case "vendorLocation":
      return item.vendorLocation ?? null;
  }
}

export type ExportConfig = {
  companyName: string;
  logoDataUrl: string | null;
  headerText: string;
  footerText: string;
  termsAndConditions: string;
  showSubtotal: boolean;
  showGrandTotal: boolean;
};

export type ExportQuoteData = {
  quoteNumber: string;
  rfqNumber: string;
  requester: string;
  items: DetailsItemPayload[];
  selectedItemIds: Set<string>;
  enabledColumns: ColKey[];
  markupFactor: number;
};
