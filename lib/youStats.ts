import { weekStartUtc } from "./week";
import { dayKeyInTz } from "./days";
import { goalHit, type parseGoal } from "./goals";

type Goal = ReturnType<typeof parseGoal>;

export type YouSession = {
  podId: string;
  loggedAt: Date;
  activity: string | null;
  activities: string[] | null;
};

export type YouMembership = {
  podId: string;
  goal: Goal;
  joinedAt: Date | null;
};

export type WindowKey = "week" | "month" | "quarter" | "all";

export type WindowStats = {
  activeDays: number;
  sessions: number;
  consistencyPct: number | null; // null = no finished goal-weeks in window
  bestStreak: number;
  mostConsistentWeek: { label: string; count: number } | null;
  breakdown: { key: string; count: number; pct: number }[];
};

export type YouStatsResult = {
  currentStreak: number;
  windows: Record<WindowKey, WindowStats>;
};

// Pod-native personal analytics over selectable timeframes. Everything here is
// derived from logged sessions + each pod's weekly goal — no biometrics.
// Cross-pod: a week is "on track" if you hit your goal in at least one pod.
export function computeYouStats(opts: {
  sessions: YouSession[];
  memberships: YouMembership[];
  tz: string;
  weekStartsOn?: number;
  now?: Date;
}): YouStatsResult {
  const now = opts.now ?? new Date();
  const wso = opts.weekStartsOn ?? 1;
  const { tz, sessions, memberships } = opts;

  // A workout logged into several pods is stored once per pod. For a personal
  // recap, collapse those copies by (calendar day + activity set).
  const dedupe = (list: YouSession[]): YouSession[] => {
    const seen = new Set<string>();
    const out: YouSession[] = [];
    for (const s of list) {
      const day = dayKeyInTz(s.loggedAt, tz);
      const acts = (
        s.activities?.length ? s.activities : s.activity ? [s.activity] : []
      )
        .slice()
        .sort()
        .join(",");
      const key = `${day}|${acts}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  };
  const uniqueAll = dedupe(sessions);

  const fmtDay = (d: Date) =>
    d.toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric" });
  const weekLabel = (ws: Date) =>
    `${fmtDay(ws)} – ${fmtDay(new Date(ws.getTime() + 6 * 86400000))}`;

  const assessWeek = (ws: Date) => {
    const lo = ws.getTime();
    const hi = lo + 7 * 86400000;
    let goalPods = 0;
    let hitPods = 0;
    for (const m of memberships) {
      if (!m.goal.hasGoal) continue;
      if (m.joinedAt && m.joinedAt.getTime() > lo) continue; // not in yet
      goalPods++;
      const podMine = sessions
        .filter(
          (s) =>
            s.podId === m.podId &&
            s.loggedAt.getTime() >= lo &&
            s.loggedAt.getTime() < hi
        )
        .map((s) => ({
          activity: (s.activity ?? "other") as any,
          activities: s.activities ?? null,
        }));
      if (goalHit(m.goal, podMine)) hitPods++;
    }
    const count = uniqueAll.filter(
      (s) => s.loggedAt.getTime() >= lo && s.loggedAt.getTime() < hi
    ).length;
    return {
      ws,
      hasGoal: goalPods > 0,
      onTrack: hitPods >= 1,
      completed: hi <= now.getTime(),
      count,
    };
  };

  // Up to ~80 weeks back, newest first. [0] = current week.
  const weeks: ReturnType<typeof assessWeek>[] = [];
  for (let i = 0; i < 80; i++) {
    const ref = new Date(now.getTime() - i * 7 * 86400000);
    weeks.push(assessWeek(weekStartUtc(tz, wso, ref)));
  }

  // Current streak: consecutive on-track weeks from now back; in-progress week
  // never breaks it.
  let currentStreak = 0;
  for (const w of weeks) {
    if (!w.hasGoal) continue;
    if (w.onTrack) {
      currentStreak++;
      continue;
    }
    if (!w.completed) continue;
    break;
  }

  const defs: { key: WindowKey; days: number | null }[] = [
    { key: "week", days: 7 },
    { key: "month", days: 30 },
    { key: "quarter", days: 90 },
    { key: "all", days: null },
  ];

  const windows = {} as Record<WindowKey, WindowStats>;
  for (const d of defs) {
    const startMs = d.days === null ? 0 : now.getTime() - d.days * 86400000;
    const winSessions = uniqueAll.filter((s) => s.loggedAt.getTime() >= startMs);

    const activeDays = new Set(
      winSessions.map((s) => dayKeyInTz(s.loggedAt, tz))
    ).size;

    // For each activity, how many of this window's workouts included it (each
    // workout counts once per activity, even if logged into several pods). The
    // % is out of total workouts — so a session tagged with two activities
    // counts toward both, bars can each reach 100%, and they don't sum to 100.
    const counts: Record<string, number> = {};
    for (const s of winSessions) {
      const raw = s.activities?.length
        ? s.activities
        : s.activity
          ? [s.activity]
          : [];
      // Count each activity once per workout (no Set iteration — keeps the
      // build target-agnostic).
      const seen: Record<string, boolean> = {};
      for (const a of raw) {
        if (seen[a]) continue;
        seen[a] = true;
        counts[a] = (counts[a] ?? 0) + 1;
      }
    }
    const totalWorkouts = winSessions.length || 1;
    const breakdown = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        count,
        pct: Math.round((100 * count) / totalWorkouts),
      }));

    const inWin = weeks.filter((w) => w.ws.getTime() >= startMs);
    const finished = inWin.filter((w) => w.hasGoal && w.completed);
    const onTrackFinished = finished.filter((w) => w.onTrack).length;
    const consistencyPct =
      finished.length > 0
        ? Math.round((100 * onTrackFinished) / finished.length)
        : null;

    let bestStreak = 0;
    let run = 0;
    for (const w of inWin) {
      if (!w.hasGoal) continue;
      if (w.onTrack) {
        run++;
        if (run > bestStreak) bestStreak = run;
        continue;
      }
      if (!w.completed) continue;
      run = 0;
    }

    let mostConsistentWeek: { label: string; count: number } | null = null;
    for (const w of inWin) {
      if (w.count <= 0) continue;
      if (!mostConsistentWeek || w.count > mostConsistentWeek.count) {
        mostConsistentWeek = { label: weekLabel(w.ws), count: w.count };
      }
    }

    windows[d.key] = {
      activeDays,
      sessions: winSessions.length,
      consistencyPct,
      bestStreak,
      mostConsistentWeek,
      breakdown,
    };
  }

  return { currentStreak, windows };
}
