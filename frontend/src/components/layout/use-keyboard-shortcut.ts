"use client";

import * as React from "react";

/**
 * Register a global keyboard shortcut.
 *
 * The handler is NOT fired when the user is typing in an input,
 * textarea, or contenteditable element — unless `allowInInputs` is
 * true (rarely wanted).
 *
 * `combo` is a single key (e.g. "/") or a "+"-joined chord like
 * "mod+k" (mod = ctrl on Win/Linux, cmd on macOS).
 */
export function useKeyboardShortcut(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  options: { allowInInputs?: boolean } = {},
) {
  const handlerRef = React.useRef(handler);
  React.useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  React.useEffect(() => {
    const parts = combo
      .toLowerCase()
      .split("+")
      .map((s) => s.trim());
    const key = parts[parts.length - 1];
    const wantMod =
      parts.includes("mod") || parts.includes("ctrl") || parts.includes("cmd");
    const wantShift = parts.includes("shift");
    const wantAlt = parts.includes("alt");

    const onKey = (e: KeyboardEvent) => {
      // Modal dialogs own keyboard focus and native Escape dismissal.
      if (e.defaultPrevented || document.querySelector("dialog[open]")) return;
      // Respect typing context.
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isTyping && !options.allowInInputs) return;

      // Special case: "/" alone — must not be combined with modifier.
      if (key === "/" && !wantMod && !wantShift && !wantAlt) {
        if (
          e.key === "/" &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !e.shiftKey
        ) {
          e.preventDefault();
          handlerRef.current(e);
        }
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (wantMod !== mod) return;
      if (wantShift !== e.shiftKey) return;
      if (wantAlt !== e.altKey) return;
      if (e.key.toLowerCase() !== key) return;

      e.preventDefault();
      handlerRef.current(e);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo, options.allowInInputs]);
}
