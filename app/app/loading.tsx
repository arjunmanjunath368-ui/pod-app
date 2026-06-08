// Shown instantly on navigation to any /app route while the server renders,
// so switching tabs feels immediate instead of blank for a beat.
export default function Loading() {
  return (
    <main className="px-5 pb-28 pt-9">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-line/70" />
      <div className="mt-6 h-40 animate-pulse rounded-3xl bg-line/50" />
      <div className="mt-4 h-24 animate-pulse rounded-2xl bg-line/50" />
      <div className="mt-4 h-24 animate-pulse rounded-2xl bg-line/50" />
    </main>
  );
}
