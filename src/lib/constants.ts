// Static lookup lists for the RFQ workflow.
// Kept here so the entry view and details view share one source.

export type Option = { value: string; label: string };

export const CATEGORIES: Option[] = [
  { value: "surgical-instruments", label: "Surgical Instruments" },
  { value: "consumables", label: "Consumables" },
  { value: "diagnostic-equipment", label: "Diagnostic Equipment" },
  { value: "laboratory-supplies", label: "Laboratory Supplies" },
  { value: "patient-care", label: "Patient Care Items" },
  { value: "imaging-radiology", label: "Imaging & Radiology" },
  { value: "monitoring-devices", label: "Monitoring Devices" },
  { value: "pharmaceuticals", label: "Pharmaceuticals" },
  { value: "implants-prosthetics", label: "Implants & Prosthetics" },
  { value: "sterilization", label: "Sterilization & Disinfection" },
  { value: "other", label: "Other" },
];

export const DEPARTMENTS: Option[] = [
  { value: "operating-room", label: "Operating Room" },
  { value: "icu", label: "ICU / Critical Care" },
  { value: "emergency", label: "Emergency Department" },
  { value: "laboratory", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "cardiology", label: "Cardiology" },
  { value: "pediatrics", label: "Pediatrics" },
  { value: "general-ward", label: "General Ward" },
  { value: "dialysis", label: "Dialysis Unit" },
  { value: "other", label: "Other" },
];

export const UNITS_OF_MEASURE: Option[] = [
  { value: "piece", label: "Piece" },
  { value: "box", label: "Box" },
  { value: "pack", label: "Pack" },
  { value: "case", label: "Case" },
  { value: "vial", label: "Vial" },
  { value: "bottle", label: "Bottle" },
  { value: "ampoule", label: "Ampoule" },
  { value: "kit", label: "Kit" },
  { value: "roll", label: "Roll" },
  { value: "pair", label: "Pair" },
];

export const CURRENCIES: Option[] = [
  { value: "NGN", label: "NGN — Nigerian Naira" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "CNY", label: "CNY — Chinese Yuan" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "ZAR", label: "ZAR — South African Rand" },
  { value: "AED", label: "AED — UAE Dirham" },
];

// Currencies surfaced in the conversion banner on the details view. Shared
// with the server action that refreshes + persists rates, so both sides agree
// on which codes to pull.
export const BANNER_CURRENCIES: { code: string; name: string; symbol: string }[] = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
];

// Fields the user must fill on the details page before an RFQ can be submitted.
export const REQUIRED_DETAIL_FIELDS = [
  "mProductCode",
  "unitQuantity",
  "uom",
  "vendor",
  "originalCurrency",
  "ogUnitPrice",
  "nairaUnitPrice",
] as const;

export type RequiredDetailField = (typeof REQUIRED_DETAIL_FIELDS)[number];

// Total fields a user can fill on the details view, used for the per-item progress indicator.
export const TOTAL_DETAIL_FIELDS = 14;

export function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function departmentLabel(value: string): string {
  return DEPARTMENTS.find((d) => d.value === value)?.label ?? value;
}
