"use client";

import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background rounded-l-md shadow-[-8px_0_24px_-4px_rgba(0,0,0,0.18)] relative z-10">
        {children}
      </main>
    </div>
  );
}
