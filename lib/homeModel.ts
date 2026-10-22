import { dayKeyInTz } from "./days";
import { weekStartUtc } from "./week";
import type { DayState, WeekDay } from "@/components/home/types";

// Small, pure helpers that turn sessions into what Home shows. Shared by the
// live Home and the demo pod, and covered by tests.

const DAY = 86400000;

// The 7 local day keys ("2026-10-19") of the current week, in order.
export function weekKeys(tz: string, weekStartsOn: number, now: Date = new Date()): string[] {
  const start = weekStartUtc(tz, weekStartsOn, now).getTime();
  // Noon of each day, so a daylight-saving shift can't push a key into the
  // neighbouring day.
  return Array.from({ length: 7 }, (_, i) => dayKeyInTz(new Date(start + i * DAY + 12 * 3600000), tz));
}

export function weekLetters(weekStartsOn: number): string[] {
  const sunFirst = ["S", "M", "T", "W", "T", "F", "S"];
  return Array.from({ length: 7 }, (_, i) => sunFirst[(weekStartsOn + i) % 7]);
}

// One member's week as day states. `joinedKey` greys out days before they joined.
export function buildWeek(opts: {
  keys: string[];
  letters: string[];
  todayKey: string;
  activeKeys: Set<string>;
  restKeys: Set<string>;
  joinedKey?: string | null;
}): WeekDay[] {
  return opts.keys.map((k, i) => {
    let state: DayState;
    if (opts.activeKeys.has(k)) state = "active";
    else if (opts.restKeys.has(k)) state = "rest";
    else if (k > opts.todayKey) state = "future";
    else if (opts.joinedKey && k < opts.joinedKey) state = "off";
    else if (k === opts.todayKey) state = "today";
    else state = "missed";
    return { letter: opts.letters[i], state, isToday: k === opts.todayKey };
  });
}

// "Oct 19 – 25", or "Oct 26 – Nov 1" across a month boundary.
export function weekRangeShort(tz: string, weekStartsOn: number, now: Date = new Date()): string {
  const start = weekStartUtc(tz, weekStartsOn, now);
  const end = new Date(start.getTime() + 6 * DAY + 12 * 3600000);
  const md = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).format(d);
  const mon = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short" }).format(d);
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, day: "numeric" }).format(d);
  return mon(start) === mon(end) ? `${md(start)} – ${day(end)}` : `${md(start)} – ${md(end)}`;
}

export function dateLabel(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(now);
}

export function monthName(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "long" }).format(now);
}

export function pct(done: number, target: number): number {
  if (!target) return 0;
  return Math.round(Math.min(done / target, 1) * 100);
}

// The one line under the rings. Ordered by what matters most today.
export function todayStatus(t: {
  restToday: boolean;
  activeToday: boolean;
  hasGoal: boolean;
  done: number;
  target: number;
  daysLeft: number;
  zone: "red" | "yellow" | "green" | null;
}): string {
  const left = Math.max(t.target - t.done, 0);
  if (t.restToday)
    return "Red recovery, so today counts as a rest day. Your pod sees you resting, not missing.";
  if (t.hasGoal && left === 0)
    return "Goal hit for the week. Anything else is a bonus for the pod.";
  if (t.activeToday) {
    return left === 1
      ? "You showed up today. One more active day hits your goal."
      : `You showed up today. ${left} more active days hit your goal.`;
  }
  const zoneHint =
    t.zone === "green"
      ? "Green recovery: a good day to push. "
      : t.zone === "yellow"
        ? "Yellow recovery: move, but keep it moderate. "
        : t.zone === "red"
          ? "Red recovery: an easy walk still counts. "
          : "";
  if (!t.hasGoal) return `${zoneHint}Set your weekly goal to start counting.`;
  if (left > t.daysLeft)
    return `${zoneHint}${t.daysLeft} ${t.daysLeft === 1 ? "day" : "days"} left this week. Every one you show up still counts for the pod.`;
  if (left === t.daysLeft)
    return `${zoneHint}You need every day left this week, starting today.`;
  return `${zoneHint}${left === 1 ? "1 more active day hits" : `${left} more active days hit`} your goal. ${t.daysLeft} ${t.daysLeft === 1 ? "day" : "days"} left.`;
}
