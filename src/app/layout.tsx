import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expiation • Procurement",
  description: "Internal RFQ workflow tool",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme")||"system";if(t==="low-light"||(t==="system"&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
        <Toaster
          position="top-left"
          offset={{ top: 38, left: 380 }}
          gap={8}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "group pointer-events-auto inline-flex items-center gap-2.5 w-auto max-w-[min(40vw,440px)] pl-3 pr-4 py-2 rounded-md border border-border bg-card text-card-foreground text-[13px] font-medium tracking-tight leading-tight whitespace-nowrap shadow-[0_8px_20px_-12px_rgba(15,23,42,0.25)]",
              title: "truncate",
              description: "text-xs text-muted-foreground truncate",
              icon: "flex h-4 w-4 shrink-0 items-center justify-center",
              success: "[&_[data-icon]_svg]:text-[#274579] dark:[&_[data-icon]_svg]:text-[hsl(216_72%_70%)]",
              error: "[&_[data-icon]_svg]:text-destructive",
              info: "[&_[data-icon]_svg]:text-muted-foreground",
              warning: "[&_[data-icon]_svg]:text-amber-500",
            },
          }}
        />
      </body>
    </html>
  );
}
