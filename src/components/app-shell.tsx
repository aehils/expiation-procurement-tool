"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { CommandPaletteContext } from "./command-palette-context";
import { Spinner } from "./ui/spinner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [navigating, setNavigating] = React.useState(false);
  const pathname = usePathname();
  const mounted = React.useRef(false);
  const open = React.useCallback(() => setPaletteOpen(true), []);

  // Clear spinner when the route settles — brief delay lets loading.tsx mount first
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const t = setTimeout(() => setNavigating(false), 100);
    return () => clearTimeout(t);
  }, [pathname]);

  // Safety valve
  React.useEffect(() => {
    if (!navigating) return;
    const t = setTimeout(() => setNavigating(false), 8000);
    return () => clearTimeout(t);
  }, [navigating]);

  // Show spinner the moment any internal link is clicked
  React.useEffect(() => {
    function onAnchorClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (anchor.target === "_blank") return;
      try {
        const dest = new URL(href, location.href);
        if (dest.pathname === location.pathname && dest.search === location.search) return;
      } catch {
        return;
      }
      setNavigating(true);
    }
    document.addEventListener("click", onAnchorClick, true);
    return () => document.removeEventListener("click", onAnchorClick, true);
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CommandPaletteContext.Provider value={open}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-background rounded-l-md shadow-[-8px_0_24px_-4px_rgba(0,0,0,0.18)] relative z-10 pt-3">
          {navigating ? (
            <div className="flex items-center justify-center h-full min-h-screen">
              <Spinner />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </CommandPaletteContext.Provider>
  );
}
