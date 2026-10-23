import Link from "next/link";
import Ring from "./Ring";
import { WeekStripLarge } from "./WeekStrip";
import type { TodayData } from "./types";
import { todayStatus } from "@/lib/homeModel";
import WhoopJoin from "./WhoopJoin";
import { CountUp } from "./InView";
import { NudgeChip } from "./NudgeTime";

// The member's own rings, WHOOP-style: how far through this week's goal they
// are, and (with WHOOP) today's recovery and last night's sleep. Recovery and sleep
// are only ever shown to the member they belong to.

export const RING = {
  week: "#E3B04B",
  sleep: "#8FA8D8",
  zone: { red: "#E0634A", yellow: "#E8C25A", green: "#6FCF7F" },
};

function RingStat({
  pct,
  color,
  label,
  sub,
  muted,
  loading,
}: {
  pct: number;
  color: string;
  label: string;
  sub: string;
  muted?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className={loading ? "animate-pulse" : ""}>
        <Ring pct={muted || loading ? 0 : pct} color={color} muted={muted || loading} label={`${label}: ${muted ? "not available" : `${pct}%`}`}>
          <span
            className={`text-[22px] font-semibold leading-none tabular-nums ${
              muted || loading ? "text-paper/35" : "text-paper"
            }`}
          >
            {muted || loading ? "–" : <CountUp value={pct} />}
            {!muted && !loading && <span className="text-[15px] font-medium text-paper/70">%</span>}
          </span>
        </Ring>
      </div>
      <div className="mt-2 text-[16px] font-semibold text-paper">{label}</div>
      <div className="mt-0.5 max-w-full truncate text-[15px] text-sage-soft/90">{sub}</div>
    </div>
  );
}

export default function TodayCard({
  data,
  loadingWhoop = false,
  connectHref = "/app/settings#whoop",
  demo = false,
}: {
  data: TodayData;
  loadingWhoop?: boolean;
  connectHref?: string;
  demo?: boolean;
}) {
  const { my, whoop } = data;
  const zone = data.recovery?.zone ?? null;
  const whoopLive = whoop === "on";

  const recoverySub = !whoopLive
    ? "WHOOP"
    : data.recovery
      ? data.recovery.zone === "red"
        ? "Red today · rest counts"
        : data.recovery.zone === "yellow"
          ? "Yellow today"
          : "Green today"
      : "Not scored yet";
  const sleepSub = !whoopLive
    ? "WHOOP"
    : data.sleepNeedsReconnect
      ? "Reconnect to add"
      : data.sleep
        ? "Last night"
        : "Not scored yet";

  const status = todayStatus({
    restToday: data.restToday,
    activeToday: data.activeToday,
    hasGoal: my.hasGoal,
    done: my.done,
    target: my.target,
    daysLeft: data.daysLeft,
    zone: whoopLive ? zone : null,
  });

  return (
    <section className="mt-5 rounded-[28px] bg-ink px-5 pb-5 pt-5 text-paper shadow-pod-lg">
      <div className="flex justify-end">
        <span className="rounded-full bg-paper/[0.10] px-3 py-1 text-[16px] font-semibold text-paper">
          {data.dateLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <RingStat
          pct={my.pct}
          color={RING.week}
          label="Weekly goal"
          sub={my.hasGoal ? `${my.done} of ${my.target} days` : "No goal yet"}
        />
        <RingStat
          pct={data.recovery?.score ?? 0}
          color={zone ? RING.zone[zone] : RING.zone.green}
          label="Recovery"
          sub={recoverySub}
          muted={!whoopLive || (!data.recovery && !loadingWhoop)}
          loading={whoopLive && loadingWhoop}
        />
        <RingStat
          pct={data.sleep?.performance ?? 0}
          color={RING.sleep}
          label="Sleep"
          sub={sleepSub}
          muted={!whoopLive || (!data.sleep && !loadingWhoop)}
          loading={whoopLive && loadingWhoop && !data.sleepNeedsReconnect}
        />
      </div>

      {!loadingWhoop && (
        <p className="mt-4 text-[17px] leading-relaxed text-paper/90">{status}</p>
      )}
      {loadingWhoop && <div className="mt-4 h-[42px]" aria-hidden />}

      <div className="mt-5 border-t border-paper/10 pt-4">
        <div className="mb-2.5 text-[15px] font-semibold text-sage-soft">This week</div>
        <WeekStripLarge days={data.week} />
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-[16px]">
          <span className="flex items-center gap-2 text-paper/90">
            <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E3B04B]">
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#1a2e1f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5 5 9l4.5-6" /></svg>
            </span>
            {data.monthActive} active {data.monthActive === 1 ? "day" : "days"} in {data.monthLabel}
          </span>
          <NudgeChip />
        </div>
      </div>
      {whoop === "none" && (
        <div className="mt-5">
          <WhoopJoin connectHref={connectHref} demo={demo} />
        </div>
      )}
      {(whoop === "reconnect" || whoop === "connected_off") && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-paper/[0.07] p-3.5">
          <p className="text-[15px] leading-relaxed text-sage-soft">
            {whoop === "reconnect"
              ? "WHOOP needs reconnecting before Pod can read recovery and sleep again."
              : "Turn on Recovery & sleep to fill these rings. Red-recovery days then count as rest."}
          </p>
          {demo ? (
            <span className="shrink-0 rounded-full bg-paper px-3.5 py-2 text-[15px] font-semibold text-ink">
              {whoop === "reconnect" ? "Reconnect" : "Turn on"}
            </span>
          ) : (
            <Link
              href={connectHref}
              className="shrink-0 rounded-full bg-paper px-3.5 py-2 text-[15px] font-semibold text-ink active:scale-95"
            >
              {whoop === "reconnect" ? "Reconnect" : "Turn on"}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
