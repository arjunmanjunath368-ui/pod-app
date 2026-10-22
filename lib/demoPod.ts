import { weekStartUtc } from "./week";
import { weekKeys, weekLetters, buildWeek, weekRangeShort, dateLabel, monthName, pct } from "./homeModel";
import type { MemberRow, PodData, TodayData, YourTurnData } from "@/components/home/types";

// The demo pod: a believable mid-week, built fresh for the viewer's week so
// the dates are always current. Every number here is simulated. Nothing is
// read from or written to the database.

const WSO = 1; // weeks start Monday

// Demo "now": Thursday of this week, early evening, so the week has a story
// whichever day the demo is opened.
export function demoNow(tz: string, now: Date = new Date()): Date {
  const start = weekStartUtc(tz, WSO, now).getTime();
  return new Date(start + 3 * 86400000 + (17 * 60 + 40) * 60000);
}

type Fixture = {
  id: string;
  name: string;
  initials: string;
  color: string;
  target: number;
  active: number[]; // day indexes, 0 = Monday
  rest?: number[];
  joinedIdx?: number; // joined mid-week on this day
  month: number;
  me?: boolean;
  whoop?: boolean;
  goalText?: string;
};

export function buildDemo(tz: string, firstName: string, now: Date = new Date()) {
  const at = demoNow(tz, now);
  const keys = weekKeys(tz, WSO, at);
  const letters = weekLetters(WSO);
  const todayIdx = 3;
  const todayKey = keys[todayIdx];

  const people: Fixture[] = [
    { id: "me", name: firstName || "You", initials: (firstName || "Y").slice(0, 2).toUpperCase(), color: "#c8553d", target: 4, active: [0, 1], rest: [2], month: 14, me: true, whoop: true },
    { id: "maya", name: "Maya", initials: "MR", color: "#7a9471", target: 4, active: [0, 1, 2, 3], month: 17, whoop: true },
    { id: "jordan", name: "Jordan", initials: "JK", color: "#d9a441", target: 3, active: [1, 3], month: 11, whoop: true, goalText: "🎾 2  🏋️ 1 · 3 days a week" },
    { id: "priya", name: "Priya", initials: "PS", color: "#5b7fa6", target: 5, active: [0, 2], rest: [3], month: 15, whoop: true },
    { id: "sam", name: "Sam", initials: "SO", color: "#8a6f9e", target: 3, active: [1], month: 6 },
    { id: "leo", name: "Leo", initials: "LB", color: "#b07a4f", target: 3, active: [2], joinedIdx: 2, month: 1 },
  ];

  const members: MemberRow[] = people.map((p) => {
    const done = Math.min(p.active.length + Math.min((p.rest ?? []).length, 2), p.target);
    const startsMonday = p.joinedIdx !== undefined;
    const restToday = (p.rest ?? []).includes(todayIdx);
    const activeToday = p.active.includes(todayIdx);
    return {
      userId: p.id,
      name: p.name,
      initials: p.initials,
      color: p.color,
      avatarUrl: null,
      isMe: !!p.me,
      goalText: p.goalText ?? `${p.target} active days a week`,
      hasGoal: true,
      pct: pct(done, p.target),
      done,
      target: p.target,
      week: buildWeek({
        keys,
        letters,
        todayKey,
        activeKeys: new Set(p.active.map((i) => keys[i])),
        restKeys: new Set((p.rest ?? []).map((i) => keys[i])),
        joinedKey: startsMonday ? keys[p.joinedIdx!] : null,
      }),
      paused: false,
      quietDays: p.id === "sam" ? 2 : 0,
      startsMonday,
      restToday,
      monthActive: p.month,
      canNudge: !p.me && !startsMonday && done < p.target && !activeToday && !restToday,
      whoop: !!p.whoop,
    };
  });

  const counted = members.filter((m) => !m.startsMonday);
  const podPct = Math.round(
    (counted.reduce((a, m) => a + Math.min(m.done / m.target, 1), 0) / counted.length) * 100
  );
  const remaining = counted.reduce((a, m) => a + Math.max(m.target - m.done, 0), 0);

  const pod: PodData = {
    id: "demo",
    name: "Back Bay Movers",
    weekRange: weekRangeShort(tz, WSO, at),
    inviteCode: "DEMO",
    photoProof: false,
    pct: podPct,
    remaining,
    perfect: remaining === 0,
    streak: 3,
    hasGoalRows: true,
    goalsSet: members.length,
    members,
  };

  const me = members[0];
  const today: TodayData = {
    dateLabel: dateLabel(tz, at),
    my: { pct: me.pct, done: me.done, target: me.target, hasGoal: true },
    whoop: "on",
    recovery: { score: 74, zone: "green" },
    sleep: { performance: 85 },
    restToday: false,
    activeToday: false,
    daysLeft: 7 - todayIdx,
    nextNudge: "6 pm",
    week: me.week,
    monthLabel: monthName(tz, at),
    monthActive: 14,
  };

  const yourTurn: YourTurnData = {
    podName: pod.name,
    multiPod: false,
    others: [
      { name: "Jordan", label: "padel", emoji: "🎾", ago: "25m ago" },
      { name: "Maya", label: "5k run", emoji: "🏃", ago: "2h ago" },
    ],
    meActive: false,
    meRested: false,
    lastOnePod: null,
    remainingForPerfect: remaining,
    nextNudge: "6 pm",
    hasMoveTimes: true,
  };

  const notification = {
    title: pod.name,
    body: "Jordan just logged padel. Your turn to make it count 💪",
  };

  // Concept: pod rewards with WHOOP. Simulated.
  const rewards = {
    whoopMembers: people.filter((p) => p.whoop).length,
    perfectWeeks: 3,
    goal: 4,
    pointsPerWeek: 250,
  };

  return { today, yourTurn, pod, notification, rewards };
}
