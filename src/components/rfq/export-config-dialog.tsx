"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExportConfig } from "@/lib/export/types";
import { loadExportConfig, saveExportConfig } from "@/lib/export/format-config";
import { toast } from "sonner";

export function ExportConfigDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [config, setConfig] = React.useState<ExportConfig>(loadExportConfig);

  React.useEffect(() => {
    if (open) setConfig(loadExportConfig());
  }, [open]);

  function handleSave() {
    saveExportConfig(config);
    toast.success("Export settings saved");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">
            Export Settings
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Customize how exported quotes appear
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <Label htmlFor="headerText" className="text-xs font-medium">
              Header Text
            </Label>
            <Input
              id="headerText"
              value={config.headerText}
              onChange={(e) =>
                setConfig((p) => ({ ...p, headerText: e.target.value }))
              }
              placeholder="QUOTATION"
              className="mt-1 h-8 text-xs"
            />
          </div>

          <div>
            <Label htmlFor="footerText" className="text-xs font-medium">
              Footer Text
            </Label>
            <Input
              id="footerText"
              value={config.footerText}
              onChange={(e) =>
                setConfig((p) => ({ ...p, footerText: e.target.value }))
              }
              placeholder="Thank you for your business"
              className="mt-1 h-8 text-xs"
            />
          </div>

          <div>
            <Label htmlFor="terms" className="text-xs font-medium">
              Terms & Conditions
            </Label>
            <Textarea
              id="terms"
              value={config.termsAndConditions}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  termsAndConditions: e.target.value,
                }))
              }
              placeholder="Prices valid for 30 days..."
              rows={3}
              className="mt-1 text-xs resize-none"
            />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={config.showSubtotal}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, showSubtotal: e.target.checked }))
                }
                className="rounded border-slate-300"
              />
              Show Subtotal
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={config.showGrandTotal}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    showGrandTotal: e.target.checked,
                  }))
                }
                className="rounded border-slate-300"
              />
              Show Grand Total
            </label>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            style={{ backgroundColor: "#274579" }}
            className="text-white hover:opacity-90 text-xs"
          >
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
