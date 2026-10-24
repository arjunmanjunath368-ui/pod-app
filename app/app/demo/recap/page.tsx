import { demoViewer } from "@/lib/demoViewer";
import { weekStartUtc } from "@/lib/week";
import { weekRangeShort } from "@/lib/homeModel";
import { DemoTopBar, DemoPager } from "@/components/home/DemoNav";
import { DemoActionButton } from "@/components/home/DemoParts";
import InView from "@/components/home/InView";
import LearnMore from "@/components/home/LearnMore";

export const dynamic = "force-dynamic";

// Demo: the Weekly Huddle, written by Pod AI, that every pod gets on Sunday night. The pod's part is written
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
const AVG_BY_DAY = [4.2, 2.8, 1.3, 4.6, 2.0, 3.6, 1.7];
const QUIET_DAY = 2; // Wednesday
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
              <th key={i} className="text-center text-[15px] font-semibold text-muted">
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
                  <span className="truncate text-[16px] font-semibold text-ink">{m.name}</span>
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
                    {c === "r" && <span className="text-[13px]">💤</span>}
                  </span>
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row" className="pt-1 text-left text-[15px] font-semibold text-muted">
              Moved
            </th>
            {totals.map((t, d) => (
              <td key={d} className={`pt-1 text-center text-[16px] font-semibold tabular-nums ${t === POD_SIZE ? "text-terra" : "text-ink-soft"}`}>
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
            <span className="text-[14px] font-semibold tabular-nums text-ink-soft">{n.toFixed(1)}</span>
            <div
              className={`grow-y w-full rounded-md ${i === QUIET_DAY ? "bg-terra" : "bg-sage-soft"}`}
              style={{ height: (n / POD_SIZE) * H, transitionDelay: `${i * 70}ms` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {DAYS.map((d, i) => (
          <span key={i} className={`flex-1 text-center text-[15px] font-semibold ${i === QUIET_DAY ? "text-terra" : "text-muted"}`}>
            {d}
          </span>
        ))}
      </div>
    </InView>
  );
}

function Section({ id, title, children, aside }: { id?: string; title: string; children: React.ReactNode; aside?: string }) {
  return (
    <section id={id} className="mt-4 scroll-mt-4 rounded-[24px] border border-line bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[20px] font-semibold text-ink">{title}</h2>
        {aside && <span className="text-[15px] text-muted">{aside}</span>}
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
        <div className="min-w-0">
          <div className="text-[17px] font-semibold text-ink">Weekly Huddle</div>
          <div className="text-[15px] text-muted">{range}</div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-3 py-1 text-[15px] font-semibold text-paper">
          <span aria-hidden className="text-[#E3B04B]">✦</span> Written by Pod AI
        </span>
      </div>

      <h1 className="mt-3 font-serif text-[32px] font-semibold leading-[1.12] text-ink">
        A Pod Perfect week, your third in a row.
      </h1>
      <p className="mt-2 text-[19px] leading-relaxed text-ink-soft">
        19 active days, 1 rest day, and all five of you hit your goal.
      </p>

      <section className="mt-4 rounded-[24px] bg-ink p-5 text-paper shadow-pod-lg" aria-labelledby="highlights">
        <h2 id="highlights" className="text-[19px] font-semibold">This week’s highlights</h2>
        <ul className="mt-3 flex flex-col divide-y divide-paper/10">
          {[
            { k: "Best day", t: "Thursday: all five of you moved.", to: "who-moved" },
            { k: "Pattern", t: "Planned days draw 3× the turnout.", to: "patterns" },
            { k: "Next week", t: "A Wednesday walk at 6:30 pm.", to: "plan" },
          ].map((h) => (
            <li key={h.to} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold text-[#E3B04B]">{h.k}</span>
                <LearnMore target={h.to} dark />
              </div>
              <p className="mt-0.5 text-[17px] leading-snug text-paper">{h.t}</p>
            </li>
          ))}
        </ul>
      </section>

      <Section id="who-moved" title="Who moved each day" aside={range}>
        <div className="mt-3">
          <WhoMovedGrid />
        </div>
        <ul className="mt-3 flex flex-col gap-3 text-[17px] leading-relaxed text-ink-soft">
          <li>
            <b className="font-semibold text-ink">Maya:</b> the only Friday mover, 5 days on a 4-day goal.
          </li>
          <li>
            <b className="font-semibold text-ink">Priya:</b> a Wednesday rest day, and still 5 of 5.
          </li>
          <li>
            <b className="font-semibold text-ink">Sam:</b> made it Sunday evening, after Jordan&apos;s nudge.
          </li>
        </ul>
      </Section>

      <Section id="patterns" title="Patterns" aside="last 6 weeks">
        <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">
          Average members active, by day:
        </p>
        <div className="mt-3">
          <DayAverages />
        </div>
        <p className="mt-4 text-[17px] leading-relaxed text-ink">
          <b className="font-semibold">Planned days are your strong days.</b> Monday&apos;s run and Thursday&apos;s padel
          draw 4 or more of you. Wednesday, with nothing planned, draws about 1.
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {[
            {
              who: "You, Jordan and Priya",
              initials: ["AJ", "JK", "PS"],
              colors: ["#c8553d", "#d9a441", "#5b7fa6"],
              text: "have played Thursday padel 6 weeks out of 6. Maya and Sam usually move that night too.",
            },
            {
              who: "Sam",
              initials: ["SO"],
              colors: ["#8a6f9e"],
              text: "has finished his goal on a Sunday night in 4 of the last 6 weeks. Mid-week is where it slips.",
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
              <p className="min-w-0 text-[17px] leading-relaxed text-ink-soft">
                <b className="font-semibold text-ink">{p.who}</b> {p.text}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="plan" title="Plan for next week">
        <ol className="mt-3.5 flex flex-col gap-4">
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-paper">1</span>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] leading-relaxed text-ink-soft">
                <b className="font-semibold text-ink">Plan a Wednesday walk at 6:30 pm.</b> Your only day with nothing
                planned.
              </p>
              <div className="mt-2.5">
                <DemoActionButton label="Suggest Wednesday, 6:30 pm" doneLabel="Suggested to the pod ✓" tone="ink" full={false} />
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-paper">2</span>
            <p className="min-w-0 flex-1 text-[17px] leading-relaxed text-ink-soft">
              <b className="font-semibold text-ink">Invite Sam.</b> A mid-week workout means Sunday isn&apos;t do-or-die.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-paper">3</span>
            <p className="min-w-0 flex-1 text-[17px] leading-relaxed text-ink-soft">
              <b className="font-semibold text-ink">Welcome Leo.</b> He counts from Monday. A fourth perfect week earns the
              1,000-point bonus.
            </p>
          </li>
        </ol>
      </Section>

      <section className="mt-4 rounded-[24px] border border-terra/30 bg-terra/[0.06] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[20px] font-semibold text-ink">A message for Sam, drafted</h2>
          <span className="text-[15px] text-muted">From you</span>
        </div>
        <p className="mt-3 rounded-2xl bg-card p-4 text-[17px] leading-relaxed text-ink">
          Sam, three Sundays in a row is clutch 😅 Join our Wednesday walk? Takes the pressure off Sunday.
        </p>
        <div className="mt-3 flex gap-2">
          <div className="flex-1">
            <DemoActionButton label="Send to Sam" doneLabel="Sent ✓" tone="terra" />
          </div>
          <span className="flex items-center justify-center rounded-full border border-line bg-card px-5 py-2.5 text-[16px] font-semibold text-ink-soft">
            Edit
          </span>
        </div>
      </section>

      <section className="mt-4 rounded-[24px] bg-ink p-5 text-paper shadow-pod-lg">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[20px] font-semibold">Just for you</h2>
          <span className="text-[15px] text-sage-soft">Only you see this</span>
        </div>
        <p className="mt-3 text-[17px] leading-relaxed text-paper/90">
          Your best weeks start with a Monday run. After Sunday bedtimes before 10:30 pm, Monday recovery averages 71%;
          after later nights, 48%.
        </p>
        <p className="mt-3 text-[17px] font-semibold leading-relaxed text-paper">
          Keep Sunday nights early. Monday sets up your week.
        </p>
      </section>

      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        The Huddle uses only what the pod already sees. Your own WHOOP data stays in &ldquo;Just for you&rdquo;.
      </p>

      <DemoPager current="recap" />
    </main>
  );
}
