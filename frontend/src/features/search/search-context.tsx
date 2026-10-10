"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { readApi } from "@/lib/search/client";
import {
  BUILTINS,
  validateProfiles,
  type Profile,
} from "@/lib/search/profiles";
import type { Engine, Category } from "@/types/search";
const Sources = createContext<{
  engines: Engine[];
  categories: Category[];
  error: string;
  loading: boolean;
}>({ engines: [], categories: [], error: "", loading: true });
const Profiles = createContext<{
  profiles: Profile[];
  builtins: Profile[];
  customProfiles: Profile[];
  saveProfile: (p: Profile) => void;
  deleteProfile: (id: string) => void;
  restoreDefaults: () => void;
  error: string;
}>({
  profiles: BUILTINS,
  builtins: BUILTINS,
  customProfiles: [],
  saveProfile: () => {},
  deleteProfile: () => {},
  restoreDefaults: () => {},
  error: "",
});
export function SearchProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState({
    engines: [] as Engine[],
    categories: [] as Category[],
    error: "",
    loading: true,
  });
  const [custom, setCustom] = useState<Profile[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      readApi<{ engines: Engine[] }>("/api/v1/engines", {
        signal: abort.signal,
      }),
      readApi<{ categories: Category[] }>("/api/v1/categories", {
        signal: abort.signal,
      }),
    ])
      .then(([e, c]) =>
        setSources({
          engines: e.engines,
          categories: c.categories,
          error: "",
          loading: false,
        }),
      )
      .catch(() => {
        if (!abort.signal.aborted)
          setSources({
            engines: [],
            categories: [],
            error:
              "Source information is unavailable. Check the search service and refresh.",
            loading: false,
          });
      });
    try {
      setCustom(
        validateProfiles(
          JSON.parse(localStorage.getItem("lumen-profiles") || "[]"),
        ),
      );
    } catch {
      setError(
        "Stored profiles could not be read. Your stored data has been left intact.",
      );
    }
    return () => abort.abort();
  }, []);
  const persist = (next: Profile[]) => {
    try {
      localStorage.setItem("lumen-profiles", JSON.stringify(next));
      setCustom(next);
      setError("");
    } catch {
      setError("Browser storage is unavailable. Profiles could not be saved.");
    }
  };
  const builtins = BUILTINS.map((p) => ({
    ...p,
    engines: p.engines.filter((id) =>
      sources.engines.some((e) => e.id === id && e.enabled && e.configured),
    ),
  }));
  return (
    <Sources.Provider value={sources}>
      <Profiles.Provider
        value={{
          profiles: [...builtins, ...custom],
          builtins,
          customProfiles: custom,
          error,
          saveProfile: (p) =>
            persist(
              validateProfiles([...custom.filter((v) => v.id !== p.id), p]),
            ),
          deleteProfile: (id) => persist(custom.filter((p) => p.id !== id)),
          restoreDefaults: () => persist([]),
        }}
      >
        {children}
      </Profiles.Provider>
    </Sources.Provider>
  );
}
export const useSources = () => useContext(Sources);
export const useProfiles = () => useContext(Profiles);
