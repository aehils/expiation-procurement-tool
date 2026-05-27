"use client";

import * as React from "react";

export type Theme = "system" | "low-light" | "bright";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
});

export function useTheme() {
  return React.useContext(ThemeContext);
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  if (theme === "low-light") {
    root.classList.add("dark");
  } else if (theme === "bright") {
    root.classList.remove("dark");
  } else {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    root.classList.toggle("dark", prefersDark);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("system");

  React.useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored && ["system", "low-light", "bright"].includes(stored)) {
      setThemeState(stored);
    }
  }, []);

  React.useEffect(() => {
    applyThemeClass(theme);

    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeClass("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("theme", t);
    applyThemeClass(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
