import { LoadingSkeleton } from "@/components/state-views";

export default function Loading() {
  return (
    <main className="min-h-screen bg-surface p-6">
      <LoadingSkeleton rows={6} />
    </main>
  );
}
