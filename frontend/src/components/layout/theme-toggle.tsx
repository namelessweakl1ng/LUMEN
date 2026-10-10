"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark theme toggle.
 *
 * Designed to live quietly in the page header. Keyboard accessible,
 * labelled for screen readers, and stable across SSR/CSR.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Gate isDark behind `mounted` so server and client render
  // identically during hydration. On the server, resolvedTheme is
  // undefined (next-themes has no DOM to read from). On the client
  // during hydration, next-themes' inline script has already
  // resolved the theme — so resolvedTheme may be "dark" while the
  // server rendered with undefined. Without the mounted gate, the
  // aria-label and title would mismatch between server and client.
  // After mount, isDark correctly reflects the resolved theme.
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
      style={{ borderRadius: "0" }}
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4" strokeWidth={1.5} />
        ) : (
          <Moon className="h-4 w-4" strokeWidth={1.5} />
        )
      ) : (
        // Reserve space until mounted so the layout doesn't shift.
        <span className="h-4 w-4" />
      )}
    </button>
  );
}
