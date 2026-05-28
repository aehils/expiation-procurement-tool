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
} from "lucide-react";
import { useTheme, type Theme } from "./theme-provider";

const NAV_ITEMS = [
  { href: "/rfq", label: "RFQs", icon: FileText },
  { href: "/quotes", label: "Quotes", icon: ReceiptText },
  { href: "/po", label: "Purchase Orders", icon: Package },
];

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Match System", icon: Monitor },
  { value: "low-light", label: "Low Light", icon: Moon },
  { value: "bright", label: "Bright", icon: Sun },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [themeOpen, setThemeOpen] = React.useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex flex-col h-screen w-48 shrink-0 bg-[#273042] dark:bg-[#0f1219] text-slate-300">
      {/* Header */}
      <div className="flex flex-row items-center h-16 px-2 gap-2 border-b border-white/[0.06]">
        <Link
          href="/new"
          title="New"
          className="flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors flex-1 h-9 px-3"
        >
          <Plus size={16} strokeWidth={3} className="shrink-0" />
          <span className="whitespace-nowrap text-sm font-semibold uppercase pl-3">New</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600/[0.20] text-slate-100"
                  : "hover:bg-white/[0.06] hover:text-white"
              }`}
              title={item.label}
            >
              <item.icon size={20} className="shrink-0" />
              <span className="whitespace-nowrap pl-3">{item.label}</span>
            </Link>
          );
        })}
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
            <SunMoon size={24} />
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
                      ? "bg-blue-600/[0.20] text-slate-100"
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
            <User size={15} className="text-white" />
          </div>
          <span className="whitespace-nowrap text-slate-300 text-xs uppercase tracking-wider pl-2">Account</span>
        </button>
      </div>
    </aside>
  );
}
