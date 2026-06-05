import { weekStartUtc } from "@/lib/week";
import { dayKeyInTz } from "@/lib/days";

export type StakeMember = {
  userId: string;
  target: number;
  status: string;
  // Week-start (YYYY-MM-DD) this member is staked from since their last resume.
  // null/undefined = staked from the period start.
  stakedFrom?: string | null;
};
export type StakeSession = { userId: string; loggedAt: Date };

export type Standing = { userId: string; firmNet: number; provNet: number };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// UTC instant of local midnight for a stored YYYY-MM-DD period_start, snapped to
// the pod's week start (period_start is always a week-start date).
export function periodStartInstant(
  dateStr: string,
  tz: string,
  weekStartsOn: number
): Date {
  const ref = new Date(`${dateStr}T12:00:00Z`); // midday avoids tz edge slips
  return weekStartUtc(tz, weekStartsOn, ref);
}

// Start/end instants of week `i` (0-based) within the period.
function weekBounds(
  tz: string,
  weekStartsOn: number,
  startInstant: Date,
  i: number
): { start: Date; end: Date } {
  const mid = new Date(startInstant.getTime() + (i * 7 + 3) * 86400000);
  const start = weekStartUtc(tz, weekStartsOn, mid);
  const end = new Date(start.getTime() + 7 * 86400000);
  return { start, end };
}

export type StakeResult = {
  standings: Standing[];
  participantCount: number;
  weeksCompleted: number; // fully-finished weeks in the period so far
  currentWeekIndex: number | null; // 0-based in-progress week, or null if over
  currentWeekStartKey: string | null; // YYYY-MM-DD of the in-progress week's start
  periodEndInstant: Date;
  isOver: boolean;
};

// Zero-sum weekly pot, evaluated per week against THAT WEEK'S roster. A week's
// roster is the FROZEN set (weekRosters[key], captured while the week was live)
// if one exists, otherwise the live-eligible set (active + has a goal +
// staked_from on or before that week). Frozen rosters for closed weeks are what
// stop a mid-period resume from retroactively rewriting them. With no frozen
// rosters and no staked_from values, every week resolves to the same active+goal
// set — identical to the original single-roster behavior.
export function computeStakes(opts: {
  stakeAmount: number;
  periodStartDate: string;
  periodWeeks: number;
  tz: string;
  weekStartsOn: number;
  members: StakeMember[];
  sessions: StakeSession[];
  weekRosters?: Record<string, string[]>;
  now?: Date;
}): StakeResult {
  const {
    stakeAmount,
    periodStartDate,
    periodWeeks,
    tz,
    weekStartsOn,
    members,
    sessions,
    weekRosters,
    now = new Date(),
  } = opts;

  const startInstant = periodStartInstant(periodStartDate, tz, weekStartsOn);
  const nowMs = now.getTime();

  const targetOf: Record<string, number> = {};
  const memberIds = new Set<string>();
  members.forEach((m) => {
    targetOf[m.userId] = m.target;
    memberIds.add(m.userId);
  });

  const liveEligible = (weekKey: string): string[] =>
    members
      .filter(
        (m) =>
          m.status === "active" &&
          m.target >= 1 &&
          (!m.stakedFrom || m.stakedFrom <= weekKey)
      )
      .map((m) => m.userId);

  // Pass 1: resolve each week's roster + the union of everyone staked at any point.
  const rosters: (string[] | null)[] = [];
  const allIds = new Set<string>();
  let weeksCompleted = 0;
  let currentWeekIndex: number | null = null;
  let currentWeekStartKey: string | null = null;

  for (let i = 0; i < periodWeeks; i++) {
    const { start, end } = weekBounds(tz, weekStartsOn, startInstant, i);
    if (start.getTime() > nowMs) {
      rosters.push(null); // hasn't started yet
      continue;
    }
    const isComplete = end.getTime() <= nowMs;
    const key = dayKeyInTz(start, tz);
    if (isComplete) {
      weeksCompleted = i + 1;
    } else {
      currentWeekIndex = i;
      currentWeekStartKey = key;
    }
    const frozen = weekRosters?.[key];
    const roster = frozen
      ? frozen.filter((id) => memberIds.has(id))
      : liveEligible(key);
    rosters.push(roster);
    roster.forEach((id) => allIds.add(id));
  }

  const ids = Array.from(allIds);
  const firmNet: Record<string, number> = {};
  const provNet: Record<string, number> = {};
  ids.forEach((id) => {
    firmNet[id] = 0;
    provNet[id] = 0;
  });

  // Pass 2: settle each week's pot among its roster.
  for (let i = 0; i < periodWeeks; i++) {
    const roster = rosters[i];
    if (!roster || roster.length === 0) continue;
    const { start, end } = weekBounds(tz, weekStartsOn, startInstant, i);
    const isComplete = end.getTime() <= nowMs;

    const counts: Record<string, number> = {};
    roster.forEach((id) => (counts[id] = 0));
    for (const s of sessions) {
      if (counts[s.userId] === undefined) continue;
      const t = s.loggedAt.getTime();
      if (t >= start.getTime() && t < end.getTime()) counts[s.userId]++;
    }

    const hitters = roster.filter(
      (id) => counts[id] >= (targetOf[id] ?? Infinity)
    );
    const pot = roster.length * stakeAmount;
    const weekNet: Record<string, number> = {};
    roster.forEach((id) => (weekNet[id] = 0));
    if (hitters.length > 0 && hitters.length < roster.length) {
      const share = pot / hitters.length;
      roster.forEach((id) => {
        weekNet[id] = hitters.includes(id) ? share - stakeAmount : -stakeAmount;
      });
    }
    roster.forEach((id) => {
      provNet[id] += weekNet[id];
      if (isComplete) firmNet[id] += weekNet[id];
    });
  }

  const periodEndInstant = weekBounds(
    tz,
    weekStartsOn,
    startInstant,
    periodWeeks - 1
  ).end;
  const isOver = nowMs >= periodEndInstant.getTime();

  const standings = ids.map((id) => ({
    userId: id,
    firmNet: round2(firmNet[id]),
    provNet: round2(provNet[id]),
  }));

  return {
    standings,
    participantCount: ids.length,
    weeksCompleted,
    currentWeekIndex,
    currentWeekStartKey,
    periodEndInstant,
    isOver,
  };
}
