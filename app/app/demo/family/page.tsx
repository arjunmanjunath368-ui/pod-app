import { DemoTopBar, DemoNext } from "@/components/home/DemoNav";
import FamilyInsight from "@/components/home/FamilyInsight";
import { DemoActionButton } from "@/components/home/DemoParts";

export const dynamic = "force-dynamic";

// Demo: family members share more than a pod does, metric by metric, with
// both people's consent. Metrics shown here are ones WHOOP's developer API
// provides (recovery, sleep and cycle data). Simulated.

type Metric = {
  label: string;
  value: string;
  usual: string;
  // better / worse than usual for her, or just different
  trend: "better" | "worse" | "neutral";
  dir: "up" | "down";
};

const GROUPS: { title: string; rows: Metric[] }[] = [
  {
    title: "Sleep",
    rows: [
      { label: "Sleep performance", value: "61%", usual: "78%", trend: "worse", dir: "down" },
      { label: "Sleep consistency", value: "58%", usual: "74%", trend: "worse", dir: "down" },
      { label: "Hours of sleep", value: "6:12", usual: "7:05", trend: "worse", dir: "down" },
      { label: "Restorative sleep", value: "2:05", usual: "2:51", trend: "worse", dir: "down" },
    ],
  },
  {
    title: "Recovery",
    rows: [
      { label: "Recovery", value: "48%", usual: "63%", trend: "worse", dir: "down" },
      { label: "Heart rate variability", value: "38", usual: "45", trend: "worse", dir: "down" },
      { label: "Resting heart rate", value: "62", usual: "58", trend: "worse", dir: "up" },
      { label: "Respiratory rate", value: "14.8", usual: "14.6", trend: "neutral", dir: "up" },
    ],
  },
  {
    title: "Activity",
    rows: [{ label: "Day strain", value: "9.4", usual: "10.1", trend: "neutral", dir: "down" }],
  },
];

const FAMILY = [
  { name: "Mom", initials: "M", color: "#b07a4f", on: true },
  { name: "Dad", initials: "D", color: "#5b7fa6", on: false },
];

function Row({ m }: { m: Metric }) {
  const color = m.trend === "better" ? "#6FCF7F" : m.trend === "worse" ? "#E8A25A" : "rgba(244,240,230,0.45)";
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-paper/[0.06] px-4 py-3">
      <span className="text-[14px] font-semibold text-paper">{m.label}</span>
      <span className="flex items-center gap-2 text-right">
        <span>
          <span className="block text-[20px] font-semibold leading-none tabular-nums text-paper">{m.value}</span>
          <span className="mt-1 block text-[12px] tabular-nums text-sage-soft">usual {m.usual}</span>
        </span>
        <span aria-label={m.trend === "neutral" ? "about usual" : `${m.trend} than usual`} className="text-[12px]" style={{ color }}>
          {m.dir === "up" ? "▲" : "▼"}
        </span>
      </span>
    </li>
  );
}

export default function FamilyDemo() {
  return (
    <main className="px-5 pb-16 pt-4">
      <DemoTopBar current="family" />

      <h1 className="mt-5 font-serif text-[30px] font-semibold leading-tight text-ink">Family</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
        Family see more than your pod does. Each of you chooses what to share, and either of you can
        stop at any time.
      </p>

      <div className="mt-4 flex items-center gap-2.5">
        {FAMILY.map((f) => (
          <span
            key={f.name}
            className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[14px] font-semibold ${
              f.on ? "bg-ink text-paper" : "bg-card text-ink-soft ring-1 ring-line"
            }`}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-paper"
              style={{ backgroundColor: f.color }}
            >
              {f.initials}
            </span>
            {f.name}
          </span>
        ))}
        <span className="flex h-10 items-center rounded-full border border-dashed border-line px-3.5 text-[14px] font-semibold text-muted">
          + Add
        </span>
      </div>

      <FamilyInsight
        name="Mom"
        insight={
          <>
            Mom&apos;s sleep has averaged <b className="font-semibold">61%</b> this week, down from her
            usual 78%. Yours went from <b className="font-semibold">72% to 89%</b> after you started a
            fixed 10:30 pm bedtime in September.
          </>
        }
        draft="Mom, I saw your sleep's been rough this week. What helped me most was going to bed at 10:30 every night, even on weekends. My sleep went from 72% to 89%. Want to try it together this week?"
      />

      <section className="mt-4 rounded-[28px] bg-ink p-5 text-paper shadow-pod-lg">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Mom · this week</h2>
          <span className="text-[12px] text-sage-soft">vs her usual</span>
        </div>
        {GROUPS.map((g) => (
          <div key={g.title} className="mt-4">
            <h3 className="mb-2 text-[13px] font-semibold text-sage-soft">{g.title}</h3>
            <ul className="flex flex-col gap-2">
              {g.rows.map((m) => (
                <Row key={m.label} m={m} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mt-4 rounded-[24px] border border-line bg-card p-5">
        <h2 className="text-[15px] font-semibold text-ink">What you share with each other</h2>
        <dl className="mt-3 flex flex-col gap-3 text-[14px]">
          <div>
            <dt className="text-[12px] font-semibold text-muted">Mom shares with you</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {["Sleep", "Recovery", "Heart", "Activity"].map((c) => (
                <span key={c} className="rounded-full bg-sage/[0.16] px-2.5 py-1 text-[13px] font-semibold text-ink">
                  {c}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold text-muted">You share with Mom</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {["Sleep", "Recovery"].map((c) => (
                <span key={c} className="rounded-full bg-sage/[0.16] px-2.5 py-1 text-[13px] font-semibold text-ink">
                  {c}
                </span>
              ))}
              {["Heart", "Activity"].map((c) => (
                <span key={c} className="rounded-full border border-dashed border-line px-2.5 py-1 text-[13px] font-semibold text-muted">
                  {c}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-4 rounded-[24px] border border-line bg-card p-5">
        <h2 className="text-[15px] font-semibold text-ink">Working on something?</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
          Ask your family for help. They hear what you&apos;re working on, and Pod shows them what worked
          in their own data.
        </p>
        <div className="mt-3">
          <DemoActionButton label="Ask family about sleep" doneLabel="Asked Mom and Dad ✓" tone="ink" />
        </div>
      </section>

      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        Family sharing starts only when both of you accept. None of it is ever shown to your pods.
      </p>

      <DemoNext current="family" />
    </main>
  );
}
