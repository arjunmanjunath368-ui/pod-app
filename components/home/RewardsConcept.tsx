// Demo pod only. A concept for pod rewards with WHOOP: the pod earns together,
// so nobody wins by leaving someone behind. Clearly marked as a concept.
//
// Only verified days count toward rewards (synced from WHOOP, or logged with a
// live photo), so a manual log can't earn anything. Points go to members on
// WHOOP; members who aren't yet get a free trial when the pod hits its run.

export default function RewardsConcept({
  perfectWeeks,
  goal,
  pointsPerWeek,
  remaining,
  whoopMembers,
}: {
  perfectWeeks: number;
  goal: number;
  pointsPerWeek: number;
  remaining: number;
  whoopMembers: number;
}) {
  const earned = perfectWeeks * pointsPerWeek;
  return (
    <section className="mt-5 overflow-hidden rounded-[28px] bg-ink p-5 text-paper shadow-pod-lg">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Pod rewards with WHOOP</h2>
        <span className="rounded-full border border-paper/25 px-2.5 py-0.5 text-[11px] font-semibold text-sage-soft">
          Concept
        </span>
      </div>
      <p className="mt-1.5 text-[14px] leading-relaxed text-sage-soft">
        Every verified Pod Perfect week earns {pointsPerWeek} WHOOP points for each
        member on WHOOP. {goal} in a row unlocks 60 days of WHOOP free for
        pod-mates who aren't members yet.
      </p>

      <div className="mt-4 grid grid-cols-4 gap-1.5" aria-label={`${perfectWeeks} of ${goal} Pod Perfect weeks`}>
        {Array.from({ length: goal }, (_, i) => {
          const done = i < perfectWeeks;
          const current = i === perfectWeeks;
          return (
            <div key={i} className="flex flex-col gap-1.5">
              <div
                className={`h-2 rounded-full ${
                  done ? "bg-[#E3B04B]" : current ? "bg-paper/25" : "bg-paper/10"
                }`}
              />
              <span className={`text-[11px] ${done ? "text-paper" : "text-sage-soft/70"}`}>
                {done ? `Week ${i + 1} ✓` : current ? "This week" : `Week ${i + 1}`}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-paper/10 pt-4">
        <div>
          <div className="text-[28px] font-semibold leading-none tabular-nums">
            {earned.toLocaleString("en-US")}
          </div>
          <div className="mt-1 text-[12px] text-sage-soft">
            points each for {whoopMembers} WHOOP members
          </div>
        </div>
        <div className="max-w-[55%] text-right text-[13px] leading-snug text-paper/90">
          {remaining} more active {remaining === 1 ? "day" : "days"} across the pod completes week {Math.min(perfectWeeks + 1, goal)}.
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-sage-soft/80">
        Only verified days count toward rewards: synced from WHOOP, or logged
        with a live photo.
      </p>
    </section>
  );
}
