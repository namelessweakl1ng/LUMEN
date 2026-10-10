import { Suspense } from "react";
import { ComparisonScreen } from "@/features/comparison/comparison-screen";
export default function ComparePage() {
  return (
    <Suspense
      fallback={<main className="lumen-page">Loading comparison…</main>}
    >
      <ComparisonScreen />
    </Suspense>
  );
}
