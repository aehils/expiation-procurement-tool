"use client";

import * as React from "react";
import type { DocRef, DocType } from "./docs";

const STORAGE_KEY = "pinned-docs";

let cache: DocRef[] | null = null;
const listeners = new Set<() => void>();

function read(): DocRef[] {
  if (cache) return cache;
  if (typeof window === "undefined") return (cache = []);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as DocRef[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: DocRef[]) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota/availability errors — pins are a convenience, not critical.
  }
  listeners.forEach((l) => l());
}

export function togglePin(doc: DocRef) {
  const current = read();
  const exists = current.some((d) => d.type === doc.type && d.id === doc.id);
  write(
    exists
      ? current.filter((d) => !(d.type === doc.type && d.id === doc.id))
      : [doc, ...current],
  );
}

export function isPinned(type: DocType, id: string): boolean {
  return read().some((d) => d.type === type && d.id === id);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Reflect pins toggled in other tabs.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY_DOCS: DocRef[] = [];

export function usePinnedDocs(): DocRef[] {
  return React.useSyncExternalStore(subscribe, read, () => EMPTY_DOCS);
}
