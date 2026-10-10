"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/types/search";
import { addBookmark, safeResearchUrl } from "@/lib/research/model";
import {
  loadWorkspace,
  updateWorkspace,
  useWorkspace,
} from "@/lib/research/store";
export function SaveResultButton({
  result,
  query = "",
}: {
  result: SearchResult;
  query?: string;
}) {
  const { data } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const container = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    void loadWorkspace().catch(() => {});
  }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!container.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  let url = result.url;
  try {
    url = safeResearchUrl(result.url);
  } catch {
    /* Validation errors appear when saving. */
  }
  const saved = data.bookmarks.some((b) => b.url === url);
  return (
    <span
      ref={container}
      className="relative inline-flex items-center gap-2"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="lumen-button text-xs"
        aria-label={`Save ${result.title} to research workspace`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {saved ? "Saved" : "Save"}
      </button>
      {open && (
        <span
          className="lumen-panel absolute left-0 top-full z-30 mt-2 block w-56 max-w-[calc(100vw-2rem)] p-2"
          role="group"
          aria-label={`Choose collection for ${result.title}`}
        >
          <span className="block px-2 py-2 text-xs text-muted-foreground">
            Save to collection
          </span>
          <span className="block max-h-52 overflow-auto">
            {data.collections.map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex w-full justify-between gap-2 px-2 py-3 text-left text-sm hover:bg-muted"
                onClick={() => {
                  void updateWorkspace((d) =>
                    addBookmark(d, result, query, c.id),
                  )
                    .then(() => {
                      setMessage(`Saved to ${c.name}`);
                      setOpen(false);
                      trigger.current?.focus();
                    })
                    .catch((error) =>
                      setMessage(
                        error instanceof Error ? error.message : "Save failed.",
                      ),
                    );
                }}
              >
                <span className="break-words">{c.name}</span>
                {data.bookmarks.some(
                  (b) => b.url === url && b.collectionId === c.id,
                ) && <span aria-label="Already saved">✓</span>}
              </button>
            ))}
          </span>
          <Link
            href="/workspace"
            className="block border-t border-border px-2 py-3 text-xs underline underline-offset-4"
          >
            Manage collections
          </Link>
        </span>
      )}
      <span role="status" className="text-xs text-muted-foreground">
        {message}
      </span>
    </span>
  );
}
