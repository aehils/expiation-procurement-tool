"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { QuoteSelectDialog } from "./quote-select-dialog";

type QuoteOption = {
  id: string;
  rfqNumber: string;
  requester: string;
  itemCount: number;
  createdAt: string;
};

export function CreatePoButton({ quotes }: { quotes: QuoteOption[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        size="lg"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-[#274579] text-[#274579] hover:bg-[#274579]/5"
      >
        Create Purchase Order
      </Button>
      <QuoteSelectDialog
        quotes={quotes}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
