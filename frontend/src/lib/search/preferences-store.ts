"use client";
import { create } from "zustand";
/** Browser preferences hydrate from validated local storage in the page. */
export const usePreferences = create<{
  showImages: boolean;
  openInNewTab: boolean;
  setShowImages: (value: boolean) => void;
  setOpenInNewTab: (value: boolean) => void;
}>((set) => ({
  showImages: false,
  openInNewTab: true,
  setShowImages: (showImages) => set({ showImages }),
  setOpenInNewTab: (openInNewTab) => set({ openInNewTab }),
}));
