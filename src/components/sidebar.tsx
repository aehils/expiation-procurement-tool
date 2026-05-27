"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  Package,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  X,
} from "lucide-react";
import { useTheme, type Theme } from "./theme-provider";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/rfq", label: "RFQs", icon: FileText },
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
  const [settingsOpen, setSettingsOpen] = React.useState(false);

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
      className={`flex flex-col h-screen shrink-0 bg-[#1a1f2e] text-slate-400 transition-all duration-300 ease-in-out ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-16 border-b border-white/[0.06]">
        {!collapsed && (
          <span className="text-sm font-semibold text-white tracking-wide truncate pl-1">
            Expiation
          </span>
        )}
        <button
          onClick={toggleCollapsed}
          className={`p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors ${
            collapsed ? "mx-auto" : ""
          }`}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-[#274579] text-white"
                  : "hover:bg-white/[0.06] hover:text-white"
              } ${collapsed ? "justify-center" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="px-2 pb-4 space-y-1 border-t border-white/[0.06] pt-4">
        {/* User Account */}
        <div
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-[#274579] flex items-center justify-center shrink-0">
            <User size={16} className="text-white" />
          </div>
          {!collapsed && (
            <span className="text-slate-300 truncate text-sm">Account</span>
          )}
        </div>

        {/* Settings */}
        <div className="relative">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full hover:bg-white/[0.06] hover:text-white transition-colors ${
              collapsed ? "justify-center" : ""
            } ${settingsOpen ? "bg-white/[0.06] text-white" : ""}`}
            title={collapsed ? "Settings" : undefined}
          >
            <Settings size={20} className="shrink-0" />
            {!collapsed && <span className="truncate">Settings</span>}
          </button>

          {settingsOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setSettingsOpen(false)}
              />
              <div
                className={`absolute bottom-full mb-2 z-50 w-56 rounded-xl bg-[#252b3d] border border-white/10 shadow-xl p-3 ${
                  collapsed ? "left-full ml-2 bottom-0 mb-0" : "left-0"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Theme
                  </span>
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="space-y-1">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                        theme === opt.value
                          ? "bg-[#274579] text-white"
                          : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <opt.icon size={16} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
