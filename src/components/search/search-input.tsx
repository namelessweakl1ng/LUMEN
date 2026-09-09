"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

export interface SearchInputProps {
  /** Controlled value. */
  value: string;
  onValueChange: (v: string) => void;
  /** Fired on Enter or implicit submit. */
  onSubmit: (v: string) => void;
  /** When true, show a small spinner at the trailing edge. */
  loading?: boolean;
  /** Optional id for the input. Defaults to "lumen-search". */
  id?: string;
  /** Optional accessible label text (visually hidden). */
  label?: string;
  /** Placeholder. */
  placeholder?: string;
  /** Autofocus on mount. */
  autoFocusOnMount?: boolean;
  /** Optional ref accessor so parents can focus programmatically. */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Optional spell-check setting. */
  spellCheck?: boolean;
  /** Optional name attribute (for form posting). */
  name?: string;
}

/**
 * The Lumen search input.
 *
 * Design notes:
 *  - No giant rounded container. Sharp 2-3px radius, 1px border.
 *  - A subtle inner focus state — accent ring, no shadow glow.
 *  - Clear (X) button only when value is non-empty.
 *  - Loading indicator replaces the leading search icon when loading.
 *  - Keyboard: Enter submits; Escape clears value if non-empty,
 *    otherwise blurs.
 */
export function SearchInput({
  value,
  onValueChange,
  onSubmit,
  loading = false,
  id = "lumen-search",
  label = "Search the web",
  placeholder = "Search the web",
  autoFocusOnMount = false,
  inputRef: externalRef,
  spellCheck = false,
  name,
}: SearchInputProps) {
  const internalRef = React.useRef<HTMLInputElement | null>(null);
  const ref = externalRef ?? internalRef;

  React.useEffect(() => {
    if (autoFocusOnMount) ref.current?.focus();
  }, [autoFocusOnMount, ref]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length > 0) onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (value.length > 0) {
        e.preventDefault();
        onValueChange("");
      } else {
        ref.current?.blur();
      }
    }
  };

  const showClear = value.length > 0 && !loading;

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      aria-label="Lumen search"
      className="w-full"
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div
        className="group relative flex items-center bg-background"
        style={{
          border: "1px solid var(--border)",
          borderRadius: "3px",
        }}
      >
        <span
          aria-hidden="true"
          className="absolute left-3 flex items-center justify-center text-muted-foreground"
        >
          {loading ? (
            <Spinner />
          ) : (
            <Search className="h-4 w-4" strokeWidth={1.5} />
          )}
        </span>
        <input
          ref={ref}
          id={id}
          name={name}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={spellCheck}
          enterKeyHint="search"
          inputMode="search"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label={label}
          aria-busy={loading}
          className="block w-full bg-transparent py-3 pl-10 pr-10 text-[15px] leading-5 text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {showClear && (
          <button
            type="button"
            onClick={() => onValueChange("")}
            aria-label="Clear search"
            className="absolute right-2 flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
            style={{ borderRadius: "2px" }}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </form>
  );
}

function Spinner() {
  return (
    <span
      role="status"
      aria-label="Searching"
      className="inline-block h-4 w-4"
      style={{
        border: "1.5px solid var(--border)",
        borderTopColor: "var(--accent)",
        borderRadius: "50%",
        animation: "lumen-spin 0.8s linear infinite",
      }}
    />
  );
}
