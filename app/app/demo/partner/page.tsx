import { DemoTopBar, DemoPager } from "@/components/home/DemoNav";
import InView, { CountUp } from "@/components/home/InView";

export const dynamic = "force-dynamic";

// Demo: what WHOOP would see during a Pod pilot. Every number is simulated,
// shaped on the base case of the 60-day trial model (trial starts 50%,
// trial-to-paid 45% today, +15% inside a pod, 60% earn the extra 30 days).

const POD_COLOR = "#c8553d";
const SOLO_COLOR = "#a9a08a";

const POD = [100, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88.5, 88];
const SOLO = [100, 96, 93, 90, 87, 84, 81, 79, 77, 75, 73, 72, 71];

function RetentionChart() {
  const W = 320;
  const H = 180;
  const pad = { l: 34, r: 62, t: 12, b: 26 };
  const yMin = 60;
  const yMax = 100;
  const x = (i: number) => pad.l + (i / 12) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((yMax - v) / (yMax - yMin)) * (H - pad.t - pad.b);
  const path = (s: number[]) => s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <InView>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Members still active by week: in a pod 88% at week 12, on their own 71%">
        {[60, 70, 80, 90, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(26,46,31,0.08)" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#6b7b67">
              {v}%
            </text>
          </g>
        ))}
        {[0, 4, 8, 12].map((w) => (
          <text key={w} x={x(w)} y={H - 8} textAnchor="middle" fontSize="12" fill="#6b7b67">
            {w === 0 ? "Start" : `Wk ${w}`}
          </text>
        ))}
        <path d={path(SOLO)} pathLength={1} className="draw-line" fill="none" stroke={SOLO_COLOR} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={path(POD)} pathLength={1} className="draw-line" fill="none" stroke={POD_COLOR} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <g className="pop-in" style={{ transitionDelay: "1.2s" }}>
          <circle cx={x(12)} cy={y(88)} r="3.5" fill={POD_COLOR} />
          <circle cx={x(12)} cy={y(71)} r="3.5" fill={SOLO_COLOR} />
          <text x={x(12) + 7} y={y(88) + 4} fontSize="13" fontWeight="600" fill={POD_COLOR}>
            Pod 88%
          </text>
          <text x={x(12) + 7} y={y(71) + 4} fontSize="13" fontWeight="600" fill="#6b7b67">
            Solo 71%
          </text>
        </g>
      </svg>
    </InView>
  );
}

// One comparison: pod members vs a comparison group, as two bars.
function Compare({
  title,
  explain,
  pod,
  solo,
  max,
  unit,
  decimals = 0,
  soloLabel = "On their own",
  gap,
}: {
  title: string;
  explain: string;
  pod: number;
  solo: number;
  max: number;
  unit: string;
  decimals?: number;
  soloLabel?: string;
  gap: string;
}) {
  const fmt = (v: number) => (unit === "of100" ? `${v} of 100` : `${v.toFixed(decimals)}${unit}`);
  return (
    <section className="rounded-[24px] border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[19px] font-semibold leading-snug text-ink">{title}</h2>
        <span className="shrink-0 rounded-full bg-sage/[0.2] px-3 py-1 text-[15px] font-semibold text-ink">{gap}</span>
      </div>
      <p className="mt-1 text-[16px] leading-relaxed text-ink-soft">{explain}</p>
      <InView className="mt-3 flex flex-col gap-2.5">
        {[
          { label: "In a pod", v: pod, color: POD_COLOR },
          { label: soloLabel, v: solo, color: SOLO_COLOR },
        ].map((r, i) => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between text-[16px]">
              <span className="font-semibold text-ink-soft">{r.label}</span>
              <span className="text-[20px] font-semibold tabular-nums" style={{ color: i === 0 ? POD_COLOR : "#6b7b67" }}>
                {fmt(r.v)}
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-paper-2">
              <div
                className="grow-x h-full rounded-full"
                style={{ width: `${(r.v / max) * 100}%`, backgroundColor: r.color, transitionDelay: `${i * 150}ms` }}
              />
            </div>
          </div>
        ))}
      </InView>
    </section>
  );
}

const FUNNEL = [
  { label: "Friends without WHOOP invited into pods", n: 1840 },
  { label: "Started a free WHOOP trial", n: 920 },
  { label: "Earned 30 more free days by showing up", n: 552 },
  { label: "Became paying members", n: 476 },
];

export default function PartnerViewDemo() {
  const top = FUNNEL[0].n;
  return (
    <main className="px-5 pb-32 pt-4">
      <DemoTopBar current="partner" />

      <h1 className="mt-5 font-serif text-[32px] font-semibold leading-tight text-ink">WHOOP Admin View</h1>
      <p className="mt-1.5 text-[17px] leading-relaxed text-ink-soft">
        What WHOOP would see 90 days into a Pod pilot: 2,400 members in 620 pods, compared with similar members who
        aren&apos;t in a pod.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        <Compare
          title="Still active after 12 weeks"
          explain="Out of every 100 members, how many still wore WHOOP and logged at least one activity in week 12."
          pod={88}
          solo={71}
          max={100}
          unit="of100"
          gap="17 more per 100"
        />
        <Compare
          title="Active days a week"
          explain="On average, how many days a week members logged at least one activity."
          pod={3.8}
          solo={2.4}
          max={5}
          unit=" days"
          decimals={1}
          gap="1.4 more days"
        />
        <Compare
          title="Free trials that turned into paying members"
          explain="Out of every 100 friends who start a free WHOOP trial, how many go on to pay. The usual-trial figure is an industry benchmark, since WHOOP doesn't publish its own."
          pod={52}
          solo={45}
          max={100}
          unit="of100"
          soloLabel="Usual WHOOP trial"
          gap="7 more per 100"
        />
      </div>

      <section className="mt-3 rounded-[24px] border border-line bg-card p-4">
        <h2 className="text-[19px] font-semibold text-ink">Members still active, week by week</h2>
        <p className="mt-1 text-[16px] text-muted">The gap opens early and keeps growing.</p>
        <div className="mt-3">
          <RetentionChart />
        </div>
      </section>

      <section className="mt-3 rounded-[24px] border border-line bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[19px] font-semibold text-ink">New members who came through a pod</h2>
          <span className="text-[24px] font-semibold tabular-nums text-terra">
            <CountUp value={476} />
          </span>
        </div>
        <InView className="mt-3 flex flex-col gap-3">
          {FUNNEL.map((f, i) => (
            <div key={f.label}>
              <div className="flex items-baseline justify-between gap-3 text-[16px]">
                <span className="text-ink-soft">{f.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-ink">{f.n.toLocaleString("en-US")}</span>
              </div>
              <div className="mt-1 h-2.5 rounded-full bg-paper-2">
                <div
                  className="grow-x h-full rounded-full"
                  style={{
                    width: `${(f.n / top) * 100}%`,
                    backgroundColor: i === FUNNEL.length - 1 ? POD_COLOR : "#a9bda0",
                    transitionDelay: `${i * 140}ms`,
                  }}
                />
              </div>
            </div>
          ))}
        </InView>
      </section>

      <section className="mt-3 rounded-[24px] bg-ink p-4 text-paper shadow-pod-lg">
        <h2 className="text-[19px] font-semibold">This week: pods going quiet</h2>
        <InView className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { v: 41, s: "", l: "pods quiet for 4+ days" },
            { v: 158, s: "", l: "members Pod nudged" },
            { v: 64, s: "%", l: "back within 3 days" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-paper/[0.07] px-2 py-3">
              <div className="text-[24px] font-semibold leading-none">
                <CountUp value={s.v} />
                {s.s}
              </div>
              <div className="mt-1.5 text-[14px] leading-snug text-sage-soft">{s.l}</div>
            </div>
          ))}
        </InView>
        <p className="mt-3 text-[17px] leading-relaxed text-paper/90">
          Before anyone thinks about cancelling, their pod has already noticed. WHOOP gets the early warning; Pod does
          the nudging.
        </p>
      </section>

      <p className="mt-6 text-center text-[15px] leading-relaxed text-muted">
        All numbers are simulated to show what a pilot would measure.
        <br />
        Pod isn&apos;t affiliated with or endorsed by WHOOP.
      </p>

      <DemoPager current="partner" />
    </main>
  );
}
