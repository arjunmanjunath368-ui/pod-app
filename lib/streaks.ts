import { weekStartUtc } from "./week";
import { goalCredit, type WeekSession } from "./goals";

// A week is "complete" for a member when they hit their goal that week, counted
// in active days by the same rule as everywhere else (lib/goals.ts).
// Individual streak = consecutive completed weeks.
// Pod streak = consecutive "Pod Perfect weeks" (every eligible member completed theirs).
// Optimistic rule: the in-progress (current) week never BREAKS a streak; completing
// it EXTENDS the streak immediately. Paused members and members who hadn't joined yet
// are excluded from a given week's perfect-week check.
//
// v1 simplifications (fine for the live test):
// - Uses each member's CURRENT target for all weeks (no goal-change history).
// - Uses CURRENT paused status (no historical pause record).

export type StreakMember = {
  userId: string;
  target: number; // 0 if no goal (combined total, or sum of split targets)
  hasGoal: boolean;
  status: string; // 'active' | 'paused' | 'left'
  joinedAt: Date;
  mode?: "combined" | "split";
  splits?: { activity: string; target: number }[];
};

export type StreakSession = {
  userId: string;
  loggedAt: Date;
  activity?: string | null;
  activities?: string[] | null;
  restDay?: boolean | null;
};

export function computeStreaks(opts: {
  members: StreakMember[];
  sessions: StreakSession[];
  tz: string;
  weekStartsOn: number;
  podCreatedAt: Date;
  now?: Date;
  maxWeeks?: number;
}): {
  podStreak: number;
  perfectThisWeek: boolean;
  memberStreak: Record<string, number>;
} {
  const now = opts.now ?? new Date();
  const maxWeeks = opts.maxWeeks ?? 26;
  const { tz, weekStartsOn, sessions, podCreatedAt } = opts;

  // Week starts, index 0 = current week, walking backward. Stop once a week
  // starts at/before the pod was created (no data exists before that).
  const weekStarts: Date[] = [];
  for (let i = 0; i < maxWeeks; i++) {
    const ref = new Date(now.getTime() - i * 7 * 86400000);
    const ws = weekStartUtc(tz, weekStartsOn, ref);
    weekStarts.push(ws);
    if (ws.getTime() <= podCreatedAt.getTime()) break;
  }
  const N = weekStarts.length;

  const weekUpper = (i: number): number =>
    i === 0 ? now.getTime() + 1 : weekStarts[i - 1].getTime();

  const weekSessions = (userId: string, i: number): WeekSession[] => {
    const lo = weekStarts[i].getTime();
    const hi = weekUpper(i);
    const out: WeekSession[] = [];
    for (const s of sessions) {
      if (s.userId !== userId) continue;
      const t = s.loggedAt.getTime();
      if (t >= lo && t < hi)
        out.push({
          activity: s.activity ?? null,
          activities: s.activities ?? null,
          logged_at: s.loggedAt,
          rest_day: s.restDay ?? false,
        });
    }
    return out;
  };

  // Did this member hit their goal in week i? Active days, split targets each
  // filled by a different day (see lib/goals.ts).
  const hitWeek = (m: StreakMember, i: number): boolean =>
    goalCredit(
      {
        hasGoal: m.hasGoal,
        mode: m.mode === "split" && m.splits && m.splits.length ? "split" : "combined",
        target: m.target,
        splits: (m.splits ?? []) as any,
      },
      weekSessions(m.userId, i),
      tz
    ).hit;

  const eligible = opts.members.filter(
    (m) => m.hasGoal && m.status === "active"
  );

  // A week "belongs" to a member only if they were in the pod at its start
  // (its Monday). Joining mid-week means that partial week doesn't count for or
  // against them — their weekly goal effectively begins the following Monday.
  const belongs = (m: StreakMember, i: number): boolean =>
    m.joinedAt.getTime() <= weekStarts[i].getTime();

  // Individual streaks
  const memberStreak: Record<string, number> = {};
  for (const m of eligible) {
    const isComplete = (i: number) => belongs(m, i) && hitWeek(m, i);

    let streak = 0;
    const start = isComplete(0) ? 0 : 1; // in-progress week doesn't break
    for (let i = start; i < N; i++) {
      if (!belongs(m, i)) break; // before their first full week
      if (isComplete(i)) streak++;
      else break;
    }
    memberStreak[m.userId] = streak;
  }

  // Pod perfect-week: every member whose week this is completed it
  const perfectWeek = (i: number): boolean => {
    const elig = eligible.filter((m) => belongs(m, i));
    if (elig.length === 0) return false;
    return elig.every((m) => hitWeek(m, i));
  };

  const perfectThisWeek = perfectWeek(0);
  let podStreak = 0;
  const startP = perfectThisWeek ? 0 : 1;
  for (let i = startP; i < N; i++) {
    if (perfectWeek(i)) podStreak++;
    else break;
  }

  return { podStreak, perfectThisWeek, memberStreak };
}
