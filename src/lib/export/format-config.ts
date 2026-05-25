import type { ExportConfig } from "./types";

const STORAGE_KEY = "quote-export-config";

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  companyName: "",
  logoDataUrl: null,
  headerText: "QUOTATION",
  footerText: "",
  termsAndConditions: "",
  showSubtotal: false,
  showGrandTotal: true,
};

export function loadExportConfig(): ExportConfig {
  if (typeof window === "undefined") return DEFAULT_EXPORT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EXPORT_CONFIG;
    return { ...DEFAULT_EXPORT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_EXPORT_CONFIG;
  }
}

export function saveExportConfig(config: ExportConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
