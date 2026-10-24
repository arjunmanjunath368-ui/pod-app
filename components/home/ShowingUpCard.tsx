import { scoreLabel, scoreParts, SCORE_WEEKS, type ScoreWeek } from "@/lib/showingUp";
import InView, { CountUp } from "./InView";

// Pod's own metric: consistency over the last 8 weeks, in plain numbers. Each
// bar is one week, drawn to scale: full height = the whole goal.

export default function ShowingUpCard({
  score,
  delta,
  weeks,
  podScore,
}: {
  score: number;
  delta: number; // change vs a month ago
  weeks: ScoreWeek[]; // last 8 finished weeks, oldest first
  podScore?: number;
}) {
  const H = 56;
  const { done, target } = scoreParts(weeks);
  return (
    <section className="mt-4 rounded-[28px] border border-line bg-card p-5 shadow-pod">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-semibold text-ink">Showing Up Score</h2>
          <div className="mt-1.5 text-[46px] font-semibold leading-none text-ink">
            <CountUp value={score} />
          </div>
          <div className="mt-1 text-[16px] font-semibold text-sage">
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs a month ago
          </div>
        </div>
        <span className="rounded-full bg-gold/[0.18] px-3 py-1 text-[15px] font-semibold text-ink">
          {scoreLabel(score)}
        </span>
      </div>

      <p className="mt-3 text-[17px] leading-relaxed text-ink">
        <b className="font-semibold">{done} of {target} goal days</b> in the last {SCORE_WEEKS} weeks.
      </p>

      <InView className="mt-4">
        <div
          className="flex items-end gap-1.5"
          style={{ height: H + 20 }}
          role="img"
          aria-label={`Days hit each week: ${weeks.map((w) => `${w.done} of ${w.target}`).join(", ")}`}
        >
          {weeks.map((w, i) => {
            const full = w.done >= w.target;
            return (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className={`text-[13px] font-semibold tabular-nums ${full ? "text-ink" : "text-muted"}`}>
                  {Math.min(w.done, w.target)}/{w.target}
                </span>
                <div
                  className={`grow-y w-full rounded-md ${full ? "bg-[#E3B04B]" : "bg-[#E3B04B]/35"}`}
                  style={{ height: Math.max(4, (Math.min(w.done, w.target) / w.target) * H), transitionDelay: `${i * 60}ms` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[14px] text-muted">
          <span>8 weeks ago</span>
          <span>Last week</span>
        </div>
      </InView>

      <div className="mt-4 rounded-2xl bg-paper-2/70 p-3.5 text-[16px] leading-relaxed text-ink-soft">
        <b className="font-semibold text-ink">How it&apos;s worked out:</b> days you showed up ÷ days you aimed for:{" "}
        {done} ÷ {target} = {score}. Rest days count; extra days don&apos;t.
        {podScore !== undefined && (
          <>
            {" "}
            Pod score: <b className="font-semibold text-ink">{podScore}</b>.
          </>
        )}
      </div>
    </section>
  );
}
