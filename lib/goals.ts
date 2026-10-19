import type { ActivityKey } from "@/lib/activities";
import { dayKeyInTz } from "@/lib/days";

// One place that decides what a goal IS and whether it was hit, so streaks,
// stakes, and the home display can never disagree.
//
// Pod measures showing up, not volume. Every goal is counted in ACTIVE DAYS:
//  - combined ("active days"): any activity makes a day active, and a day
//    counts once however much you did on it.
//  - split ("3 days of swimming, 2 of strength"): each day still counts once.
//    A day with both swimming and strength goes to whichever target still
//    needs it, so a 3 + 2 goal always takes 5 different days.
//  - rest days: on a red-recovery day (checked with WHOOP when it's logged),
//    a rest day counts as an active day, up to REST_DAYS_PER_WEEK a week. In a
//    split goal it can fill any one target's day.

export const REST_DAYS_PER_WEEK = 2;

export type GoalMode = "combined" | "split";
export type GoalSplit = { activity: ActivityKey; target: number };

export type MemberGoal = {
  hasGoal: boolean;
  mode: GoalMode;
  // combined: active days per week. split: the SUM of per-activity day targets.
  target: number;
  // combined: the activity types the goal is "about" (label/intent — any
  // activity still counts). split: the activities that have targets.
  activities: ActivityKey[];
  // split mode only.
  splits: GoalSplit[];
};

type RawGoalRow = {
  goal_activity?: string | null;
  goal_label?: string | null;
  goal_target_per_week?: number | null;
  goal_mode?: string | null;
  goal_activities?: string[] | null;
  goal_splits?: unknown;
};

// Build the canonical goal from a raw pod_members row (any extra columns ignored).
export function parseGoal(row: RawGoalRow): MemberGoal {
  const mode: GoalMode = row.goal_mode === "split" ? "split" : "combined";

  const splits: GoalSplit[] = Array.isArray(row.goal_splits)
    ? (row.goal_splits as unknown[])
        .map((s) => s as { activity?: string; target?: number })
        .filter((s) => !!s && !!s.activity && Number(s.target) > 0)
        .map((s) => ({
          activity: s.activity as ActivityKey,
          // A week only has 7 days.
          target: Math.min(Number(s.target), 7),
        }))
    : [];

  const listed =
    Array.isArray(row.goal_activities) && row.goal_activities.length
      ? (row.goal_activities as ActivityKey[])
      : row.goal_activity
        ? [row.goal_activity as ActivityKey]
        : [];

  if (mode === "split" && splits.length > 0) {
    const target = splits.reduce((a, s) => a + s.target, 0);
    return {
      hasGoal: target > 0,
      mode: "split",
      target,
      activities: splits.map((s) => s.activity),
      splits,
    };
  }

  const target = Math.min(row.goal_target_per_week ?? 0, 7);
  return {
    hasGoal: target > 0,
    mode: "combined",
    target,
    activities: listed,
    splits: [],
  };
}

// Setting a weekly goal is required to be in a pod. Given a member's own
// (non-left) pod_members rows, which pod still needs one? Returns that pod's
// id, or null when every pod has a goal. Home sends people there before
// showing anything else.
//
// Two cases deliberately never gate: a first-time member (the welcome
// walk-through sets their goal in two taps, and gating first would skip it)
// and someone replaying the tour from Settings.
export function podNeedingGoal(
  rows: ({ pod_id: string } & RawGoalRow)[] | null | undefined
): string | null {
  for (const r of rows ?? []) {
    if (!parseGoal(r).hasGoal) return r.pod_id;
  }
  return null;
}

export function goalGateTarget(
  rows: ({ pod_id: string } & RawGoalRow)[] | null | undefined,
  opts: { onboarded: boolean; replayingTour: boolean }
): string | null {
  if (!opts.onboarded || opts.replayingTour) return null;
  return podNeedingGoal(rows);
}

// ---------- Counting active days ----------

// One logged session as the goal logic sees it. `logged_at` places it on a day
// in the pod's timezone; without it the session is treated as its own day
// (only older call sites that don't select it).
export type WeekSession = {
  activity?: string | null;
  activities?: string[] | null;
  logged_at?: string | Date | null;
  rest_day?: boolean | null;
};

type Day = { acts: Set<string>; restOnly: boolean };

function sessionActivities(s: WeekSession): string[] {
  const list =
    s.activities && s.activities.length
      ? s.activities
      : s.activity
        ? [s.activity]
        : [];
  const clean = list.filter(Boolean) as string[];
  return clean.length ? clean : ["other"];
}

// Group a member's sessions for one week into days.
export function activeDays(sessions: WeekSession[], tz: string): Day[] {
  const byKey = new Map<string, { acts: Set<string>; rest: boolean }>();
  sessions.forEach((s, i) => {
    let key: string;
    if (s.logged_at) {
      const d = s.logged_at instanceof Date ? s.logged_at : new Date(s.logged_at);
      key = isNaN(d.getTime()) ? `#${i}` : dayKeyInTz(d, tz);
    } else {
      key = `#${i}`;
    }
    const day = byKey.get(key) ?? { acts: new Set<string>(), rest: false };
    if (s.rest_day) day.rest = true;
    else sessionActivities(s).forEach((a) => day.acts.add(a));
    byKey.set(key, day);
  });
  const days: Day[] = [];
  byKey.forEach((d) => {
    // A day with a real activity is a real day; a rest log on top changes nothing.
    days.push({ acts: d.acts, restOnly: d.acts.size === 0 && d.rest });
  });
  return days;
}

export type GoalCredit = {
  done: number; // active days credited toward the goal (capped at target)
  target: number;
  hit: boolean;
  // split: days credited to each activity (capped at its target).
  perActivity: Record<string, number>;
  restUsed: number; // rest days that counted
};

// The single rule every screen uses.
export function goalCredit(
  goal: Pick<MemberGoal, "hasGoal" | "mode" | "target" | "splits">,
  sessions: WeekSession[],
  tz: string
): GoalCredit {
  const empty: GoalCredit = {
    done: 0,
    target: goal.target,
    hit: false,
    perActivity: {},
    restUsed: 0,
  };
  if (!goal.hasGoal || goal.target <= 0) return empty;

  const days = activeDays(sessions, tz);
  const realDays = days.filter((d) => !d.restOnly);
  const restAvailable = Math.min(
    days.filter((d) => d.restOnly).length,
    REST_DAYS_PER_WEEK
  );

  if (goal.mode !== "split" || goal.splits.length === 0) {
    const raw = realDays.length;
    const restUsed = Math.max(0, Math.min(restAvailable, goal.target - raw));
    const done = Math.min(raw + restUsed, goal.target);
    return { done, target: goal.target, hit: done >= goal.target, perActivity: {}, restUsed };
  }

  // Split: match real days to activity "slots" (target copies per activity) so
  // each day fills at most one slot. Max bipartite matching (Kuhn); a week has
  // at most 7 days, so this is tiny.
  const slots: string[] = [];
  goal.splits.forEach((s) => {
    for (let k = 0; k < s.target; k++) slots.push(s.activity);
  });
  const slotOwner: number[] = new Array(slots.length).fill(-1); // slot -> day index

  const tryAssign = (dayIdx: number, seen: boolean[]): boolean => {
    for (let j = 0; j < slots.length; j++) {
      if (seen[j] || !realDays[dayIdx].acts.has(slots[j])) continue;
      seen[j] = true;
      if (slotOwner[j] === -1 || tryAssign(slotOwner[j], seen)) {
        slotOwner[j] = dayIdx;
        return true;
      }
    }
    return false;
  };
  for (let d = 0; d < realDays.length; d++) {
    tryAssign(d, new Array(slots.length).fill(false));
  }

  const perActivity: Record<string, number> = {};
  goal.splits.forEach((s) => (perActivity[s.activity] = 0));
  slotOwner.forEach((owner, j) => {
    if (owner !== -1) perActivity[slots[j]]++;
  });
  const matched = slotOwner.filter((o) => o !== -1).length;

  // Rest days fill any remaining slot (whichever target is furthest behind).
  let restUsed = 0;
  let remaining = goal.target - matched;
  while (restUsed < restAvailable && remaining > 0) {
    let best: GoalSplit | null = null;
    for (const s of goal.splits) {
      const gap = s.target - perActivity[s.activity];
      if (gap > 0 && (!best || gap > best.target - perActivity[best.activity])) best = s;
    }
    if (!best) break;
    perActivity[best.activity]++;
    restUsed++;
    remaining--;
  }

  const done = matched + restUsed;
  return { done, target: goal.target, hit: done >= goal.target, perActivity, restUsed };
}

// Did this member hit their goal, given THIS member's sessions for one week?
export function goalHit(
  goal: MemberGoal,
  weekSessions: WeekSession[],
  tz: string
): boolean {
  return goalCredit(goal, weekSessions, tz).hit;
}

// Progress for display: active days credited vs the target.
export function goalProgress(
  goal: MemberGoal,
  weekSessions: WeekSession[],
  tz: string
) {
  const c = goalCredit(goal, weekSessions, tz);
  return {
    done: c.done,
    target: c.target,
    ratio: c.target ? Math.min(c.done / c.target, 1) : 0,
  };
}

// Per-activity breakdown for split rows (for the home display).
export function splitBreakdown(
  goal: MemberGoal,
  weekSessions: WeekSession[],
  tz: string
) {
  const c = goalCredit(goal, weekSessions, tz);
  return goal.splits.map((s) => ({
    activity: s.activity,
    done: c.perActivity[s.activity] ?? 0,
    target: s.target,
  }));
}

// One-line description of a combined goal, e.g. "4 active days a week" or
// "🏊 Swimming · 3 days a week". The default label adds nothing, so it's dropped.
export function goalLine(opts: {
  emoji: string;
  label: string | null | undefined;
  activity: string | null | undefined;
  target: number;
  detail?: string | null;
}): string {
  const days = `${opts.target} ${opts.target === 1 ? "day" : "days"} a week`;
  const label = (opts.label ?? "").trim();
  const generic = !label || label.toLowerCase() === "active days";
  const base =
    generic && (!opts.activity || opts.activity === "other")
      ? `${opts.target} active ${opts.target === 1 ? "day" : "days"} a week`
      : generic
        ? `${opts.emoji} ${days}`
        : `${opts.emoji} ${label} · ${days}`;
  return opts.detail ? `${base} · ${opts.detail}` : base;
}
