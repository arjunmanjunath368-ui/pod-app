import Link from "next/link";

// The demo walkthrough: one screen per idea, in the order to present them.
export const DEMO_STEPS = [
  { key: "home", href: "/app/demo", label: "Home", short: "Home" },
  { key: "recap", href: "/app/demo/recap", label: "Sunday recap", short: "Recap" },
  { key: "family", href: "/app/demo/family", label: "Family", short: "Family" },
  { key: "discover", href: "/app/demo/discover", label: "Find your people", short: "People" },
  { key: "partner", href: "/app/demo/partner", label: "Admin View", short: "Admin" },
] as const;

export type DemoStep = (typeof DEMO_STEPS)[number]["key"];

export function DemoTopBar({ current }: { current: DemoStep }) {
  const idx = DEMO_STEPS.findIndex((x) => x.key === current);
  return (
    <div className="-mx-5 border-b border-line/70 bg-paper px-5 pb-2 pt-1">
      <div className="flex items-center justify-between gap-3">
        <Link href="/app" className="text-[14px] font-semibold text-muted active:scale-95">
          ‹ My pods
        </Link>
        <span className="rounded-full bg-gold/[0.18] px-3 py-1 text-[12px] font-semibold text-ink">
          Demo · simulated data
        </span>
      </div>
      <nav aria-label="Demo screens" className="mt-3">
        <ol className="grid grid-cols-5 gap-1.5">
          {DEMO_STEPS.map((s, i) => {
            const on = s.key === current;
            return (
              <li key={s.key}>
                <Link href={s.href} aria-current={on ? "page" : undefined} className="flex flex-col gap-1.5 py-1">
                  <span className={`h-1 rounded-full ${i <= idx ? "bg-ink" : "bg-line"}`} />
                  <span className={`truncate text-[12px] ${on ? "font-semibold text-ink" : "font-medium text-muted"}`}>
                    {s.short}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

// Previous / next, pinned to the bottom of the screen while presenting.
export function DemoPager({ current }: { current: DemoStep }) {
  const i = DEMO_STEPS.findIndex((s) => s.key === current);
  const prev = DEMO_STEPS[i - 1];
  const next = DEMO_STEPS[i + 1];
  const btn =
    "flex min-w-0 flex-1 items-center gap-1.5 rounded-full px-4 py-3 text-[15px] font-semibold transition active:scale-[0.98]";
  return (
    <nav aria-label="Demo pages" className="podnav border-t border-line bg-paper/95 backdrop-blur">
      <div className="flex items-center gap-2 px-4 pb-6 pt-3">
        {prev ? (
          <Link href={prev.href} className={`${btn} border border-line bg-card text-ink-soft`}>
            <span aria-hidden>‹</span>
            <span className="truncate">{prev.label}</span>
          </Link>
        ) : (
          <span className={`${btn} invisible`} aria-hidden />
        )}
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-muted">
          {i + 1} / {DEMO_STEPS.length}
        </span>
        {next ? (
          <Link href={next.href} className={`${btn} justify-end bg-ink text-paper`}>
            <span className="truncate">{next.label}</span>
            <span aria-hidden>›</span>
          </Link>
        ) : (
          <Link href={DEMO_STEPS[0].href} className={`${btn} justify-end bg-ink text-paper`}>
            <span className="truncate">Start over</span>
            <span aria-hidden>↺</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
