import { weekStartUtc } from "./week";
import { goalHit, type parseGoal } from "./goals";

type Goal = ReturnType<typeof parseGoal>;

const DAY = 86400000;

// Definitions (kept in one place so the admin page and the tests agree):
//  - Week 1 = the first FULL week after a pod's first member joined. The join
//    week itself is partial, so it's never scored.
//  - A member is "eligible" for a week if they have a goal and joined on or
//    before that week's start. Members who left stay eligible (leaving is
//    churn, not an excuse). Goal = their CURRENT goal; history of goal edits
//    isn't stored.
//  - A pod is "alive" in a week if at least half of eligible members hit
//    their own goal. Survival at week N = alive pods / pods with N completed
//    weeks.
//  - Lapse = a gap of 5+ days between a member's consecutive logs (or since
//    their last log). Comeback = they logged again within 14 days of the
//    lapse starting (gap <= 19 days).
//  - Activation = member has a goal and logged within 7 days of joining.
//  - Hero = share of a pod's last-28-day logs from its top member.

export type PHMember = {
  userId: string;
  name: string;
  status: string; // active | paused | left
  joinedAt: Date | null;
  goal: Goal;
};

export type PHSession = {
  userId: string;
  loggedAt: Date;
  activity: string | null;
  activities: string[] | null;
};

export type PHPodInput = {
  podId: string;
  name: string;
  tz: string;
  weekStartsOn: number;
  members: PHMember[];
  sessions: PHSession[];
  staked: boolean;
};

export type WeekCell = {
  index: number; // 1-based
  eligible: number;
  hit: number;
  alive: boolean | null; // null = nobody eligible
};

export type PodHealth = {
  podId: string;
  name: string;
  staked: boolean;
  counts: { total: number; active: number; paused: number; left: number };
  startDate: Date | null;
  tz: string;
  weeks: WeekCell[]; // completed weeks only
  currentWeek: { index: number; eligible: number; hit: number } | null;
  lastLogDaysAgo: number | null;
  lapses: {
    total: number;
    backWithin14: number;
    backLate: number;
    stillOut: number;
    pending: number;
  };
  hero: {
    name: string;
    share: number;
    top: number;
    total: number;
    fragile: boolean;
  } | null;
  activation: {
    activated: number;
    failed: number;
    pending: number;
    podActivated: boolean | null; // null = still pending
  };
};

export function computePodHealth(
  pod: PHPodInput,
  now: Date = new Date()
): PodHealth {
  const nowMs = now.getTime();
  const { tz, weekStartsOn: wso, members } = pod;

  const counts = { total: members.length, active: 0, paused: 0, left: 0 };
  for (const m of members) {
    if (m.status === "paused") counts.paused++;
    else if (m.status === "left") counts.left++;
    else counts.active++;
  }

  // Sessions grouped per member, as sorted timestamps.
  const timesByUser: Record<string, number[]> = {};
  const sessByUser: Record<string, PHSession[]> = {};
  for (const s of pod.sessions) {
    (timesByUser[s.userId] ??= []).push(s.loggedAt.getTime());
    (sessByUser[s.userId] ??= []).push(s);
  }
  for (const k of Object.keys(timesByUser)) timesByUser[k].sort((a, b) => a - b);

  // ---- Weekly goal-hit grid ----
  let firstJoinMs: number | null = null;
  for (const m of members) {
    if (!m.joinedAt) continue;
    const t = m.joinedAt.getTime();
    if (firstJoinMs === null || t < firstJoinMs) firstJoinMs = t;
  }

  const weeks: WeekCell[] = [];
  let currentWeek: PodHealth["currentWeek"] = null;
  let startDate: Date | null = null;

  if (firstJoinMs !== null) {
    const base = weekStartUtc(tz, wso, new Date(firstJoinMs));
    startDate = new Date(firstJoinMs);
    // Start instant of week i (i = 1 is the first full week after joining).
    const weekStartAt = (i: number): Date =>
      weekStartUtc(tz, wso, new Date(base.getTime() + (i * 7 + 3) * DAY));

    const scoreWeek = (i: number) => {
      const lo = weekStartAt(i).getTime();
      const hi = weekStartAt(i + 1).getTime();
      let eligible = 0;
      let hit = 0;
      for (const m of members) {
        if (!m.goal.hasGoal) continue;
        if (m.joinedAt && m.joinedAt.getTime() > lo) continue;
        eligible++;
        const mine = (sessByUser[m.userId] ?? [])
          .filter((s) => {
            const t = s.loggedAt.getTime();
            return t >= lo && t < hi;
          })
          .map((s) => ({
            activity: (s.activity ?? "other") as any,
            activities: s.activities ?? null,
          }));
        if (goalHit(m.goal, mine)) hit++;
      }
      return { eligible, hit, hi, lo };
    };

    for (let i = 1; i <= 52; i++) {
      const w = scoreWeek(i);
      if (w.lo > nowMs) break; // future
      if (w.hi <= nowMs) {
        weeks.push({
          index: i,
          eligible: w.eligible,
          hit: w.hit,
          alive: w.eligible > 0 ? w.hit / w.eligible >= 0.5 : null,
        });
      } else {
        currentWeek = { index: i, eligible: w.eligible, hit: w.hit };
        break;
      }
    }
  }

  // ---- Lapses / comebacks (only members who have logged at least once;
  // never-started members are an activation question, not a comeback one) ----
  const lapses = { total: 0, backWithin14: 0, backLate: 0, stillOut: 0, pending: 0 };
  for (const m of members) {
    const times = timesByUser[m.userId] ?? [];
    if (times.length === 0) continue;
    for (let k = 1; k < times.length; k++) {
      const gap = times[k] - times[k - 1];
      if (gap >= 5 * DAY) {
        lapses.total++;
        if (gap <= 19 * DAY) lapses.backWithin14++;
        else lapses.backLate++;
      }
    }
    // Currently quiet — but a paused member is away on purpose, so skip.
    if (m.status !== "paused") {
      const sinceLast = nowMs - times[times.length - 1];
      if (sinceLast >= 5 * DAY) {
        lapses.total++;
        if (sinceLast - 5 * DAY > 14 * DAY) lapses.stillOut++;
        else lapses.pending++;
      }
    }
  }

  // ---- Hero dependency (last 28 days) ----
  const since = nowMs - 28 * DAY;
  const recentByUser: Record<string, number> = {};
  let recentTotal = 0;
  for (const s of pod.sessions) {
    if (s.loggedAt.getTime() >= since) {
      recentByUser[s.userId] = (recentByUser[s.userId] ?? 0) + 1;
      recentTotal++;
    }
  }
  let hero: PodHealth["hero"] = null;
  const nonLeft = counts.total - counts.left;
  if (recentTotal >= 6 && nonLeft >= 2) {
    let topId = "";
    let top = 0;
    for (const uid of Object.keys(recentByUser)) {
      if (recentByUser[uid] > top) {
        top = recentByUser[uid];
        topId = uid;
      }
    }
    const share = top / recentTotal;
    // In a pair, one person doing most logs is common; only flag it when lopsided.
    const threshold = nonLeft <= 2 ? 0.7 : 0.5;
    hero = {
      name: members.find((m) => m.userId === topId)?.name ?? "Member",
      share,
      top,
      total: recentTotal,
      fragile: share > threshold,
    };
  }

  // ---- Activation: goal set + first log within 7 days of joining ----
  const activation = { activated: 0, failed: 0, pending: 0, podActivated: null as boolean | null };
  for (const m of members) {
    if (!m.joinedAt) continue;
    const joinMs = m.joinedAt.getTime();
    const times = timesByUser[m.userId] ?? [];
    const firstLog = times.find((t) => t >= joinMs - DAY) ?? null; // tolerate clock skew
    const within = firstLog !== null && firstLog - joinMs <= 7 * DAY;
    if (m.goal.hasGoal && within) activation.activated++;
    else if (nowMs - joinMs < 7 * DAY && !(m.goal.hasGoal && within)) activation.pending++;
    else activation.failed++;
  }
  const judged = activation.activated + activation.failed + activation.pending;
  if (judged > 0) {
    if (activation.failed > 0) activation.podActivated = false;
    else if (activation.pending > 0) activation.podActivated = null;
    else activation.podActivated = true;
  }

  let lastLogMs: number | null = null;
  for (const s of pod.sessions) {
    const t = s.loggedAt.getTime();
    if (lastLogMs === null || t > lastLogMs) lastLogMs = t;
  }

  return {
    podId: pod.podId,
    name: pod.name,
    staked: pod.staked,
    counts,
    startDate,
    tz,
    weeks,
    currentWeek,
    lastLogDaysAgo:
      lastLogMs === null ? null : Math.floor((nowMs - lastLogMs) / DAY),
    lapses,
    hero,
    activation,
  };
}

export type SurvivalPoint = { week: number; alive: number; of: number };

export type PodHealthSummary = {
  pods: number;
  members: number;
  survival: SurvivalPoint[]; // week 1..12, only weeks with >=1 pod
  activation: { activated: number; failed: number; pending: number };
  comeback: {
    rate: number | null; // backWithin14 / resolved
    resolved: number;
    backWithin14: number;
    pending: number;
  };
  hero: { fragile: number; measured: number };
};

export function summarize(list: PodHealth[]): PodHealthSummary {
  const survival: SurvivalPoint[] = [];
  for (let w = 1; w <= 12; w++) {
    let alive = 0;
    let of = 0;
    for (const p of list) {
      const cell = p.weeks.find((c) => c.index === w);
      if (!cell || cell.alive === null) continue;
      of++;
      if (cell.alive) alive++;
    }
    if (of > 0) survival.push({ week: w, alive, of });
  }

  const act = { activated: 0, failed: 0, pending: 0 };
  let back = 0;
  let resolved = 0;
  let pendingLapses = 0;
  let fragile = 0;
  let measured = 0;
  let members = 0;
  for (const p of list) {
    members += p.counts.total - p.counts.left;
    if (p.activation.podActivated === true) act.activated++;
    else if (p.activation.podActivated === false) act.failed++;
    else if (p.activation.podActivated === null && p.counts.total > 0) act.pending++;
    back += p.lapses.backWithin14;
    resolved += p.lapses.backWithin14 + p.lapses.backLate + p.lapses.stillOut;
    pendingLapses += p.lapses.pending;
    if (p.hero) {
      measured++;
      if (p.hero.fragile) fragile++;
    }
  }

  return {
    pods: list.length,
    members,
    survival,
    activation: act,
    comeback: {
      rate: resolved > 0 ? back / resolved : null,
      resolved,
      backWithin14: back,
      pending: pendingLapses,
    },
    hero: { fragile, measured },
  };
}
