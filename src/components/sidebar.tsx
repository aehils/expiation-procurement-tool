"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  ReceiptText,
  Package,
  User,
  Settings,
  Plus,
  Sun,
  Moon,
  Monitor,
  SunMoon,
  Search,
  ChevronRight,
  Pin,
} from "lucide-react";
import { useTheme, type Theme } from "./theme-provider";
import { useCommandPalette } from "./command-palette-context";
import { getRecentDocuments } from "@/lib/actions";
import type { DocRef } from "@/lib/docs";
import { usePinnedDocs, togglePin, isPinned } from "@/lib/pinned-docs";

type RecentDocs = { rfqs: DocRef[]; quotes: DocRef[]; pos: DocRef[] };

const SECTIONS = [
  { key: "rfqs", href: "/rfq", label: "RFQs", icon: FileText },
  { key: "quotes", href: "/quotes", label: "Quotes", icon: ReceiptText },
  { key: "pos", href: "/po", label: "Purchase Orders", icon: Package },
] as const;

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Match System", icon: Monitor },
  { value: "low-light", label: "Low Light", icon: Moon },
  { value: "bright", label: "Bright", icon: Sun },
];

const EXPANDED_KEY = "sidebar-expanded";
const RECENT_CACHE_KEY = "sidebar-recent-cache";
const EMPTY_RECENT: RecentDocs = { rfqs: [], quotes: [], pos: [] };

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const openPalette = useCommandPalette();
  const pinned = usePinnedDocs();
  const [themeOpen, setThemeOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [recent, setRecent] = React.useState<RecentDocs>(EMPTY_RECENT);

  // Seed from cached values after hydration so the previous list (and which
  // sections were open) appear instantly instead of flashing empty for ~1.5s
  // while the server fetch resolves.
  React.useEffect(() => {
    try {
      const rawExpanded = localStorage.getItem(EXPANDED_KEY);
      if (rawExpanded) setExpanded(new Set(JSON.parse(rawExpanded) as string[]));
      const rawRecent = localStorage.getItem(RECENT_CACHE_KEY);
      if (rawRecent) setRecent(JSON.parse(rawRecent) as RecentDocs);
    } catch {
      // ignore malformed values
    }
  }, []);

  // Refresh recents on every navigation so newly created/edited docs surface.
  // Don't clear `recent` while the fetch is in flight — keep showing the
  // cached list, then swap in the fresh result once it arrives.
  React.useEffect(() => {
    let cancelled = false;
    getRecentDocuments().then((r) => {
      if (cancelled) return;
      setRecent(r);
      try {
        localStorage.setItem(RECENT_CACHE_KEY, JSON.stringify(r));
      } catch {
        // ignore quota errors — cache is a convenience
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const toggleSection = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const isActive = (href: string) => pathname === href;

  return (
    <aside className="flex flex-col h-screen w-56 shrink-0 bg-[#273042] dark:bg-[#0f1219] text-slate-300">
      {/* Header */}
      <div className="flex flex-row items-end justify-center h-20 px-2 gap-2 border-b border-white/[0.06] pb-4">
        <Link
          href="/new"
          title="New"
          className="flex items-center justify-center rounded-lg bg-[#2d5fbd] hover:bg-white/[0.92] text-white hover:text-blue-600 font-medium transition-colors w-40 h-9 px-3"
        >
          <Plus size={16} strokeWidth={3} className="shrink-0" />
          <span className="whitespace-nowrap text-sm font-semibold uppercase pl-3">New</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {/* Search */}
        <button
          onClick={openPalette}
          className="flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium bg-white/[0.05] border border-white/[0.12] hover:bg-white/[0.09] hover:text-white transition-colors"
          title="Search (Ctrl/Cmd + K)"
        >
          <Search size={16} className="shrink-0 text-slate-400" />
          <span className="flex-1 whitespace-nowrap pl-3 text-left">Search</span>
          <kbd className="text-[10px] text-slate-500 font-sans">⌘K</kbd>
        </button>

        {/* Pinned */}
        {pinned.length > 0 && (
          <div className="pt-2">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Pinned
            </p>
            <div className="space-y-0.5">
              {pinned.map((doc) => (
                <DocRow key={`${doc.type}-${doc.id}`} doc={doc} pinned active={pathname.includes(doc.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="pt-2 space-y-1">
          {SECTIONS.map((section) => {
            const active = isActive(section.href);
            const isOpen = expanded.has(section.key);
            const docs = recent[section.key];
            return (
              <div key={section.key}>
                <div
                  className={`flex items-center rounded-lg text-sm font-medium ${
                    active ? "bg-[#497DE2]/20 text-slate-100" : ""
                  }`}
                >
                  <Link
                    href={section.href}
                    className={`flex items-center flex-1 min-w-0 px-3 py-2.5 transition-colors ${
                      active
                        ? ""
                        : "hover:text-blue-300 hover:[text-shadow:0.3px_0_0_currentColor,-0.3px_0_0_currentColor]"
                    }`}
                    title={section.label}
                  >
                    <section.icon size={20} className="shrink-0" />
                    <span className="whitespace-nowrap pl-3">{section.label}</span>
                  </Link>
                  <button
                    onClick={() => toggleSection(section.key)}
                    className="p-2 mr-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
                    title={isOpen ? "Collapse" : "Expand"}
                    aria-label={isOpen ? `Collapse ${section.label}` : `Expand ${section.label}`}
                  >
                    <ChevronRight
                      size={16}
                      className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-0.5 ml-[15px]">
                    {docs.length === 0 ? (
                      <div className="relative flex items-stretch">
                        <div className="relative w-[14px] shrink-0">
                          <div className="absolute top-0 bottom-1/2 left-[6px] w-[1.5px] -translate-x-1/2 bg-white/[0.12]" />
                          <div className="absolute top-1/2 left-[6px] w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#273042] dark:bg-[#0f1219] ring-[1.5px] ring-white/40 z-10" />
                        </div>
                        <p className="py-1.5 pl-2 text-xs text-slate-600">No Recents</p>
                      </div>
                    ) : (
                      docs.map((doc, idx) => {
                        const isLast = idx === docs.length - 1;
                        return (
                          <div key={`${doc.type}-${doc.id}`} className="relative flex items-stretch">
                            {/* Timeline connector */}
                            <div className="relative w-[14px] shrink-0">
                              {/* Line: top of item down to bullet center */}
                              <div className="absolute top-0 bottom-1/2 left-[6px] w-[1.5px] -translate-x-1/2 bg-white/[0.28]" />
                              {/* Bullet — solid bg masks the line behind it */}
                              <div className="absolute top-1/2 left-[6px] w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3a4a63] dark:bg-[#1e2535] ring-[1.5px] ring-white/80 z-10" />
                              {/* Line: bullet center down to bottom of item — only for non-last items */}
                              {!isLast && (
                                <div className="absolute top-1/2 bottom-0 left-[6px] w-[1.5px] -translate-x-1/2 bg-white/[0.28]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <DocRow
                                doc={doc}
                                pinned={isPinned(doc.type, doc.id)}
                                active={pathname.includes(doc.id)}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="relative px-2 pb-3 border-t border-white/[0.06] pt-2.5 space-y-0.5">

        {/* Settings + Theme row */}
        <div className="flex flex-row items-center gap-1">
          <button
            className="flex items-center flex-1 min-w-0 px-2 py-1.5 rounded-lg hover:text-blue-400 transition-colors"
            title="Settings"
          >
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <Settings size={21} />
            </div>
            <span className="whitespace-nowrap uppercase text-xs tracking-wider pl-2">Settings</span>
          </button>

          <button
            onClick={() => setThemeOpen(!themeOpen)}
            className={`p-2 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors shrink-0 ${
              themeOpen ? "bg-white/[0.06] text-white" : ""
            }`}
            title="Theme"
          >
            <SunMoon size={21} />
          </button>
        </div>

        {themeOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setThemeOpen(false)} />
            <div className="absolute bottom-full left-2 right-2 mb-1 z-50 rounded-lg bg-[#1e2a3a] dark:bg-[#161d2a] border border-white/[0.08] shadow-lg p-1.5 space-y-0.5">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setTheme(opt.value);
                    setThemeOpen(false);
                  }}
                  className={`flex items-center w-full px-2.5 py-2 rounded-md text-sm transition-colors ${
                    theme === opt.value
                      ? "bg-[#497DE2]/20 text-slate-100"
                      : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <opt.icon size={16} className="shrink-0" />
                  <span className="whitespace-nowrap pl-2.5">{opt.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Account */}
        <button
          className="flex items-center px-2 py-1.5 rounded-lg w-full hover:bg-white/[0.06] hover:text-white transition-colors"
          title="Account"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-500/30 flex items-center justify-center shrink-0">
            <User size={14} className="text-white" />
          </div>
          <span className="whitespace-nowrap text-slate-300 text-xs uppercase tracking-wider pl-2">Account</span>
        </button>
      </div>
    </aside>
  );
}

function DocRow({
  doc,
  pinned,
  active,
}: {
  doc: DocRef;
  pinned: boolean;
  active: boolean;
}) {
  return (
    <div
      className={`group flex items-center rounded-md transition-colors ${
        active ? "bg-[#497DE2]/20 text-slate-100" : "hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <Link href={doc.href} className="flex-1 min-w-0 px-2 py-1.5" title={doc.label}>
        <div className="truncate text-xs font-medium">{doc.label}</div>
      </Link>
      <button
        onClick={() => togglePin(doc)}
        className={`p-1.5 mr-1 rounded shrink-0 transition-all hover:bg-white/[0.1] ${
          pinned
            ? "text-blue-400"
            : "text-slate-500 opacity-0 group-hover:opacity-100 hover:text-white"
        }`}
        title={pinned ? "Unpin" : "Pin"}
        aria-label={pinned ? `Unpin ${doc.label}` : `Pin ${doc.label}`}
      >
        <Pin size={13} className={pinned ? "fill-current" : ""} />
      </button>
    </div>
  );
}
