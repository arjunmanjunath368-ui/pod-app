import { demoViewer } from "@/lib/demoViewer";
import { weekStartUtc } from "@/lib/week";
import { weekRangeShort } from "@/lib/homeModel";
import { DemoTopBar, DemoPager } from "@/components/home/DemoNav";
import { DemoActionButton } from "@/components/home/DemoParts";
import InView from "@/components/home/InView";

export const dynamic = "force-dynamic";

// Demo: the AI recap every pod gets on Sunday night. The pod's part is written
// only from what the pod can already see (who was active, rest days, how many
// were in each recovery zone). The personal part uses the member's own WHOOP
// data and is shown only to them.

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
type Cell = "a" | "r" | "-";
const WEEK: { name: string; initials: string; color: string; days: Cell[] }[] = [
  { name: "You", initials: "AJ", color: "#c8553d", days: ["a", "-", "a", "a", "-", "a", "-"] },
  { name: "Maya", initials: "MR", color: "#7a9471", days: ["a", "a", "-", "a", "a", "a", "-"] },
  { name: "Jordan", initials: "JK", color: "#d9a441", days: ["-", "a", "-", "a", "-", "a", "-"] },
  { name: "Priya", initials: "PS", color: "#5b7fa6", days: ["a", "a", "r", "a", "-", "a", "-"] },
  { name: "Sam", initials: "SO", color: "#8a6f9e", days: ["a", "-", "-", "a", "-", "-", "a"] },
];
// Average members active on each weekday, last 6 weeks.
const AVG_BY_DAY = [3.8, 3.2, 2.5, 4.5, 1.2, 3.6, 1.5];
const POD_SIZE = 5;

function Avatar({ initials, color, size = 32 }: { initials: string; color: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-paper"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials}
    </span>
  );
}

function WhoMovedGrid() {
  const totals = DAYS.map((_, d) => WEEK.filter((m) => m.days[d] === "a").length);
  return (
    <InView>
      <table className="w-full border-separate" style={{ borderSpacing: "0 6px" }}>
        <thead>
          <tr>
            <th className="w-[84px]" />
            {DAYS.map((d, i) => (
              <th key={i} className="text-center text-[13px] font-semibold text-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEK.map((m, r) => (
            <tr key={m.name}>
              <th scope="row" className="pr-1 text-left">
                <span className="flex items-center gap-2">
                  <Avatar initials={m.initials} color={m.color} size={26} />
                  <span className="truncate text-[14px] font-semibold text-ink">{m.name}</span>
                </span>
              </th>
              {m.days.map((c, d) => (
                <td key={d} className="text-center">
                  <span
                    className={`pop-in mx-auto flex h-[26px] w-[26px] items-center justify-center rounded-full ${
                      c === "a" ? "bg-[#E3B04B]" : c === "r" ? "bg-[#8FA8D8]" : "border border-line bg-paper"
                    }`}
                    style={{ transitionDelay: `${(r * 7 + d) * 25}ms` }}
                    aria-label={`${m.name}, ${DAYS[d]}: ${c === "a" ? "active" : c === "r" ? "rest day" : "no activity"}`}
                  >
                    {c === "a" && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#1a2e1f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M2.5 6.5 5 9l4.5-6" />
                      </svg>
                    )}
                    {c === "r" && <span className="text-[11px]">💤</span>}
                  </span>
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row" className="pt-1 text-left text-[13px] font-semibold text-muted">
              Moved
            </th>
            {totals.map((t, d) => (
              <td key={d} className={`pt-1 text-center text-[14px] font-semibold tabular-nums ${t === POD_SIZE ? "text-terra" : "text-ink-soft"}`}>
                {t}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </InView>
  );
}

function DayAverages() {
  const H = 64;
  return (
    <InView>
      <div className="flex items-end gap-2" style={{ height: H + 20 }} role="img" aria-label={`Average members active by weekday, last 6 weeks: ${AVG_BY_DAY.join(", ")} of ${POD_SIZE}`}>
        {AVG_BY_DAY.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[12px] font-semibold tabular-nums text-ink-soft">{n.toFixed(1)}</span>
            <div
              className={`grow-y w-full rounded-md ${i === 4 ? "bg-terra" : "bg-sage-soft"}`}
              style={{ height: (n / POD_SIZE) * H, transitionDelay: `${i * 70}ms` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {DAYS.map((d, i) => (
          <span key={i} className={`flex-1 text-center text-[13px] font-semibold ${i === 4 ? "text-terra" : "text-muted"}`}>
            {d}
          </span>
        ))}
      </div>
    </InView>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: string }) {
  return (
    <section className="mt-4 rounded-[24px] border border-line bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[18px] font-semibold text-ink">{title}</h2>
        {aside && <span className="text-[13px] text-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export default async function RecapDemo() {
  const { tz } = await demoViewer();
  const lastWeek = new Date(weekStartUtc(tz, 1).getTime() - 3 * 86400000);
  const range = weekRangeShort(tz, 1, lastWeek);

  return (
    <main className="px-5 pb-32 pt-4">
      <DemoTopBar current="recap" />

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[14px] text-muted">Sunday night · {range}</span>
        <span className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[13px] font-semibold text-paper">
          <span aria-hidden className="text-[#E3B04B]">✦</span> Written by Pod AI
        </span>
      </div>

      <h1 className="mt-3 font-serif text-[32px] font-semibold leading-[1.12] text-ink">
        Three Pod Perfect weeks in a row.
      </h1>
      <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">
        Back Bay Movers logged 19 active days and one rest day, and all five of you hit your own goal.
      </p>

      <Section title="Who moved each day" aside={range}>
        <div className="mt-3">
          <WhoMovedGrid />
        </div>
        <ul className="mt-3 flex flex-col gap-3 text-[16px] leading-relaxed text-ink-soft">
          <li>
            <b className="font-semibold text-ink">Thursday</b> was your best day: all five of you moved.
          </li>
          <li>
            <b className="font-semibold text-ink">Maya</b> was the only one to move on Friday, and went 5 for her 4.
          </li>
          <li>
            <b className="font-semibold text-ink">Priya</b> took a rest day on Wednesday. It counted, and she still finished 5 of 5.
          </li>
          <li>
            <b className="font-semibold text-ink">Sam</b> made it on Sunday evening, after Jordan&apos;s nudge.
          </li>
        </ul>
      </Section>

      <Section title="Patterns" aside="last 6 weeks">
        <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">
          Members active on each day, on average:
        </p>
        <div className="mt-3">
          <DayAverages />
        </div>
        <p className="mt-4 text-[16px] leading-relaxed text-ink">
          <b className="font-semibold">Fridays are your quiet day.</b> About 1 of 5 of you moves, against 4 or more on
          Thursdays. Here&apos;s what the last 6 weeks suggest:
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {[
            {
              who: "You, Jordan and Priya",
              initials: ["AJ", "JK", "PS"],
              colors: ["#c8553d", "#d9a441", "#5b7fa6"],
              text: "play Thursday padel, which usually starts at 8 pm. None of you has logged a Friday in 5 of the last 6 weeks. The late Thursday seems to take Friday with it.",
            },
            {
              who: "Sam",
              initials: ["SO"],
              colors: ["#8a6f9e"],
              text: "has needed Sunday to hit his goal in 4 of the last 6 weeks. He starts fine on Mondays; it's the middle of the week that slips.",
            },
            {
              who: "Maya",
              initials: ["MR"],
              colors: ["#7a9471"],
              text: "is the pod's Friday regular: 6 Fridays out of 6, always a morning run.",
            },
          ].map((p) => (
            <li key={p.who} className="flex gap-3 rounded-2xl bg-paper-2/60 p-3.5">
              <span className="flex shrink-0 items-start self-start -space-x-2">
                {p.initials.map((ini, i) => (
                  <span key={ini} className="block h-7 w-7 rounded-full ring-2 ring-paper-2">
                    <Avatar initials={ini} color={p.colors[i]} size={28} />
                  </span>
                ))}
              </span>
              <p className="min-w-0 text-[15px] leading-relaxed text-ink-soft">
                <b className="font-semibold text-ink">{p.who}</b> {p.text}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Plan for next week">
        <ol className="mt-3.5 flex flex-col gap-4">
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-paper">1</span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] leading-relaxed text-ink-soft">
                <b className="font-semibold text-ink">Start Thursday padel at 6 pm instead of 8.</b> Thursday stays your big
                day, and an earlier finish should give Friday back.
              </p>
              <div className="mt-2.5">
                <DemoActionButton label="Suggest Thursday, 6 pm" doneLabel="Suggested to the pod ✓" tone="ink" full={false} />
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-paper">2</span>
            <p className="min-w-0 flex-1 text-[16px] leading-relaxed text-ink-soft">
              <b className="font-semibold text-ink">Give Sam a mid-week day.</b> He&apos;s hit his goal on the last day three
              weeks running. One activity mid-week, like a Wednesday evening walk with someone from the pod, means he
              isn&apos;t chasing his goal on Sunday night.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-paper">3</span>
            <p className="min-w-0 flex-1 text-[16px] leading-relaxed text-ink-soft">
              <b className="font-semibold text-ink">Welcome Leo.</b> He joins the pod count on Monday. A fourth Pod Perfect
              week in a row earns everyone on WHOOP the 1,000-point bonus.
            </p>
          </li>
        </ol>
      </Section>

      <section className="mt-4 rounded-[24px] border border-terra/30 bg-terra/[0.06] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[18px] font-semibold text-ink">A message for Sam, drafted</h2>
          <span className="text-[13px] text-muted">From you</span>
        </div>
        <p className="mt-3 rounded-2xl bg-card p-4 text-[16px] leading-relaxed text-ink">
          Sam, three Sundays in a row is clutch 😅 Want to join a Wednesday evening walk with Jordan and me? Takes the
          pressure off Sunday.
        </p>
        <div className="mt-3 flex gap-2">
          <div className="flex-1">
            <DemoActionButton label="Send to Sam" doneLabel="Sent ✓" tone="terra" />
          </div>
          <span className="flex items-center justify-center rounded-full border border-line bg-card px-5 py-2.5 text-[14px] font-semibold text-ink-soft">
            Edit
          </span>
        </div>
      </section>

      <section className="mt-4 rounded-[24px] bg-ink p-5 text-paper shadow-pod-lg">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[18px] font-semibold">Just for you</h2>
          <span className="text-[13px] text-sage-soft">Only you see this</span>
        </div>
        <p className="mt-3 text-[16px] leading-relaxed text-paper/90">
          You&apos;ve missed 5 of the last 6 Fridays. Your Friday recovery has averaged 41%, your lowest day of the week,
          and it&apos;s lowest after the late Thursday padel.
        </p>
        <p className="mt-3 text-[16px] leading-relaxed text-paper/90">
          Your three best weeks this fall all started with a Monday log.
        </p>
        <p className="mt-3 text-[16px] font-semibold leading-relaxed text-paper">
          Try a 20-minute walk on Friday. It counts, and it won&apos;t dig the hole deeper.
        </p>
      </section>

      <p className="mt-4 text-[13px] leading-relaxed text-muted">
        The pod&apos;s recap only uses what the pod already sees: who was active, rest days, and how many members were in
        each recovery zone. Anything from your own WHOOP data stays in &ldquo;Just for you&rdquo;.
      </p>

      <DemoPager current="recap" />
    </main>
  );
}
