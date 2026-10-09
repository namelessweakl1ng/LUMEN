export interface Collection {
  id: string;
  name: string;
}
export interface Bookmark {
  id: string;
  collectionId: string;
  title: string;
  url: string;
  snippet: string;
  category: string;
  query: string;
  notes: string;
  tags: string[];
  createdAt: string;
}
export interface WorkspaceData {
  version: 1;
  collections: Collection[];
  bookmarks: Bookmark[];
  historyEnabled: boolean;
  history: { query: string; at: string }[];
}
export const emptyWorkspace = (): WorkspaceData => ({
  version: 1,
  collections: [{ id: "inbox", name: "Inbox" }],
  bookmarks: [],
  historyEnabled: false,
  history: [],
});
const id = () => crypto.randomUUID();
export function safeResearchUrl(value: string): string {
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Only public HTTP(S) links are supported.");
  return url.href;
}
export function addBookmark(
  data: WorkspaceData,
  result: Pick<Bookmark, "title" | "url" | "snippet" | "category">,
  query = "",
  collectionId = data.collections[0]?.id,
): WorkspaceData {
  if (!collectionId || !data.collections.some((c) => c.id === collectionId))
    throw new Error("Choose a collection.");
  const url = safeResearchUrl(result.url);
  if (
    data.bookmarks.some((b) => b.url === url && b.collectionId === collectionId)
  )
    return data;
  if (data.bookmarks.length >= 5000)
    throw new Error("Workspace limit reached (5,000 bookmarks).");
  return {
    ...data,
    bookmarks: [
      ...data.bookmarks,
      {
        ...result,
        url,
        id: id(),
        collectionId,
        query,
        notes: "",
        tags: [],
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max)
    throw new Error("Invalid or oversized text in import.");
  return value;
}
export function parseImport(raw: string): WorkspaceData {
  if (raw.length > 2_000_000)
    throw new Error("Import must be smaller than 2 MB.");
  const data = JSON.parse(raw);
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.collections) ||
    !Array.isArray(data.bookmarks) ||
    data.collections.length < 1 ||
    data.collections.length > 100 ||
    data.bookmarks.length > 5000
  )
    throw new Error("Invalid workspace format.");
  const collections: Collection[] = data.collections.map(
    (c: Record<string, unknown>) => ({
      id: text(c.id, 100),
      name: text(c.name, 100),
    }),
  );
  const ids = new Set(collections.map((c) => c.id));
  if (
    ids.size !== collections.length ||
    collections.some((c) => !c.id || !c.name.trim())
  )
    throw new Error("Invalid collections.");
  const bookmarks: Bookmark[] = data.bookmarks.map(
    (b: Record<string, unknown>) => {
      const collectionId = text(b.collectionId, 100);
      if (
        !ids.has(collectionId) ||
        !Array.isArray(b.tags) ||
        b.tags.length > 20
      )
        throw new Error("Invalid bookmark collection or tags.");
      return {
        id: text(b.id, 100),
        collectionId,
        title: text(b.title, 1000),
        url: safeResearchUrl(text(b.url, 4000)),
        snippet: text(b.snippet, 10000),
        category: text(b.category, 50),
        query: text(b.query, 500),
        notes: text(b.notes, 10000),
        tags: b.tags.map((t: unknown) => text(t, 100)),
        createdAt: text(b.createdAt, 100),
      };
    },
  );
  if (
    new Set(bookmarks.map((b) => b.id)).size !== bookmarks.length ||
    bookmarks.some((b) => !b.id || !Number.isFinite(Date.parse(b.createdAt)))
  )
    throw new Error("Invalid bookmark identity or date.");
  // Imports never enable query history or import another person's query log.
  return {
    version: 1,
    collections,
    bookmarks,
    historyEnabled: false,
    history: [],
  };
}
const markdownText = (s: string) =>
  s.replace(/[\\`*_[\]<>#]/g, (c) => "\\" + c);
export function exportMarkdown(data: WorkspaceData): string {
  return (
    "# Research workspace\n\n" +
    data.collections
      .map(
        (c) =>
          "## " +
          markdownText(c.name) +
          "\n\n" +
          data.bookmarks
            .filter((b) => b.collectionId === c.id)
            .map(
              (b) =>
                `### ${markdownText(b.title)}\n\n${b.url.replace(/[<>\s]/g, encodeURIComponent)}\n\n${markdownText(b.snippet)}\n\n${markdownText(b.notes)}\n\nTags: ${b.tags.map(markdownText).join(", ")}\n`,
            )
            .join("\n"),
      )
      .join("\n")
  );
}
export function exportJSON(data: WorkspaceData): string {
  return JSON.stringify(
    { ...data, historyEnabled: false, history: [] },
    null,
    2,
  );
}
