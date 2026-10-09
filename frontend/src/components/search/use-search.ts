"use client";
import { useEffect, useState } from "react";
import { search } from "@/lib/search/client";
import type { SearchResponse } from "@/types/search";
export function useSearch(params: URLSearchParams) {
  const key = params.toString();
  const [state, setState] = useState<{
    data?: SearchResponse;
    error?: string;
    loading: boolean;
  }>({ loading: false });
  useEffect(() => {
    const controller = new AbortController();
    if (!new URLSearchParams(key).get("q")) {
      setState({ loading: false });
      return () => controller.abort();
    }
    setState({ loading: true });
    search(new URLSearchParams(key), controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            error: error instanceof Error ? error.message : "Search failed",
            loading: false,
          });
      });
    return () => controller.abort();
  }, [key]);
  return state;
}
