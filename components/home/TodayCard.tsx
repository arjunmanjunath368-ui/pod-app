import Link from "next/link";
import Ring from "./Ring";
import { WeekStripLarge } from "./WeekStrip";
import type { TodayData } from "./types";
import { todayStatus } from "@/lib/homeModel";

// The member's own day, WHOOP-style: how far through their week they are,
// and (with WHOOP) today's recovery and last night's sleep. Recovery and sleep
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
            {muted || loading ? "–" : pct}
            {!muted && !loading && <span className="text-[13px] font-medium text-paper/70">%</span>}
          </span>
        </Ring>
      </div>
      <div className="mt-2 text-[13px] font-semibold text-paper">{label}</div>
      <div className="mt-0.5 max-w-full truncate text-[12px] text-sage-soft/90">{sub}</div>
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
        ? "Red · rest counts"
        : data.recovery.zone === "yellow"
          ? "Yellow"
          : "Green"
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
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold text-paper">Today</h2>
        <span className="text-[13px] text-sage-soft">{data.dateLabel}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <RingStat
          pct={my.pct}
          color={RING.week}
          label="My week"
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
        <p className="mt-4 text-[14px] leading-relaxed text-paper/90">{status}</p>
      )}
      {loadingWhoop && <div className="mt-4 h-[42px]" aria-hidden />}

      {whoop !== "on" && (
        <div className="mt-4 rounded-2xl bg-paper/[0.07] p-3.5">
          <p className="text-[13px] leading-relaxed text-sage-soft">
            {whoop === "none"
              ? "With WHOOP, your recovery and sleep fill these rings, activities log themselves, and a red-recovery day counts as rest."
              : whoop === "reconnect"
                ? "WHOOP needs reconnecting before Pod can read recovery and sleep again."
                : "Turn on Recovery & sleep to fill these rings. A red-recovery day then counts as rest, automatically."}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            {demo ? (
              <span className="rounded-full bg-paper px-3.5 py-1.5 text-[13px] font-semibold text-ink">
                Connect WHOOP
              </span>
            ) : (
              <Link
                href={connectHref}
                className="rounded-full bg-paper px-3.5 py-1.5 text-[13px] font-semibold text-ink active:scale-95"
              >
                {whoop === "none" ? "Connect WHOOP" : whoop === "reconnect" ? "Reconnect WHOOP" : "Turn on Recovery & sleep"}
              </Link>
            )}
            {whoop === "none" && (
              <a
                href="https://www.whoop.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-semibold text-sage-soft underline underline-offset-2"
              >
                New to WHOOP? whoop.com
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-paper/10 pt-4">
        <WeekStripLarge days={data.week} />
        <div className="mt-3.5 flex items-center justify-between text-[13px]">
          <span className="text-paper/90">
            🔥 {data.monthActive} active {data.monthActive === 1 ? "day" : "days"} in {data.monthLabel}
          </span>
          {data.nextNudge && !data.activeToday && !data.restToday && (
            <span className="text-sage-soft">Nudge at {data.nextNudge}</span>
          )}
        </div>
      </div>
    </section>
  );
}
