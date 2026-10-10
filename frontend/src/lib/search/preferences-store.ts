"use client";
import { create } from "zustand";
import { readPreferences } from "./preferences";
let hydrated = false;
function persist(values: { showImages: boolean; openInNewTab: boolean }) {
  try {
    localStorage.setItem("lumen-preferences", JSON.stringify(values));
  } catch {
    /* Preferences remain usable for this session. */
  }
}
export const usePreferences = create<{
  showImages: boolean;
  openInNewTab: boolean;
  setShowImages: (value: boolean) => void;
  setOpenInNewTab: (value: boolean) => void;
}>((set, get) => ({
  showImages: false,
  openInNewTab: true,
  setShowImages: (showImages) => {
    set({ showImages });
    persist({ showImages, openInNewTab: get().openInNewTab });
  },
  setOpenInNewTab: (openInNewTab) => {
    set({ openInNewTab });
    persist({ openInNewTab, showImages: get().showImages });
  },
}));
/** Read existing V2 keys without overwriting malformed or unavailable storage. */
export function hydratePreferences() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const read = (key: string): unknown => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };
  usePreferences.setState(
    readPreferences(read("lumen-preferences"), read("lumen-settings")),
  );
}
