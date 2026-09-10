"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LumenWordmark } from "@/components/layout/wordmark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SettingsButton } from "@/components/search/settings-panel";
import { SearchInput } from "@/components/search/search-input";
import { FilterBar } from "@/components/search/filter-bar";
import { ResultsList } from "@/components/results/results-list";
import { Pagination } from "@/components/results/pagination";
import { useSearch } from "@/components/search/use-search";
import { useKeyboardShortcut } from "@/components/layout/use-keyboard-shortcut";
import { useSettings } from "@/lib/settings/store";
import {
  coerceCategory,
  coerceLanguage,
  coercePage,
  coerceSafeSearch,
  coerceTimeRange,
  normalizeQuery,
} from "@/lib/validation/search";
import type { SearchCategory, TimeRange } from "@/types/search";

const PAGE_SIZE = 10;

/**
 * The default export wraps <HomeContent /> in <Suspense> so that
 * useSearchParams() works during static prerendering. Without this,
 * `next build` fails with "useSearchParams() should be wrapped in a
 * suspense boundary".
 */
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const settings = useSettings();

  // Read state from URL so the URL is the single source of truth.
  // When a URL parameter is ABSENT, fall back to the user's saved
  // default from Settings. When a parameter is PRESENT but invalid,
  // the coerce functions return a hardcoded safe default.
  const queryFromUrl = normalizeQuery(sp.get("q")) ?? "";
  const category = coerceCategory(sp.get("category"), settings.defaultCategory);
  const timeRange = coerceTimeRange(sp.get("time"), settings.defaultTimeRange);
  const language = coerceLanguage(sp.get("language"), settings.defaultLanguage);
  const safeSearch = coerceSafeSearch(sp.get("safe"), settings.safeSearch);
  const page = coercePage(sp.get("page"));

  const isSearchMode = queryFromUrl.length > 0;

  // Input value: initialize from URL so refresh keeps the text. After
  // mount it's controlled by the user.
  const [inputValue, setInputValue] = React.useState(queryFromUrl);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Sync input when the URL changes externally (e.g. back/forward).
  React.useEffect(() => {
    setInputValue(queryFromUrl);
  }, [queryFromUrl]);

  // Global "/" keyboard shortcut: focus the search input.
  useKeyboardShortcut("/", () => {
    inputRef.current?.focus();
    // Select all so the user can immediately retype.
    inputRef.current?.select();
  });

  // Push state changes to the URL.
  const pushState = React.useCallback(
    (mut: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(window.location.search);
      mut(params);
      // Always start at page 1 when query / category / filters change
      // — unless the caller is explicitly changing the page.
      const next = params.toString();
      router.replace(next ? `/?${next}` : "/", { scroll: false });
    },
    [router],
  );

  const onSubmit = React.useCallback(
    (v: string) => {
      pushState((p) => {
        p.set("q", v);
        p.delete("page");
      });
    },
    [pushState],
  );

  const onCategoryChange = React.useCallback(
    (c: SearchCategory) => {
      pushState((p) => {
        p.set("category", c);
        p.delete("page");
      });
    },
    [pushState],
  );

  const onTimeRangeChange = React.useCallback(
    (t: TimeRange) => {
      pushState((p) => {
        p.set("time", t);
        p.delete("page");
      });
    },
    [pushState],
  );

  const onLanguageChange = React.useCallback(
    (l: string) => {
      pushState((p) => {
        p.set("language", l);
        p.delete("page");
      });
    },
    [pushState],
  );

  const onPageChange = React.useCallback(
    (next: number) => {
      pushState((p) => p.set("page", String(next)));
      // Scroll to top of results on page change.
      window.scrollTo({ top: 0, behavior: "auto" });
    },
    [pushState],
  );

  // Pull the search.
  const { data, error, loading } = useSearch({
    query: queryFromUrl,
    category,
    timeRange,
    language,
    safeSearch,
    page,
    enabled: isSearchMode,
  });

  // Determine whether a next page is plausible.
  const hasNext = !!(data && data.results.length >= PAGE_SIZE);

  // The header is rendered in both modes; in search mode the input
  // shrinks to fit the top of the results page.
  return (
    <div className="flex min-h-screen flex-col">
      <Header
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSubmit={onSubmit}
        loading={loading}
        inputRef={inputRef}
        isSearchMode={isSearchMode}
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-2 sm:px-6">
        {!isSearchMode ? (
          <LandingHero
            inputRef={inputRef}
            inputValue={inputValue}
            setInputValue={setInputValue}
            onSubmit={onSubmit}
          />
        ) : (
          <div className="mt-2">
            <FilterBar
              category={category}
              onCategoryChange={onCategoryChange}
              timeRange={timeRange}
              onTimeRangeChange={onTimeRangeChange}
              language={language}
              onLanguageChange={onLanguageChange}
              compact
            />
            <div className="mt-2" aria-live="polite" aria-atomic="true">
              <span className="sr-only">
                {loading
                  ? `Searching for ${queryFromUrl}`
                  : data
                    ? data.empty
                      ? `No results for ${queryFromUrl}`
                      : `${data.results.length} results for ${queryFromUrl}`
                    : ""}
              </span>
            </div>
            <div className="mt-2">
              <ResultsList
                data={data}
                loading={loading}
                error={error}
                query={queryFromUrl}
                openInNewTab={settings.openInNewTab}
                showFavicons={settings.showFavicons}
              />
            </div>
            <Pagination
              page={page}
              hasNext={hasNext}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function Header({
  inputValue,
  setInputValue,
  onSubmit,
  loading,
  inputRef,
  isSearchMode,
}: {
  inputValue: string;
  setInputValue: (v: string) => void;
  onSubmit: (v: string) => void;
  loading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isSearchMode: boolean;
}) {
  return (
    <header
      className="sticky top-0 z-30 w-full border-b"
      style={{
        background: "var(--background)",
        borderBottomColor: "var(--border)",
      }}
    >
      <div className="mx-auto flex h-12 w-full max-w-2xl items-center gap-3 px-4 sm:px-6">
        <a
          href="/"
          aria-label="Lumen home"
          className="flex items-center text-foreground"
        >
          <LumenWordmark size="sm" />
        </a>
        {isSearchMode && (
          <div className="flex-1">
            <SearchInput
              value={inputValue}
              onValueChange={setInputValue}
              onSubmit={onSubmit}
              loading={loading}
              inputRef={inputRef}
              placeholder="Search the web"
              id="lumen-search-header"
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <SettingsButton />
        </div>
      </div>
    </header>
  );
}

function LandingHero({
  inputRef,
  inputValue,
  setInputValue,
  onSubmit,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  inputValue: string;
  setInputValue: (v: string) => void;
  onSubmit: (v: string) => void;
}) {
  return (
    <div className="flex flex-col items-center pt-[18vh]">
      <div className="mb-8">
        <LumenWordmark size="lg" />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Search, without the noise.
      </p>
      <div className="w-full max-w-xl">
        <SearchInput
          value={inputValue}
          onValueChange={setInputValue}
          onSubmit={onSubmit}
          loading={false}
          inputRef={inputRef}
          autoFocusOnMount
          placeholder="Search the web"
        />
        <div className="mt-4 flex justify-center">
          <KeyboardHint />
        </div>
      </div>
    </div>
  );
}

function KeyboardHint() {
  return (
    <p className="text-xs text-muted-foreground">
      Press{" "}
      <kbd
        className="inline-block px-1.5 py-0.5 font-mono text-[10px] text-foreground"
        style={{
          border: "1px solid var(--border)",
          borderRadius: "2px",
          background: "var(--muted)",
        }}
      >
        /
      </kbd>{" "}
      to focus search
    </p>
  );
}

function Footer() {
  return (
    <footer
      className="mt-auto border-t"
      style={{ borderTopColor: "var(--border)" }}
    >
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4 text-xs text-muted-foreground sm:px-6">
        <span>Lumen</span>
        <span>Private · Powered by SearXNG</span>
      </div>
    </footer>
  );
}
