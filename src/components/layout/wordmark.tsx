import * as React from "react";

/**
 * Lumen wordmark.
 *
 * Plain typography with a small geometric mark to the left. No
 * glowing lightbulb. No gradient. The mark is a simple "L" formed
 * by two bars with a small dot — a quiet reference to the project
 * name without being decorative.
 */
export interface LumenWordmarkProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

export function LumenWordmark({
  className = "",
  size = "md",
  showTagline = false,
}: LumenWordmarkProps) {
  const markSize = size === "lg" ? 22 : size === "sm" ? 14 : 18;
  const textSize =
    size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base";

  return (
    <span
      className={`inline-flex items-baseline gap-2 font-semibold tracking-tight ${textSize} ${className}`}
    >
      <span
        className="relative inline-block translate-y-[2px]"
        style={{ width: markSize, height: markSize }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          width={markSize}
          height={markSize}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Vertical bar */}
          <rect x="3" y="3" width="3" height="18" fill="currentColor" />
          {/* Bottom horizontal bar (forms the L) */}
          <rect x="3" y="18" width="14" height="3" fill="currentColor" />
          {/* Quiet accent dot — same accent used everywhere else */}
          <circle cx="20" cy="12" r="2" fill="var(--accent)" />
        </svg>
      </span>
      <span className="text-foreground">Lumen</span>
      {showTagline && (
        <span className="text-muted-foreground font-normal">
          <span className="sr-only"> — </span>
          Search, without the noise.
        </span>
      )}
    </span>
  );
}
