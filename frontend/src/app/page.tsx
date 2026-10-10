import { Suspense } from "react";
import { SearchScreen } from "@/features/search/search-screen";
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="lumen-page" role="status">
          Loading search…
        </main>
      }
    >
      <SearchScreen landing />
    </Suspense>
  );
}
