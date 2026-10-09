"use client";
import { useEffect, useRef, useState } from "react";
import {
  emptyWorkspace,
  exportJSON,
  exportMarkdown,
  parseImport,
  type Bookmark,
} from "@/lib/research/model";
import {
  loadWorkspace,
  updateWorkspace,
  useWorkspace,
} from "@/lib/research/store";
const control =
  "rounded-sm border border-border bg-background px-3 py-2 text-sm";
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function BookmarkFields({
  bookmark,
  onEdit,
}: {
  bookmark: Bookmark;
  onEdit: (id: string, patch: Partial<Bookmark>) => void;
}) {
  const [notes, setNotes] = useState(bookmark.notes);
  const [tags, setTags] = useState(bookmark.tags.join(", "));
  return (
    <>
      <label className="block text-xs">
        Notes
        <textarea
          className={`${control} mt-1 block w-full`}
          aria-label={`Notes for ${bookmark.title}`}
          maxLength={10000}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            onEdit(bookmark.id, { notes: e.target.value });
          }}
        />
      </label>
      <label className="block text-xs">
        Tags (comma separated)
        <input
          className={`${control} mt-1 block w-full`}
          aria-label={`Tags for ${bookmark.title}`}
          maxLength={2000}
          value={tags}
          onChange={(e) => {
            setTags(e.target.value);
            onEdit(bookmark.id, {
              tags: e.target.value
                .split(",")
                .map((t) => t.trim().slice(0, 100))
                .filter(Boolean)
                .slice(0, 20),
            });
          }}
        />
      </label>
    </>
  );
}
export function ResearchWorkspace({ onClose }: { onClose?: () => void }) {
  const { data, storageError } = useWorkspace();
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void loadWorkspace().catch(() => {});
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => before?.focus();
  }, []);
  const change = (fn: Parameters<typeof updateWorkspace>[0]) => {
    void updateWorkspace(fn).catch((e) =>
      setMessage(e instanceof Error ? e.message : "Storage failed"),
    );
  };
  const edit = (id: string, patch: Partial<Bookmark>) =>
    change((d) => ({
      ...d,
      bookmarks: d.bookmarks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  const visible = data.bookmarks.filter(
    (b) =>
      (!collection || b.collectionId === collection) &&
      [b.title, b.url, b.snippet, b.notes, ...b.tags]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div
      className="fixed inset-0 z-50 overflow-auto bg-background/95 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="research-title"
      tabIndex={-1}
      ref={panel}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose?.();
        }
        if (e.key === "Tab" && panel.current) {
          const focusable = Array.from(
            panel.current.querySelectorAll<HTMLElement>(
              "button,input,select,textarea,a[href]",
            ),
          ).filter((el) => !el.hasAttribute("disabled"));
          const first = focusable[0],
            last = focusable.at(-1);
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === panel.current)
          ) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <section className="mx-auto max-w-4xl space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id="research-title" className="text-xl font-semibold">
              Research workspace
            </h2>
            <p className="text-sm text-muted-foreground">
              Collections, notes and bookmarks stay in this browser.
            </p>
          </div>
          <button
            className={control}
            onClick={onClose}
            aria-label="Close research workspace"
          >
            Close
          </button>
        </header>
        {(storageError || message) && (
          <p role="status" className="text-sm">
            {storageError || message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="Search saved research"
            placeholder="Search titles, notes and tags"
            className={`${control} min-w-0 flex-1`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Filter collection"
            className={control}
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
          >
            <option value="">All collections</option>
            {data.collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = name.trim();
            if (!value) return;
            if (data.collections.length >= 100) {
              setMessage("Collection limit reached (100).");
              return;
            }
            change((d) => ({
              ...d,
              collections: [
                ...d.collections,
                { id: crypto.randomUUID(), name: value },
              ],
            }));
            setName("");
          }}
        >
          <input
            aria-label="New collection name"
            maxLength={100}
            className={`${control} min-w-0 flex-1`}
            placeholder="New collection"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className={control}>Create collection</button>
        </form>
        <div className="flex flex-wrap gap-2">
          <button
            className={control}
            onClick={() =>
              download(
                "lumen-research.json",
                exportJSON(data),
                "application/json",
              )
            }
          >
            Export JSON
          </button>
          <button
            className={control}
            onClick={() =>
              download(
                "lumen-research.md",
                exportMarkdown(data),
                "text/markdown",
              )
            }
          >
            Export Markdown
          </button>
          <label className={`${control} cursor-pointer`}>
            Import JSON
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  if (file.size > 2_000_000)
                    throw new Error("Import must be smaller than 2 MB.");
                  const imported = parseImport(await file.text());
                  const prefix = crypto.randomUUID() + "-";
                  await updateWorkspace((d) => {
                    if (
                      d.collections.length + imported.collections.length >
                        100 ||
                      d.bookmarks.length + imported.bookmarks.length > 5000
                    )
                      throw new Error(
                        "Import would exceed the workspace limit.",
                      );
                    return {
                      ...d,
                      collections: [
                        ...d.collections,
                        ...imported.collections.map((c) => ({
                          ...c,
                          id: prefix + c.id,
                        })),
                      ],
                      bookmarks: [
                        ...d.bookmarks,
                        ...imported.bookmarks.map((b) => ({
                          ...b,
                          id: crypto.randomUUID(),
                          collectionId: prefix + b.collectionId,
                        })),
                      ],
                    };
                  });
                  setMessage("Imported research into separate collections.");
                } catch (err) {
                  setMessage(
                    err instanceof Error ? err.message : "Invalid import.",
                  );
                }
              }}
            />
          </label>
        </div>
        <p className="text-sm text-muted-foreground">
          {visible.length} saved {visible.length === 1 ? "result" : "results"}
        </p>
        <div className="space-y-4">
          {visible.map((b) => (
            <article
              key={b.id}
              className="space-y-3 rounded-sm border border-border p-4"
            >
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-4"
              >
                {b.title}
              </a>
              <p className="break-all text-xs text-muted-foreground">{b.url}</p>
              <p className="text-sm">{b.snippet}</p>
              <BookmarkFields bookmark={b} onEdit={edit} />
              <div className="flex flex-wrap gap-2">
                <label className="text-xs">
                  Collection
                  <select
                    className={`${control} mt-1 block`}
                    aria-label={`Move ${b.title} to collection`}
                    value={b.collectionId}
                    onChange={(e) =>
                      edit(b.id, { collectionId: e.target.value })
                    }
                  >
                    {data.collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={`${control} self-end`}
                  onClick={() =>
                    change((d) => ({
                      ...d,
                      bookmarks: d.bookmarks.filter((item) => item.id !== b.id),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
          {!visible.length && (
            <p className="py-6 text-sm text-muted-foreground">
              Save a search result to begin, or import a workspace.
            </p>
          )}
        </div>
        <section className="space-y-3 border-t border-border pt-4">
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.historyEnabled}
              onChange={(e) =>
                change((d) => ({
                  ...d,
                  historyEnabled: e.target.checked,
                  history: e.target.checked ? d.history : [],
                }))
              }
            />
            Remember search history on this device (off by default)
          </label>
          {data.historyEnabled && (
            <div className="text-sm">
              <p>Recent searches</p>
              <ul>
                {data.history.slice(0, 10).map((h, i) => (
                  <li key={h.at + i}>{h.query}</li>
                ))}
              </ul>
              <button
                className={control}
                onClick={() => change((d) => ({ ...d, history: [] }))}
              >
                Clear history
              </button>
            </div>
          )}
          <button className={control} onClick={() => setConfirmClear(true)}>
            Clear local research data
          </button>
          {confirmClear && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                Delete every collection, bookmark, note and history entry?
              </span>
              <button
                className={control}
                onClick={() => {
                  change(() => emptyWorkspace());
                  setConfirmClear(false);
                }}
              >
                Delete all local data
              </button>
              <button
                className={control}
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
