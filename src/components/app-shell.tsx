"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { CommandPaletteContext } from "./command-palette-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const open = React.useCallback(() => setPaletteOpen(true), []);

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
        <main className="flex-1 overflow-auto bg-background rounded-l-md shadow-[-8px_0_24px_-4px_rgba(0,0,0,0.18)] relative z-10">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </CommandPaletteContext.Provider>
  );
}
