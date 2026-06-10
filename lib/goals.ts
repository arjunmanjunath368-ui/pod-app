import type { ActivityKey } from "@/lib/activities";

// One place that decides what a goal IS and whether it was hit, so streaks,
// stakes, and the home display can never disagree.

export type GoalMode = "combined" | "split";
export type GoalSplit = { activity: ActivityKey; target: number };

export type MemberGoal = {
  hasGoal: boolean;
  mode: GoalMode;
  // combined: the one weekly total. split: the SUM of per-activity targets.
  target: number;
  // combined: the activity types the goal is "about" (label/intent — any
  // session still counts). split: the activities that have targets.
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
          target: Number(s.target),
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

  const target = row.goal_target_per_week ?? 0;
  return {
    hasGoal: target > 0,
    mode: "combined",
    target,
    activities: listed,
    splits: [],
  };
}

type WeekSession = { activity?: string | null; activities?: string[] | null };

// A session counts toward an activity if that activity is among the ones it
// was logged with (multi-activity logs credit each). Falls back to the single
// `activity` for older rows that have no `activities` array.
function sessionCovers(s: WeekSession, activity: string): boolean {
  return s.activities && s.activities.length
    ? s.activities.includes(activity)
    : s.activity === activity;
}

function countOf(weekSessions: WeekSession[], activity: string): number {
  let c = 0;
  for (const s of weekSessions) if (sessionCovers(s, activity)) c++;
  return c;
}

// Did this member hit their goal, given THIS member's sessions for one week?
export function goalHit(goal: MemberGoal, weekSessions: WeekSession[]): boolean {
  if (!goal.hasGoal) return false;
  if (goal.mode === "split") {
    return goal.splits.every(
      (s) => countOf(weekSessions, s.activity) >= s.target
    );
  }
  // combined: any session counts (activity-agnostic, same as the original rule)
  return weekSessions.length >= goal.target;
}

// Progress for display. Combined => total vs target. Split => summed across
// activities, each activity capped at its own target so overshooting one
// doesn't paper over a missed one.
export function goalProgress(goal: MemberGoal, weekSessions: WeekSession[]) {
  if (goal.mode === "split") {
    const target = goal.target;
    const done = goal.splits.reduce(
      (a, s) => a + Math.min(countOf(weekSessions, s.activity), s.target),
      0
    );
    return { done, target, ratio: target ? Math.min(done / target, 1) : 0 };
  }
  const done = weekSessions.length;
  return {
    done,
    target: goal.target,
    ratio: goal.target ? Math.min(done / goal.target, 1) : 0,
  };
}

// Per-activity breakdown for split rows (for the home display).
export function splitBreakdown(goal: MemberGoal, weekSessions: WeekSession[]) {
  return goal.splits.map((s) => ({
    activity: s.activity,
    done: countOf(weekSessions, s.activity),
    target: s.target,
  }));
}
