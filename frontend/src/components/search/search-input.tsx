"use client";
import { useRef, type RefObject } from "react";
import { Search, X } from "lucide-react";
export interface SearchInputProps {
  value: string;
  onValueChange: (v: string) => void;
  onSubmit: (v: string) => void;
  loading?: boolean;
  id?: string;
  label?: string;
  placeholder?: string;
  autoFocusOnMount?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  spellCheck?: boolean;
  name?: string;
}
export function SearchInput({
  value,
  onValueChange,
  onSubmit,
  loading = false,
  id = "lumen-search",
  label = "Search query",
  placeholder = "Search knowledge, code, news…",
  inputRef,
  spellCheck = false,
  name,
}: SearchInputProps) {
  const local = useRef<HTMLInputElement>(null);
  return (
    <form
      role="search"
      aria-label="Lumen search"
      className="search-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
    >
      <Search
        size={20}
        aria-hidden
        className="ml-2 text-muted-foreground shrink-0"
      />
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        ref={inputRef || local}
        name={name}
        value={value}
        type="search"
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        spellCheck={spellCheck}
        autoComplete="off"
        enterKeyHint="search"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onValueChange("");
          }
        }}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          className="p-2"
          onClick={() => onValueChange("")}
        >
          <X size={16} />
        </button>
      )}
      <button
        type="submit"
        className="lumen-button lumen-primary"
        disabled={!value.trim()}
      >
        {loading ? "Searching…" : "Search"}
      </button>
    </form>
  );
}
