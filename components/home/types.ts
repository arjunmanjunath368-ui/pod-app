// View models for Home. The live page builds these from the database; the demo
// pod builds them from fixtures. Components only ever see these shapes.

// off = before they joined.
export type DayState = "active" | "rest" | "missed" | "today" | "future" | "off";

export type WeekDay = { letter: string; state: DayState; isToday: boolean };

export type WhoopState =
  | "on" // Recovery & sleep turned on
  | "connected_off" // WHOOP connected, Recovery & sleep not turned on
  | "reconnect" // needs reconnecting (or sleep not granted yet)
  | "none"; // no WHOOP connected

export type TodayData = {
  dateLabel: string; // "Thu, Oct 22"
  my: { pct: number; done: number; target: number; hasGoal: boolean };
  // The pod's week beside yours: share of everyone's goals done. Absent for a
  // pod of one.
  pod?: { pct: number; remaining: number; perfect: boolean };
  whoop: WhoopState;
  recovery: { score: number; zone: "red" | "yellow" | "green" } | null;
  sleep: { performance: number } | null;
  sleepNeedsReconnect?: boolean;
  restToday: boolean; // red recovery: today counts as a rest day
  activeToday: boolean;
  daysLeft: number; // including today
  nextNudge: string | null; // "6 pm"
  week: WeekDay[];
  monthLabel: string; // "October"
  monthActive: number;
};

export type MemberRow = {
  userId: string;
  name: string;
  initials: string;
  color: string;
  avatarUrl: string | null;
  isMe: boolean;
  goalText: string; // "4 days a week"
  hasGoal: boolean;
  pct: number;
  done: number;
  target: number;
  week: WeekDay[];
  paused: boolean;
  pausedText?: string; // "Paused · back ~Oct 30"
  autoPaused?: boolean;
  quietDays: number;
  startsMonday: boolean; // joined mid-week: counts for them now, for the pod from Monday
  restToday: boolean;
  monthActive: number | null; // null when they don't share it
  canNudge: boolean;
  whoop?: boolean; // demo only: shows a WHOOP tag
};

export type PodData = {
  id: string;
  name: string;
  weekRange: string; // "Oct 19 – 25"
  inviteCode: string;
  photoProof: boolean;
  pct: number; // pod goals completed
  remaining: number; // active days to a Pod Perfect week
  perfect: boolean;
  streak: number;
  hasGoalRows: boolean;
  goalsSet: number;
  members: MemberRow[];
  monthShort?: string; // "Oct": labels each member's active days this month
};

export type TodayActivity = {
  name: string;
  label: string; // "pickleball"
  emoji: string;
  ago: string; // "2h ago"
  pod?: string; // shown when the member is in more than one pod
  userId?: string;
  at?: number;
};

// Across all of the member's pods.
export type YourTurnData = {
  podName: string; // the pod's name, or "your pods" when there are several
  multiPod: boolean;
  others: TodayActivity[]; // pod-mates who showed up today, newest first
  meActive: boolean;
  meRested: boolean;
  lastOnePod: string | null; // a pod where everyone else has hit their goal
  remainingForPerfect: number | null; // single pod only
  nextNudge: string | null;
  hasMoveTimes: boolean;
};
