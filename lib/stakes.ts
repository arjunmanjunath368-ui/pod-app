import { weekStartUtc } from "@/lib/week";

export type StakeMember = { userId: string; target: number; status: string };
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
  periodEndInstant: Date;
  isOver: boolean;
};

// Zero-sum weekly pot. Each week every participant stakes `stakeAmount`. Those
// who hit their weekly session target split the pot; those who miss forfeit.
// Everyone-hit or nobody-hit weeks move nothing. Net accumulates across weeks.
// firmNet = completed weeks only; provNet = also includes the current week so far.
export function computeStakes(opts: {
  stakeAmount: number;
  periodStartDate: string;
  periodWeeks: number;
  tz: string;
  weekStartsOn: number;
  members: StakeMember[];
  sessions: StakeSession[];
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
    now = new Date(),
  } = opts;

  const startInstant = periodStartInstant(periodStartDate, tz, weekStartsOn);
  const participants = members.filter(
    (m) => m.status === "active" && m.target >= 1
  );
  const ids = participants.map((p) => p.userId);

  const firmNet: Record<string, number> = {};
  const provNet: Record<string, number> = {};
  ids.forEach((id) => {
    firmNet[id] = 0;
    provNet[id] = 0;
  });

  let weeksCompleted = 0;
  let currentWeekIndex: number | null = null;
  const nowMs = now.getTime();

  for (let i = 0; i < periodWeeks; i++) {
    const { start, end } = weekBounds(tz, weekStartsOn, startInstant, i);
    if (start.getTime() > nowMs) break; // hasn't started yet
    const isComplete = end.getTime() <= nowMs;
    if (isComplete) weeksCompleted = i + 1;
    else currentWeekIndex = i;

    const counts: Record<string, number> = {};
    ids.forEach((id) => (counts[id] = 0));
    for (const s of sessions) {
      if (counts[s.userId] === undefined) continue;
      const t = s.loggedAt.getTime();
      if (t >= start.getTime() && t < end.getTime()) counts[s.userId]++;
    }

    const hitters = participants
      .filter((p) => counts[p.userId] >= p.target)
      .map((p) => p.userId);
    const pot = participants.length * stakeAmount;

    const weekNet: Record<string, number> = {};
    ids.forEach((id) => (weekNet[id] = 0));
    if (hitters.length > 0 && hitters.length < participants.length) {
      const share = pot / hitters.length;
      participants.forEach((p) => {
        weekNet[p.userId] = hitters.includes(p.userId)
          ? share - stakeAmount
          : -stakeAmount;
      });
    }

    ids.forEach((id) => {
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

  const standings = participants.map((p) => ({
    userId: p.userId,
    firmNet: round2(firmNet[p.userId]),
    provNet: round2(provNet[p.userId]),
  }));

  return {
    standings,
    participantCount: participants.length,
    weeksCompleted,
    currentWeekIndex,
    periodEndInstant,
    isOver,
  };
}
