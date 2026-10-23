import { RING } from "./TodayCard";
import InView from "./InView";

// How ready the pod is this morning, from members' WHOOP recovery. Only the
// counts per zone are shown, never anyone's score. Members without WHOOP
// aren't counted.

type Zone = "green" | "yellow" | "red";

function Donut({ counts, size = 88, stroke = 10 }: { counts: Record<Zone, number>; size?: number; stroke?: number }) {
  const total = counts.green + counts.yellow + counts.red;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = total > 1 ? 4 : 0;
  let offset = 0;
  const segs = (["green", "yellow", "red"] as Zone[])
    .filter((z) => counts[z] > 0)
    .map((z) => {
      const len = (counts[z] / total) * c;
      const seg = { z, len: Math.max(len - gap, 1), offset };
      offset += len;
      return seg;
    });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(244,240,230,0.08)" strokeWidth={stroke} />
      {segs.map((s) => (
        <circle
          key={s.z}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={RING.zone[s.z]}
          strokeWidth={stroke}
          strokeDasharray={`${s.len} ${c - s.len}`}
          strokeDashoffset={-s.offset}
        />
      ))}
    </svg>
  );
}

export default function PodReadiness({
  podName,
  counts,
  notOnWhoop,
  suggestion,
  action,
}: {
  podName: string;
  counts: Record<Zone, number>;
  notOnWhoop: number;
  suggestion: string;
  action?: React.ReactNode;
}) {
  const total = counts.green + counts.yellow + counts.red;
  return (
    <section className="mt-4 rounded-[28px] bg-ink p-5 text-paper shadow-pod-lg">
      <h2 className="text-[17px] font-semibold">Pod Readiness</h2>
      <p className="mt-0.5 text-[14px] text-sage-soft">Today&apos;s recovery in {podName}</p>

      <InView className="mt-4 flex items-center gap-5">
        <div className="pop-in relative">
          <Donut counts={counts} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[22px] font-semibold leading-none tabular-nums">{total}</span>
            <span className="mt-0.5 text-[10px] text-sage-soft">on WHOOP</span>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5 text-[14px]">
          {(["green", "yellow", "red"] as Zone[]).map((z) => (
            <li key={z} className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RING.zone[z] }} />
              <span className="tabular-nums text-paper">
                <b className="font-semibold">{counts[z]}</b>{" "}
                {z === "green" ? "ready to push" : z === "yellow" ? "take it moderate" : "resting today"}
              </span>
            </li>
          ))}
          {notOnWhoop > 0 && (
            <li className="flex items-center gap-2.5 text-sage-soft/80">
              <span className="h-2.5 w-2.5 rounded-full border border-paper/30" />
              <span>
                {notOnWhoop} not on WHOOP
              </span>
            </li>
          )}
        </ul>
      </InView>

      <div className="mt-4 rounded-2xl bg-paper/[0.07] p-3.5">
        <p className="text-[15px] leading-relaxed text-paper/90">{suggestion}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-sage-soft/80">
        WHOOP scores recovery once a day, when each of you wakes up, so this stays the same until tomorrow
        morning. Only counts are shown; nobody&apos;s score is shared with the pod.
      </p>
    </section>
  );
}
