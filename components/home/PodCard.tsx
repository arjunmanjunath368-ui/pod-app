import Avatar from "@/components/Avatar";
import Ring from "./Ring";
import { WeekDots } from "./WeekStrip";
import { CountUp } from "./InView";
import type { MemberRow, PodData } from "./types";

// One pod's week: the pod's own name, how much of everyone's goals is done,
// and each member's week at a glance. Percentages, not fractions, so a 3-day
// goal and a 6-day goal read the same way.

function MemberLine({
  m,
  actions,
  monthShort,
}: {
  m: MemberRow;
  actions?: React.ReactNode;
  monthShort: string;
}) {
  const status = m.paused
    ? m.pausedText ?? "⏸ Paused this week"
    : m.restToday
      ? "💤 Rest day today"
      : !m.hasGoal
        ? m.isMe
          ? "Set your goal to join the count"
          : "Getting set up"
        : m.goalText;

  return (
    <li className="py-3.5 first:pt-1">
      <div className="flex items-center gap-3">
        <Avatar url={m.avatarUrl} initials={m.initials} color={m.color} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[17px] font-semibold text-ink">{m.name}</span>
            {m.isMe && (
              <span className="shrink-0 rounded-full bg-paper-2 px-2 py-0.5 text-[13px] font-semibold text-muted">
                you
              </span>
            )}
            {m.whoop && (
              <span className="shrink-0 rounded-full bg-ink px-1.5 py-0.5 text-[12px] font-bold tracking-wide text-paper">
                WHOOP
              </span>
            )}

          </div>
          <div className="mt-0.5 truncate text-[16px] text-muted">{status}</div>
          {!m.paused && m.hasGoal && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <WeekDots days={m.week} />
              {m.monthActive !== null && m.monthActive > 0 && (
                <span className="text-[14px] font-semibold text-muted">
                  {m.monthActive} {m.monthActive === 1 ? "day" : "days"} in {monthShort}
                </span>
              )}
            </div>
          )}
        </div>
        {!m.paused && m.hasGoal && (
          <div className="shrink-0 text-right">
            <div
              className={`text-[22px] font-semibold leading-none tabular-nums ${
                m.pct >= 100 ? "text-sage" : "text-ink"
              }`}
            >
              {m.pct}
              <span className="text-[15px] font-medium text-muted">%</span>
            </div>
            <div className="mt-1 text-[15px] tabular-nums text-muted">
              {m.done} of {m.target} days
            </div>
          </div>
        )}
      </div>
      {m.startsMonday && !m.paused && m.hasGoal && (
        <p className="mt-2 pl-[52px] text-[15px] leading-snug text-muted">
          New this week. Joins the pod total on Monday.
        </p>
      )}
      {!m.paused && !m.isMe && m.quietDays >= 5 && (
        <p className="mt-2 pl-[52px] text-[14px] text-muted">Quiet for {m.quietDays} days</p>
      )}
      {actions && <div className="mt-2.5 flex justify-end gap-2">{actions}</div>}
    </li>
  );
}

export default function PodCard({
  pod,
  headerActions,
  renderActions,
  footer,
  chat,
}: {
  pod: PodData;
  headerActions?: React.ReactNode;
  renderActions?: (m: MemberRow) => React.ReactNode;
  footer?: React.ReactNode;
  chat?: React.ReactNode; // quick messages with the pod, under the week summary
}) {
  const warmUp = !pod.hasGoalRows && pod.goalsSet > 0;
  const monthShort = pod.monthShort ?? "this month";
  return (
    <section className="mt-5 rounded-[28px] border border-line bg-card px-5 pb-3 pt-5 shadow-pod">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-[24px] font-semibold leading-tight text-ink">
            {pod.name}
          </h2>
          <div className="mt-0.5 text-[15px] text-muted">
            This week · {pod.weekRange}
            {pod.photoProof && " · 📸 photo proof"}
          </div>
        </div>
        {headerActions && <div className="flex shrink-0 items-center gap-2">{headerActions}</div>}
      </div>

      <div className="mt-4 flex items-center gap-4 rounded-2xl bg-paper-2/60 p-3.5">
        <Ring
          pct={pod.pct}
          size={78}
          stroke={8}
          color={pod.perfect ? "#7a9471" : "#c8553d"}
          track="rgba(26,46,31,0.08)"
          label={`Pod goals: ${pod.pct}%`}
        >
          <span className="text-[20px] font-semibold leading-none tabular-nums text-ink">
            <CountUp value={pod.pct} />
            <span className="text-[14px] font-medium text-muted">%</span>
          </span>
        </Ring>
        <div className="min-w-0">
          <div className="text-[16px] text-muted">of the pod's goals done</div>
          <div className="mt-0.5 text-[17px] font-semibold leading-snug text-ink">
            {pod.perfect
              ? "Pod Perfect week. Everyone showed up 🎉"
              : warmUp
                ? `${pod.remaining} active ${pod.remaining === 1 ? "day" : "days"} to a perfect first week`
                : `${pod.remaining} active ${pod.remaining === 1 ? "day" : "days"} from a Pod Perfect week`}
          </div>
          <div className="mt-1.5">
            {pod.streak > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/[0.16] px-2.5 py-0.5 text-[14px] font-semibold text-ink">
                🔥 {pod.streak}-week pod streak
              </span>
            ) : warmUp ? (
              <span className="text-[14px] text-muted">Warm-up week. The pod streak starts Monday.</span>
            ) : (
              <span className="text-[14px] text-muted">A Pod Perfect week starts the streak.</span>
            )}
          </div>
        </div>
      </div>

      {chat}

      <ul className="mt-2 divide-y divide-line/70">
        {pod.members.map((m) => (
          <MemberLine key={m.userId} m={m} actions={renderActions?.(m)} monthShort={monthShort} />
        ))}
      </ul>
      {footer}
    </section>
  );
}
