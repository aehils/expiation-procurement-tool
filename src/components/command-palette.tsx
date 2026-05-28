"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Package } from "lucide-react";
import { searchDocuments } from "@/lib/actions";
import type { DocRef } from "@/lib/docs";

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<DocRef[]>([]);
  const [active, setActive] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  // Reset and focus whenever the palette opens.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActive(0);
      // Focus after paint so the input exists.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced search.
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { rfqs, pos } = await searchDocuments(q);
        if (!cancelled) {
          setResults([...rfqs, ...pos]);
          setActive(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  if (!open) return null;

  const go = (doc: DocRef) => {
    onClose();
    router.push(doc.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const doc = results[active];
      if (doc) go(doc);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-xl mx-4 rounded-lg border border-border bg-card shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search size={18} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search RFQs and purchase orders…"
            className="flex-1 bg-transparent py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {query.trim() === "" ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Type an RFQ/PO number or requester name to jump straight there.
            </p>
          ) : loading && results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matches for “{query.trim()}”.
            </p>
          ) : (
            <ul>
              {results.map((doc, i) => {
                const Icon = doc.type === "rfq" ? FileText : Package;
                return (
                  <li key={`${doc.type}-${doc.id}`}>
                    <button
                      type="button"
                      onClick={() => go(doc)}
                      onMouseEnter={() => setActive(i)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === active ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                    >
                      <Icon size={16} className="shrink-0 text-muted-foreground" />
                      <span className="font-medium text-sm text-card-foreground">
                        {doc.label}
                      </span>
                      {doc.sublabel && (
                        <span className="truncate text-xs text-muted-foreground">
                          {doc.sublabel}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
