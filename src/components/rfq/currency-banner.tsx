"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { BANNER_CURRENCIES } from "@/lib/constants";

export type RateInfo = { rate: number; fetchedAt: string; error?: string };

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

type Props = {
  rates: Record<string, RateInfo>;
  freshness: string | undefined;
  refreshing: boolean;
  onRefresh: () => void;
};

// Subtle strip of currency → Naira conversions. Shrinks to wrap only its
// contents; leads with a refresh button that also doubles as the freshness
// label. Colours are intentionally low-contrast so the strip recedes.
export function CurrencyBanner({ rates, freshness, refreshing, onRefresh }: Props) {
  // Re-render the freshness label every 30s so "Updated now" ticks to
  // "Updated 1m ago" without the user having to interact.
  const [, forceTick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const id = setInterval(forceTick, 30_000);
    return () => clearInterval(id);
  }, []);

  const label = refreshing
    ? "Updating…"
    : freshness
      ? relativeTime(freshness)
      : "Not yet updated";

  return (
    <div className="flex h-8 w-fit flex-nowrap items-center gap-x-3 rounded-md bg-slate-50/50 px-2.5 whitespace-nowrap">
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors disabled:cursor-wait disabled:opacity-60"
        aria-label="Refresh currency rates"
      >
        <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
        <span className="tabular-nums">{label}</span>
      </button>
      {BANNER_CURRENCIES.map((c) => {
        const info = rates[c.code];
        return (
          <div key={c.code} className="flex items-baseline gap-1 tabular-nums">
            <span className="text-xs font-medium text-slate-400">{c.symbol}</span>
            {info?.error ? (
              <span className="text-[11px] text-amber-600/80">unavailable</span>
            ) : info ? (
              <span className="text-xs text-slate-500">
                ₦{info.rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            ) : (
              <span className="inline-block w-12 h-3 rounded bg-slate-200/60 animate-pulse" />
            )}
          </div>
        );
      })}
    </div>
  );
}
