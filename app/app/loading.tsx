// Shown while the server renders a freshly-visited /app route. Mirrors the
// common page shape (title + a couple of cards) so a first load reads as
// "loading" rather than a blank flash. Repeat visits within the cache window
// skip this entirely and appear instantly.
export default function Loading() {
  return (
    <main className="px-5 pb-28 pt-9">
      <div className="h-7 w-44 animate-pulse rounded-lg bg-line/70" />
      <div className="mt-2 h-4 w-28 animate-pulse rounded bg-line/50" />
      <div className="mt-6 h-36 animate-pulse rounded-3xl bg-line/50" />
      <div className="mt-4 h-24 animate-pulse rounded-2xl bg-line/50" />
      <div className="mt-4 h-24 animate-pulse rounded-2xl bg-line/40" />
      <div className="mt-4 h-24 animate-pulse rounded-2xl bg-line/30" />
    </main>
  );
}
