import Link from "next/link";

// The demo walkthrough: one screen per idea, in the order to present them.
export const DEMO_STEPS = [
  { key: "home", href: "/app/demo", label: "Home", short: "Home" },
  { key: "recap", href: "/app/demo/recap", label: "Sunday recap", short: "Recap" },
  { key: "family", href: "/app/demo/family", label: "Family", short: "Family" },
  { key: "discover", href: "/app/demo/discover", label: "Find your people", short: "People" },
  { key: "partner", href: "/app/demo/partner", label: "WHOOP view", short: "WHOOP" },
] as const;

export type DemoStep = (typeof DEMO_STEPS)[number]["key"];

export function DemoTopBar({ current }: { current: DemoStep }) {
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
            const past = i <= DEMO_STEPS.findIndex((x) => x.key === current);
            return (
              <li key={s.key}>
                <Link
                  href={s.href}
                  aria-current={on ? "page" : undefined}
                  className="flex flex-col gap-1.5 py-1"
                >
                  <span className={`h-1 rounded-full ${past ? "bg-ink" : "bg-line"}`} />
                  <span
                    className={`truncate text-[12px] ${on ? "font-semibold text-ink" : "font-medium text-muted"}`}
                  >
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

export function DemoNext({ current }: { current: DemoStep }) {
  const i = DEMO_STEPS.findIndex((s) => s.key === current);
  const next = DEMO_STEPS[i + 1];
  if (!next) {
    return (
      <Link
        href="/app/demo"
        className="mt-8 flex items-center justify-center rounded-full border border-line bg-card py-3.5 text-[15px] font-semibold text-ink-soft active:scale-[0.99]"
      >
        Back to the start
      </Link>
    );
  }
  return (
    <Link
      href={next.href}
      className="mt-8 flex items-center justify-between rounded-full bg-ink px-5 py-3.5 text-[15px] font-semibold text-paper active:scale-[0.99]"
    >
      <span>
        <span className="text-sage-soft">Next · </span>
        {next.label}
      </span>
      <span aria-hidden>›</span>
    </Link>
  );
}
