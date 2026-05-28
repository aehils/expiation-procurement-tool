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
  PanelLeftClose,
  PanelLeftOpen,
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
  const [collapsed, setCollapsed] = React.useState(false);
  const [themeOpen, setThemeOpen] = React.useState(false);

  React.useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };


  return (
    <aside
      className={`flex flex-col h-screen shrink-0 bg-[#273042] dark:bg-[#0f1219] text-slate-300 transition-all duration-300 ease-in-out ${
        collapsed ? "w-16" : "w-48"
      }`}
    >
      {/* Header */}
      <div
        className={`flex h-16 px-2 border-b border-white/[0.06] ${
          collapsed ? "flex-col items-center justify-center gap-1" : "flex-row items-center gap-2"
        }`}
      >
        <Link
          href="/new"
          title="New"
          className={`flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors ${
            collapsed ? "w-7 h-7" : "flex-1 h-9 px-3"
          }`}
        >
          <Plus size={16} className="shrink-0" />
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "max-w-0 opacity-0" : "max-w-[80px] opacity-100"}`}>
            <span className="whitespace-nowrap text-sm pl-1.5">New</span>
          </div>
        </Link>
        <button
          onClick={toggleCollapsed}
          className={`flex items-center justify-center shrink-0 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors ${
            collapsed ? "w-7 h-7" : "w-9 h-9"
          }`}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={18} />}
        </button>
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
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100"}`}>
                <span className="whitespace-nowrap pl-3">{item.label}</span>
              </div>
            </Link>
          );
        })}
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
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100"}`}>
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
          <div className="w-8 h-8 rounded-lg bg-slate-500/30 flex items-center justify-center shrink-0">
            <User size={15} className="text-white" />
          </div>
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100"}`}>
            <span className="whitespace-nowrap text-slate-300 text-xs uppercase tracking-wider pl-2">Account</span>
          </div>
        </button>
      </div>
    </aside>
  );
}
