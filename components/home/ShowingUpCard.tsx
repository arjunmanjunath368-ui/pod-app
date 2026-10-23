import { scoreLabel } from "@/lib/showingUp";

// Pod's own metric: consistency over the last 8 weeks. Bars are drawn to
// scale: each is that week's share of the goal, full height = 100%.

export default function ShowingUpCard({
  score,
  delta,
  weeks,
  podScore,
}: {
  score: number;
  delta: number; // change vs four weeks ago
  weeks: number[]; // % of goal hit per finished week, oldest first
  podScore?: number;
}) {
  const H = 52;
  return (
    <section className="mt-4 rounded-[28px] border border-line bg-card p-5 shadow-pod">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Showing Up Score</h2>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[44px] font-semibold leading-none tabular-nums text-ink">{score}</span>
            <span className="text-[14px] font-semibold text-sage">
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} this month
            </span>
          </div>
        </div>
        <span className="rounded-full bg-gold/[0.18] px-3 py-1 text-[12px] font-semibold text-ink">
          {scoreLabel(score)}
        </span>
      </div>

      <div className="mt-4" role="img" aria-label={`Goal hit over the last ${weeks.length} weeks: ${weeks.join("%, ")}%`}>
        <div className="flex items-end gap-1.5" style={{ height: H }}>
          {weeks.map((p, i) => (
            <div key={i} className="flex flex-1 flex-col justify-end" style={{ height: H }}>
              <div
                className={`w-full rounded-md ${p >= 100 ? "bg-[#E3B04B]" : "bg-paper-2"}`}
                style={{ height: Math.max(4, (Math.min(p, 100) / 100) * H) }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted">
          <span>8 weeks ago</span>
          <span>Last week</span>
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
        WHOOP measures how hard you went. This measures whether you showed up: how
        often you hit your own goal, with recent weeks counting most.
        {podScore !== undefined && (
          <>
            {" "}
            Your pod's score is <b className="font-semibold text-ink">{podScore}</b>.
          </>
        )}
      </p>
    </section>
  );
}
