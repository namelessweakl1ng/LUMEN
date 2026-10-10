"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ItemDetails({
  bookmark,
  edit,
  remove,
}: {
  bookmark: Bookmark;
  edit: (patch: Partial<Bookmark>) => void;
  remove: () => void;
}) {
  const { data } = useWorkspace();
  const [notes, setNotes] = useState(bookmark.notes);
  const [tags, setTags] = useState(bookmark.tags.join(", "));
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  // Outside an active editor, render committed storage directly so cross-tab
  // updates never leave an idle editor with an obsolete copy. Active drafts are
  // preserved; simultaneous editing of the same field remains last-write-wins.
  useEffect(() => {
    const stopEditing = () => {
      setEditingNotes(false);
      setEditingTags(false);
    };
    window.addEventListener("blur", stopEditing);
    return () => window.removeEventListener("blur", stopEditing);
  }, []);
  return (
    <section
      className="lumen-panel min-w-0 space-y-5 p-5"
      aria-label="Selected saved item"
    >
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Item details · {bookmark.category}
      </p>
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block break-words text-xl font-semibold underline underline-offset-4"
      >
        {bookmark.title}
      </a>
      <p className="break-all text-xs text-muted-foreground">{bookmark.url}</p>
      <p className="text-sm leading-relaxed">{bookmark.snippet}</p>
      <p className="text-xs text-muted-foreground">
        Saved {new Date(bookmark.createdAt).toLocaleDateString()}
        {bookmark.query && ` · Search: ${bookmark.query}`}
      </p>
      <label className="block space-y-2 text-sm">
        Collection
        <select
          aria-label={`Move ${bookmark.title} to collection`}
          className="lumen-control w-full"
          value={bookmark.collectionId}
          onChange={(e) => edit({ collectionId: e.target.value })}
        >
          {data.collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm">
        Notes
        <textarea
          aria-label={`Notes for ${bookmark.title}`}
          className="lumen-control block min-h-36 w-full"
          maxLength={10000}
          value={editingNotes ? notes : bookmark.notes}
          onFocus={() => {
            setNotes(bookmark.notes);
            setEditingNotes(true);
          }}
          onBlur={() => setEditingNotes(false)}
          onChange={(e) => {
            setEditingNotes(true);
            setNotes(e.target.value);
            edit({ notes: e.target.value });
          }}
        />
      </label>
      <label className="block space-y-2 text-sm">
        Tags{" "}
        <span className="text-xs text-muted-foreground">(comma separated)</span>
        <input
          aria-label={`Tags for ${bookmark.title}`}
          className="lumen-control block w-full"
          maxLength={2000}
          value={editingTags ? tags : bookmark.tags.join(", ")}
          onFocus={() => {
            setTags(bookmark.tags.join(", "));
            setEditingTags(true);
          }}
          onBlur={() => setEditingTags(false)}
          onChange={(e) => {
            setEditingTags(true);
            setTags(e.target.value);
            edit({
              tags: Array.from(
                new Set(
                  e.target.value
                    .split(",")
                    .map((tag) => tag.trim().slice(0, 100))
                    .filter(Boolean),
                ),
              ).slice(0, 20),
            });
          }}
        />
      </label>
      <button className="lumen-button" onClick={remove}>
        Remove saved item
      </button>
    </section>
  );
}

export function ResearchWorkspace({
  savedOnly = false,
}: {
  savedOnly?: boolean;
  onClose?: () => void;
}) {
  const { data, storageError } = useWorkspace();
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState("");
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [rename, setRename] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    void loadWorkspace().catch(() => {});
  }, []);
  const change = (
    fn: Parameters<typeof updateWorkspace>[0],
    success?: string,
  ) => {
    void updateWorkspace(fn)
      .then(() => {
        if (success) setMessage(success);
      })
      .catch((error) =>
        setMessage(error instanceof Error ? error.message : "Storage failed."),
      );
  };
  const visible = data.bookmarks.filter(
    (b) =>
      (!collection || b.collectionId === collection) &&
      [b.title, b.url, b.snippet, b.notes, ...b.tags]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const item = visible.find((b) => b.id === selected) ?? visible[0];
  const activeCollection = data.collections.find((c) => c.id === collection);
  return (
    <main className="lumen-page space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            Your research, on this device
          </p>
          <h1 className="text-3xl font-semibold">
            {savedOnly ? "Saved items" : "Research workspace"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Collect useful results. Connect ideas with notes and tags.
          </p>
        </div>
        <Link className="lumen-button" href="/search">
          Find something new
        </Link>
      </header>
      {(message || storageError) && (
        <p role="status" className="lumen-panel p-3 text-sm">
          {storageError || message}
        </p>
      )}
      <div className="grid min-w-0 gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4" aria-label="Collections">
          <h2 className="text-xs font-semibold uppercase tracking-widest">
            Collections
          </h2>
          <nav className="flex flex-col border-y border-border">
            <button
              className={`px-3 py-3 text-left text-sm ${!collection ? "bg-muted font-semibold" : ""}`}
              onClick={() => setCollection("")}
            >
              All saved items{" "}
              <span className="float-right">{data.bookmarks.length}</span>
            </button>
            {data.collections.map((c) => (
              <button
                key={c.id}
                aria-pressed={collection === c.id}
                className={`flex min-w-0 justify-between gap-2 px-3 py-3 text-left text-sm ${collection === c.id ? "bg-muted font-semibold" : ""}`}
                onClick={() => {
                  setCollection(c.id);
                  setRename(c.name);
                }}
              >
                <span className="break-words">{c.name}</span>
                <span>
                  {data.bookmarks.filter((b) => b.collectionId === c.id).length}
                </span>
              </button>
            ))}
          </nav>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              change((d) => {
                if (d.collections.length >= 100)
                  throw new Error("Collection limit reached (100).");
                return {
                  ...d,
                  collections: [
                    ...d.collections,
                    { id: crypto.randomUUID(), name: name.trim() },
                  ],
                };
              }, "Collection created.");
              setName("");
            }}
          >
            <label className="block text-xs" htmlFor="new-collection">
              New collection
            </label>
            <input
              id="new-collection"
              aria-label="New collection name"
              className="lumen-control w-full"
              placeholder="Collection name"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="lumen-button w-full" disabled={!name.trim()}>
              Create collection
            </button>
          </form>
          {activeCollection && (
            <form
              className="space-y-2 border-t border-border pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (rename.trim())
                  change(
                    (d) => ({
                      ...d,
                      collections: d.collections.map((c) =>
                        c.id === collection ? { ...c, name: rename.trim() } : c,
                      ),
                    }),
                    "Collection renamed.",
                  );
              }}
            >
              <label htmlFor="rename-collection" className="block text-xs">
                Rename collection
              </label>
              <input
                id="rename-collection"
                className="lumen-control w-full"
                maxLength={100}
                value={rename}
                onChange={(e) => setRename(e.target.value)}
              />
              <button className="lumen-button w-full" disabled={!rename.trim()}>
                Rename
              </button>
            </form>
          )}
          <Link
            href={savedOnly ? "/workspace" : "/saved"}
            className="block text-sm underline underline-offset-4"
          >
            {savedOnly ? "Manage workspace & backups" : "Browse saved items"}
          </Link>
        </aside>
        <section className="min-w-0 space-y-4" aria-label="Saved results">
          <label className="block">
            <span className="sr-only">Search saved research</span>
            <input
              aria-label="Search saved research"
              className="lumen-control w-full"
              placeholder="Search titles, notes and tags"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {visible.length} saved {visible.length === 1 ? "item" : "items"}
            {activeCollection
              ? ` in ${activeCollection.name}`
              : " across your collections"}
          </p>
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0 border-t border-border">
              {visible.map((b) => (
                <button
                  key={b.id}
                  aria-pressed={item?.id === b.id}
                  onClick={() => setSelected(b.id)}
                  className={`block w-full space-y-2 border-b border-border p-4 text-left ${item?.id === b.id ? "bg-muted border-l-2 border-l-primary" : "hover:bg-muted/50"}`}
                >
                  <span className="block text-xs text-muted-foreground">
                    {
                      data.collections.find((c) => c.id === b.collectionId)
                        ?.name
                    }{" "}
                    · {b.category}
                  </span>
                  <span className="block break-words font-medium">
                    {b.title}
                  </span>
                  <span className="block line-clamp-2 text-sm text-muted-foreground">
                    {b.snippet || b.url}
                  </span>
                  {b.tags.length > 0 && (
                    <span className="block break-words text-xs text-muted-foreground">
                      {b.tags.map((t) => `#${t}`).join(" ")}
                    </span>
                  )}
                </button>
              ))}
              {!visible.length && (
                <div className="py-12">
                  <h2 className="font-medium">
                    {search
                      ? "No matching saved items"
                      : "A place for your next idea"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {search
                      ? "Try a different title, note or tag."
                      : "Save a result from Search, or import your research below."}
                  </p>
                </div>
              )}
            </div>
            {item && (
              <ItemDetails
                key={item.id}
                bookmark={item}
                edit={(patch) =>
                  change((d) => ({
                    ...d,
                    bookmarks: d.bookmarks.map((b) =>
                      b.id === item.id ? { ...b, ...patch } : b,
                    ),
                  }))
                }
                remove={() =>
                  change(
                    (d) => ({
                      ...d,
                      bookmarks: d.bookmarks.filter((b) => b.id !== item.id),
                    }),
                    "Saved item removed.",
                  )
                }
              />
            )}
          </div>
        </section>
      </div>
      {!savedOnly && (
        <WorkspaceTools
          change={change}
          setMessage={setMessage}
          onClear={() => {
            setCollection("");
            setSelected("");
          }}
        />
      )}
    </main>
  );
}

function WorkspaceTools({
  change,
  setMessage,
  onClear,
}: {
  change: (fn: Parameters<typeof updateWorkspace>[0], success?: string) => void;
  setMessage: (message: string) => void;
  onClear: () => void;
}) {
  const { data } = useWorkspace();
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <section
      className="border-t border-border pt-6 space-y-5"
      aria-labelledby="workspace-tools"
    >
      <div>
        <h2 id="workspace-tools" className="text-lg font-semibold">
          Workspace tools
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Backups include collections, notes and tags. Search history stays on
          this device.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="lumen-button"
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
          className="lumen-button"
          onClick={() =>
            download("lumen-research.md", exportMarkdown(data), "text/markdown")
          }
        >
          Export Markdown
        </button>
        <label className="lumen-button cursor-pointer">
          Import JSON
          <input
            aria-label="Import research JSON"
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
                    d.collections.length + imported.collections.length > 100 ||
                    d.bookmarks.length + imported.bookmarks.length > 5000
                  )
                    throw new Error("Import would exceed the workspace limit.");
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
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Invalid import.",
                );
              }
            }}
          />
        </label>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          className="mt-1"
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
        <span>
          Remember search history on this device
          <span className="block text-xs text-muted-foreground">
            Off by default. Turning this off clears existing history.
          </span>
        </span>
      </label>
      {data.historyEnabled && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Recent searches</h3>
          <ul className="space-y-2 text-sm">
            {data.history.slice(0, 10).map((h, i) => (
              <li key={h.at + i}>
                <Link
                  className="underline underline-offset-4"
                  href={`/search?q=${encodeURIComponent(h.query)}`}
                >
                  {h.query}
                </Link>
              </li>
            ))}
          </ul>
          {!data.history.length && (
            <p className="text-sm text-muted-foreground">
              Your recent searches will appear here.
            </p>
          )}
          <button
            className="lumen-button"
            onClick={() =>
              change((d) => ({ ...d, history: [] }), "Search history cleared.")
            }
          >
            Clear history
          </button>
        </div>
      )}
      <div className="border-t border-border pt-4">
        <button className="lumen-button" onClick={() => setConfirmClear(true)}>
          Clear local research data
        </button>
        {confirmClear && (
          <div
            role="group"
            aria-label="Confirm data deletion"
            className="mt-3 space-y-3"
          >
            <p className="text-sm">
              Delete every collection, saved item, note and history entry?
              Export a backup first if you need it.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="lumen-button"
                onClick={() => {
                  change(
                    () => emptyWorkspace(),
                    "Local research data deleted.",
                  );
                  onClear();

                  setConfirmClear(false);
                }}
              >
                Delete all local data
              </button>
              <button
                className="lumen-button"
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
