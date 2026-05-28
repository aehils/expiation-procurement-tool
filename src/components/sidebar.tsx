"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  ReceiptText,
  Package,
  User,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
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

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/rfq", label: "RFQs", icon: FileText },
  { href: "/quotes", label: "Quotes", icon: ReceiptText },
  { href: "/po", label: "Purchase Orders", icon: Package },
];

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Match System", icon: Monitor },
  { value: "low-light", label: "Low Light", icon: Moon },
  { value: "bright", label: "Bright", icon: Sun },
];

const EXPANDED_KEY = "sidebar-expanded";

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const openPalette = useCommandPalette();
  const pinned = usePinnedDocs();

  const [collapsed, setCollapsed] = React.useState(false);
  const [themeOpen, setThemeOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [recent, setRecent] = React.useState<RecentDocs>({ rfqs: [], quotes: [], pos: [] });

  React.useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
    try {
      const raw = localStorage.getItem(EXPANDED_KEY);
      if (raw) setExpanded(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore malformed value
    }
  }, []);

  // Refresh recents on every navigation so newly created/edited docs surface.
  React.useEffect(() => {
    let cancelled = false;
    getRecentDocuments().then((r) => {
      if (!cancelled) setRecent(r);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  const toggleSection = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`flex flex-col h-screen shrink-0 bg-[#273042] dark:bg-[#0f1219] text-slate-300 transition-all duration-300 ease-in-out ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Header */}
      <div className="flex items-center px-3 h-16 border-b border-white/[0.06]">
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"}`}>
          <span className="whitespace-nowrap text-sm font-semibold text-white tracking-wide pl-1 pr-2">
            Expiation
          </span>
        </div>
        <button
          onClick={toggleCollapsed}
          className={`p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors ${
            collapsed ? "mx-auto" : "ml-auto"
          }`}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
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
          <div className={`flex-1 overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>
            <span className="whitespace-nowrap pl-3">Search</span>
          </div>
          {!collapsed && (
            <kbd className="text-[10px] text-slate-500 font-sans">⌘K</kbd>
          )}
        </button>

        {/* Home */}
        <Link
          href="/"
          className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/"
              ? "bg-blue-600/[0.20] text-slate-100"
              : "hover:bg-white/[0.06] hover:text-white"
          }`}
          title="Home"
        >
          <Home size={20} className="shrink-0" />
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>
            <span className="whitespace-nowrap pl-3">Home</span>
          </div>
        </Link>

        {/* Pinned */}
        {!collapsed && pinned.length > 0 && (
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
                  className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-600/[0.20] text-slate-100"
                      : "hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <Link
                    href={section.href}
                    className="flex items-center flex-1 min-w-0 px-3 py-2.5"
                    title={section.label}
                  >
                    <section.icon size={20} className="shrink-0" />
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"}`}>
                      <span className="whitespace-nowrap pl-3">{section.label}</span>
                    </div>
                  </Link>
                  {!collapsed && (
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
                  )}
                </div>

                {!collapsed && isOpen && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-white/[0.08] space-y-0.5">
                    {docs.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-slate-500">Nothing recent</p>
                    ) : (
                      docs.map((doc) => (
                        <DocRow
                          key={`${doc.type}-${doc.id}`}
                          doc={doc}
                          pinned={isPinned(doc.type, doc.id)}
                          active={pathname.includes(doc.id)}
                        />
                      ))
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
        <div className={`flex gap-1 ${collapsed ? "flex-col" : "flex-row items-center"}`}>
          <button
            className={`flex items-center px-2 py-1.5 rounded-lg hover:text-blue-400 transition-colors ${
              collapsed ? "w-full justify-center" : "flex-1 min-w-0"
            }`}
            title="Settings"
          >
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <Settings size={21} />
            </div>
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"}`}>
              <span className="whitespace-nowrap uppercase text-xs tracking-wider pl-2">Settings</span>
            </div>
          </button>

          <button
            onClick={() => setThemeOpen(!themeOpen)}
            className={`p-2 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors shrink-0 ${
              collapsed ? "w-full flex justify-center" : ""
            } ${themeOpen ? "bg-white/[0.06] text-white" : ""}`}
            title="Theme"
          >
            <SunMoon size={18} />
          </button>
        </div>

        {themeOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setThemeOpen(false)} />
            <div className="absolute bottom-full left-2 right-2 mb-1 z-50 rounded-lg bg-[#1e2a3a] dark:bg-[#161d2a] border border-white/[0.08] shadow-lg p-1.5 space-y-0.5">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setTheme(opt.value); setThemeOpen(false); }}
                  className={`flex items-center w-full px-2.5 py-2 rounded-md text-sm transition-colors ${
                    collapsed ? "justify-center" : ""
                  } ${
                    theme === opt.value
                      ? "bg-blue-600/[0.20] text-slate-100"
                      : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  }`}
                  title={collapsed ? opt.label : undefined}
                >
                  <opt.icon size={16} className="shrink-0" />
                  {!collapsed && <span className="whitespace-nowrap pl-2.5">{opt.label}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          className="flex items-center px-2 py-1.5 rounded-lg w-full hover:bg-white/[0.06] hover:text-white transition-colors"
          title="Account"
        >
          <div className="w-7 h-7 rounded-lg bg-slate-500/30 flex items-center justify-center shrink-0">
            <User size={13} className="text-white" />
          </div>
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"}`}>
            <span className="whitespace-nowrap text-slate-300 text-xs uppercase tracking-wider pl-2">Account</span>
          </div>
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
        active ? "bg-blue-600/[0.20] text-slate-100" : "hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <Link href={doc.href} className="flex-1 min-w-0 px-2 py-1.5" title={doc.label}>
        <div className="truncate text-xs font-medium">{doc.label}</div>
        {doc.sublabel && (
          <div className="truncate text-[10px] text-slate-500">{doc.sublabel}</div>
        )}
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
