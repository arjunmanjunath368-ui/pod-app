import { buildDemo } from "@/lib/demoPod";
import { demoViewer } from "@/lib/demoViewer";
import { weekStartUtc } from "@/lib/week";
import { weekRangeShort } from "@/lib/homeModel";
import { DemoTopBar, DemoNext } from "@/components/home/DemoNav";
import { DemoActionButton } from "@/components/home/DemoParts";

export const dynamic = "force-dynamic";

// Demo: the AI recap every pod gets on Sunday night. Written only from what
// the pod can already see (who was active, rest days, counts of recovery
// zones), plus a private section built from the member's own WHOOP data.

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
// Last week, members active each day (rest days not counted). Matches the
// demo pod: Thursday everyone moved; Wednesday, Friday and Sunday were quiet.
const ACTIVE_BY_DAY = [4, 3, 1, 5, 1, 4, 1];
const POD_SIZE = 5;

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-paper"
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}

function DayBars() {
  const H = 64;
  return (
    <div role="img" aria-label={`Members active each day last week: ${ACTIVE_BY_DAY.join(", ")} of ${POD_SIZE}`}>
      <div className="flex items-end gap-2" style={{ height: H + 18 }}>
        {ACTIVE_BY_DAY.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] font-semibold tabular-nums text-ink-soft">{n}</span>
            <div
              className={`w-full rounded-md ${n === POD_SIZE ? "bg-terra" : "bg-sage-soft"}`}
              style={{ height: (n / POD_SIZE) * H }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {DAYS.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[11px] font-semibold text-muted">
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function RecapDemo() {
  const { firstName, tz } = await demoViewer();
  const demo = buildDemo(tz, firstName);
  const lastWeek = new Date(weekStartUtc(tz, 1).getTime() - 3 * 86400000);
  const range = weekRangeShort(tz, 1, lastWeek);

  return (
    <main className="px-5 pb-16 pt-4">
      <DemoTopBar current="recap" />

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted">Sunday night · {range}</span>
        <span className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-paper">
          <span aria-hidden className="text-[#E3B04B]">✦</span> Written by Pod AI
        </span>
      </div>

      <h1 className="mt-3 font-serif text-[30px] font-semibold leading-[1.15] text-ink">
        Three Pod Perfect weeks in a row.
      </h1>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">
        {demo.pod.name} logged 19 active days and one rest day, and all five of you hit
        your own goal.
      </p>

      <section className="mt-6 rounded-[24px] border border-line bg-card p-5">
        <h2 className="text-[15px] font-semibold text-ink">How the week went</h2>
        <ul className="mt-3.5 flex flex-col gap-3.5">
          <li className="flex gap-3">
            <Avatar initials="PS" color="#5b7fa6" />
            <p className="text-[14px] leading-relaxed text-ink-soft">
              <b className="font-semibold text-ink">Priya</b> took a rest day on Wednesday. It counted,
              and she still finished 5 of 5.
            </p>
          </li>
          <li className="flex gap-3">
            <Avatar initials="MR" color="#7a9471" />
            <p className="text-[14px] leading-relaxed text-ink-soft">
              <b className="font-semibold text-ink">Maya</b> was the only one to move on Friday, and went
              5 for her 4.
            </p>
          </li>
          <li className="flex gap-3">
            <Avatar initials="SO" color="#8a6f9e" />
            <p className="text-[14px] leading-relaxed text-ink-soft">
              <b className="font-semibold text-ink">Sam</b> made it on Sunday evening after Jordan&apos;s
              nudge. That&apos;s three weeks running he&apos;s finished on the last day.
            </p>
          </li>
        </ul>

        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-[14px] font-semibold text-ink">Who moved each day</h3>
          <div className="mt-3">
            <DayBars />
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
            Thursday is your pod&apos;s day: all five of you moved. Wednesday was the dip, when 2 of the 4
            on WHOOP woke up in the red.
          </p>
        </div>
      </section>

      <section className="mt-4 rounded-[24px] border border-line bg-card p-5">
        <h2 className="text-[15px] font-semibold text-ink">Plan for next week</h2>
        <ol className="mt-3.5 flex flex-col gap-4">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-paper">
              1
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-relaxed text-ink-soft">
                <b className="font-semibold text-ink">Make Thursday a group session.</b> It&apos;s already
                your best day, and 4 of you usually move in the evening.
              </p>
              <div className="mt-2.5">
                <DemoActionButton label="Suggest Thursday, 6 pm" doneLabel="Suggested to the pod ✓" tone="ink" full={false} />
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-paper">
              2
            </span>
            <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-ink-soft">
              <b className="font-semibold text-ink">Give Sam a Wednesday.</b> A mid-week log takes the
              Sunday pressure off.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-paper">
              3
            </span>
            <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-ink-soft">
              <b className="font-semibold text-ink">Welcome Leo.</b> He joins the pod count on Monday. Four
              Pod Perfect weeks in a row earns everyone on WHOOP the 1,000-point bonus.
            </p>
          </li>
        </ol>
      </section>

      <section className="mt-4 rounded-[24px] border border-terra/30 bg-terra/[0.06] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink">A nudge for Sam, drafted</h2>
          <span className="text-[12px] text-muted">From you</span>
        </div>
        <p className="mt-2.5 rounded-2xl bg-card p-3.5 text-[15px] leading-relaxed text-ink">
          Sam, three Sundays in a row is clutch, but let&apos;s not make it a habit 😅 Wednesday evening
          padel with Jordan and me?
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <DemoActionButton label="Send to Sam" doneLabel="Sent ✓" tone="terra" />
          <span className="flex items-center justify-center rounded-full border border-line bg-card px-4 py-2.5 text-[14px] font-semibold text-ink-soft">
            Edit
          </span>
        </div>
      </section>

      <section className="mt-4 rounded-[24px] bg-ink p-5 text-paper shadow-pod-lg">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Just for you</h2>
          <span className="text-[12px] text-sage-soft">Only you see this</span>
        </div>
        <p className="mt-2.5 text-[15px] leading-relaxed text-paper/90">
          Your recovery averaged 64% last week, lowest on Friday after Thursday&apos;s late session. Your
          three best weeks this fall all started with a Monday log.
        </p>
        <p className="mt-2 text-[15px] font-semibold leading-relaxed text-paper">
          Monday, 6 pm? Pod will nudge you then.
        </p>
      </section>

      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        The pod recap only uses what the pod already sees: who was active, rest days, and how many
        members were in each recovery zone. Nobody&apos;s scores are shared.
      </p>

      <DemoNext current="recap" />
    </main>
  );
}
