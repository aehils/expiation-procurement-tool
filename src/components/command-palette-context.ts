"use client";

import * as React from "react";

export const CommandPaletteContext = React.createContext<() => void>(() => {});

export function useCommandPalette() {
  return React.useContext(CommandPaletteContext);
}
