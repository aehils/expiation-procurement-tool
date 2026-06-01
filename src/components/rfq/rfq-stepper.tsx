"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const STEPS = [
  { num: 1, label: "Add Items" },
  { num: 2, label: "Add Details" },
] as const;

export function RfqStepper({
  currentStep,
  rfqId,
}: {
  currentStep: 1 | 2;
  rfqId?: string;
}) {
  const hrefs: Record<1 | 2, string | undefined> = {
    1: rfqId ? `/rfq/${rfqId}/edit` : undefined,
    2: rfqId ? `/rfq/${rfqId}/details` : undefined,
  };

  return (
    <nav aria-label="RFQ progress" className="flex items-center gap-2.5">
      {STEPS.map((step, i) => {
        const isCurrent = step.num === currentStep;
        const href = hrefs[step.num];
        const reachable = !!href && !isCurrent;

        const inner = (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 select-none transition-colors",
              isCurrent
                ? "text-[#274579]"
                : reachable
                  ? "text-slate-500 hover:text-slate-800"
                  : "text-slate-300",
            )}
          >
            <span
              className={cn(
                "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold transition-colors",
                isCurrent
                  ? "bg-[#274579] text-white"
                  : reachable
                    ? "border border-slate-300 text-slate-500 group-hover:border-slate-400"
                    : "border border-slate-200 text-slate-300",
              )}
            >
              {step.num}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
              {step.label}
            </span>
          </span>
        );

        return (
          <React.Fragment key={step.num}>
            {reachable ? (
              <Link
                href={href!}
                className="group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                {inner}
              </Link>
            ) : (
              <span
                aria-current={isCurrent ? "step" : undefined}
                aria-disabled={!isCurrent || undefined}
              >
                {inner}
              </span>
            )}
            {i < STEPS.length - 1 && (
              <span aria-hidden="true" className="h-px w-6 bg-slate-300" />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
