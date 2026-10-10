import { Suspense } from "react";
import { SearchScreen } from "@/features/search/search-screen";
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="lumen-page" role="status">
          Loading search…
        </main>
      }
    >
      <SearchScreen />
    </Suspense>
  );
}
