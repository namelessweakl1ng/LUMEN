import { afterEach, expect, it, vi } from "vitest";
import {
  addBookmark,
  emptyWorkspace,
  type WorkspaceData,
} from "@/lib/research/model";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
// Two separately imported module instances share one serialized transactional database.
function installDatabase(initial: WorkspaceData = emptyWorkspace()) {
  let saved = structuredClone(initial);
  let active = false;
  const waiting: (() => void)[] = [];
  const put = vi.fn();
  const db = {
    transaction: (_name: string, mode: string) => {
      const tasks: (() => void)[] = [];
      let changed: WorkspaceData | undefined;
      let aborted = false;
      const tx: {
        oncomplete?: () => void;
        onabort?: () => void;
        objectStore: () => unknown;
        abort: () => void;
      } = {
        objectStore: () => ({
          get: () => {
            const request: { result?: WorkspaceData; onsuccess?: () => void } =
              {};
            tasks.push(() => {
              request.result = structuredClone(saved);
              request.onsuccess?.();
            });
            return request;
          },
          put: (data: WorkspaceData, key: string) => {
            put(data, key);
            changed = structuredClone(data);
          },
        }),
        abort: () => {
          aborted = true;
        },
      };
      const run = () => {
        active = true;
        queueMicrotask(() => {
          tasks.forEach((task) => task());
          if (aborted) tx.onabort?.();
          else {
            if (changed) saved = changed;
            tx.oncomplete?.();
          }
          active = false;
          waiting.shift()?.();
        });
      };
      if (active) waiting.push(run);
      else run();
      expect(["readwrite", "readonly"]).toContain(mode);
      return tx;
    },
  };
  vi.stubGlobal("indexedDB", {
    open: () => {
      const request: { result: unknown; onsuccess?: () => void } = {
        result: db,
      };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  });
  return { read: () => saved, put };
}
it("reads the committed record and aborts an invalid update without changing storage", async () => {
  const database = installDatabase();
  const store = await import("@/lib/research/store");
  await store.updateWorkspace((d) => ({
    ...d,
    collections: [...d.collections, { id: "science", name: "Science" }],
  }));
  expect(database.put).toHaveBeenCalledWith(database.read(), "data");
  expect(await store.readWorkspace()).toEqual(database.read());
  await expect(
    store.updateWorkspace(() => {
      throw new Error("Invalid");
    }),
  ).rejects.toThrow("Invalid");
  expect(database.read().collections).toHaveLength(2);
});
it("retains both bookmarks written by independently loaded tabs", async () => {
  const database = installDatabase();
  const tabA = await import("@/lib/research/store");
  await tabA.loadWorkspace();
  vi.resetModules();
  const tabB = await import("@/lib/research/store");
  await tabB.loadWorkspace();
  await Promise.all([
    tabA.updateWorkspace((d) =>
      addBookmark(d, {
        title: "A",
        url: "https://a.example/",
        snippet: "",
        category: "general",
      }),
    ),
    tabB.updateWorkspace((d) =>
      addBookmark(d, {
        title: "B",
        url: "https://b.example/",
        snippet: "",
        category: "general",
      }),
    ),
  ]);
  expect(
    database
      .read()
      .bookmarks.map((b) => b.title)
      .sort(),
  ).toEqual(["A", "B"]);
});
it("does not resurrect history disabled by another tab or discard unrelated fields", async () => {
  const initial = {
    ...emptyWorkspace(),
    historyEnabled: true,
    history: [{ query: "private", at: "2026-10-09" }],
    futureField: { retained: true },
  };
  const database = installDatabase(initial);
  const tabA = await import("@/lib/research/store");
  await tabA.loadWorkspace();
  vi.resetModules();
  const tabB = await import("@/lib/research/store");
  await tabB.loadWorkspace();
  await tabA.updateWorkspace((d) => ({
    ...d,
    historyEnabled: false,
    history: [],
  }));
  await tabB.recordSearch("should not be recorded");
  await tabB.updateWorkspace((d) =>
    addBookmark(d, {
      title: "New",
      url: "https://example.com/",
      snippet: "",
      category: "general",
    }),
  );
  expect(database.read()).toMatchObject({
    historyEnabled: false,
    history: [],
    futureField: { retained: true },
  });
});
it("reports unavailable browser storage rather than claiming a save", async () => {
  vi.stubGlobal("indexedDB", undefined);
  const { updateWorkspace } = await import("@/lib/research/store");
  await expect(updateWorkspace((d) => d)).rejects.toThrow("unavailable");
});
