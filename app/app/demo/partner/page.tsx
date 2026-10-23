import { DemoTopBar, DemoNext } from "@/components/home/DemoNav";

export const dynamic = "force-dynamic";

// Demo: what WHOOP would see during a Pod pilot. Every number is simulated,
// shaped on the base case of the 60-day trial model (trial starts 50%,
// trial-to-paid 45% today, +15% inside a pod, 60% earn the extra 30 days).

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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Members still active by week: in a pod 88% at week 12, solo 71%">
      {[60, 70, 80, 90, 100].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(26,46,31,0.08)" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#6b7b67">
            {v}%
          </text>
        </g>
      ))}
      {[0, 4, 8, 12].map((w) => (
        <text key={w} x={x(w)} y={H - 8} textAnchor="middle" fontSize="10" fill="#6b7b67">
          {w === 0 ? "Start" : `Wk ${w}`}
        </text>
      ))}
      <path d={path(SOLO)} fill="none" stroke="#a9a08a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={path(POD)} fill="none" stroke="#c8553d" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(12)} cy={y(88)} r="3.5" fill="#c8553d" />
      <circle cx={x(12)} cy={y(71)} r="3.5" fill="#a9a08a" />
      <text x={x(12) + 7} y={y(88) + 4} fontSize="11" fontWeight="600" fill="#c8553d">
        Pod 88%
      </text>
      <text x={x(12) + 7} y={y(71) + 4} fontSize="11" fontWeight="600" fill="#6b7b67">
        Solo 71%
      </text>
    </svg>
  );
}

function Kpi({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3.5">
      <div className="text-[26px] font-semibold leading-none tabular-nums text-ink">{value}</div>
      <div className="mt-1.5 text-[13px] font-semibold leading-snug text-ink">{label}</div>
      <div className="mt-0.5 text-[12px] leading-snug text-muted">{sub}</div>
    </div>
  );
}

const FUNNEL = [
  { label: "Non-member friends invited into pods", n: 1840 },
  { label: "Started a WHOOP trial", n: 920 },
  { label: "Earned 30 more days by showing up", n: 552 },
  { label: "Became paying members", n: 476 },
];

export default function PartnerViewDemo() {
  const top = FUNNEL[0].n;
  return (
    <main className="px-5 pb-16 pt-4">
      <DemoTopBar current="partner" />

      <h1 className="mt-5 font-serif text-[26px] font-semibold leading-tight text-ink">Pod × WHOOP pilot</h1>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">
        What WHOOP sees, 90 days in. 2,400 members in 620 pods, compared with similar members not in a pod.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <Kpi value="+17 pts" label="Still active at week 12" sub="88% in a pod vs 71% solo" />
        <Kpi value="3.8" label="Active days a week" sub="vs 2.4 for solo members" />
        <Kpi value="476" label="New paying members" sub="from friends invited into pods" />
        <Kpi value="52%" label="Trial to paid" sub="vs 45% for today's trial" />
      </div>

      <section className="mt-4 rounded-[24px] border border-line bg-card p-4">
        <h2 className="text-[15px] font-semibold text-ink">Members still active, by week</h2>
        <p className="mt-0.5 text-[12px] text-muted">Active = wearing WHOOP and logging at least one activity that week</p>
        <div className="mt-3">
          <RetentionChart />
        </div>
      </section>

      <section className="mt-4 rounded-[24px] border border-line bg-card p-4">
        <h2 className="text-[15px] font-semibold text-ink">Friends who joined WHOOP through a pod</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {FUNNEL.map((f, i) => (
            <li key={f.label}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-ink-soft">{f.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-ink">{f.n.toLocaleString("en-US")}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-paper-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(f.n / top) * 100}%`, backgroundColor: i === FUNNEL.length - 1 ? "#c8553d" : "#a9bda0" }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-[24px] bg-ink p-4 text-paper shadow-pod-lg">
        <h2 className="text-[15px] font-semibold">This week: pods going quiet</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { v: "41", l: "pods quiet 4+ days" },
            { v: "158", l: "members nudged by Pod" },
            { v: "64%", l: "back within 3 days" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-paper/[0.07] px-2 py-3">
              <div className="text-[22px] font-semibold leading-none tabular-nums">{s.v}</div>
              <div className="mt-1.5 text-[11px] leading-snug text-sage-soft">{s.l}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-paper/90">
          Before anyone thinks about cancelling, their pod has already noticed. WHOOP gets the
          early warning; Pod does the nudging.
        </p>
      </section>

      <DemoNext current="partner" />

      <p className="mt-6 text-center text-[12px] leading-relaxed text-muted">
        All numbers are simulated to show what a pilot would measure.
        <br />
        Pod isn't affiliated with or endorsed by WHOOP.
      </p>
    </main>
  );
}
