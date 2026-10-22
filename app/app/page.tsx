import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { weekStartUtc, daysLeftInWeek } from "@/lib/week";
import { computeStreaks } from "@/lib/streaks";
import { dayKeyInTz, shortDate } from "@/lib/days";
import { activityMeta } from "@/lib/activities";
import { timeAgo } from "@/lib/timeago";
import {
  parseGoal,
  goalProgress,
  goalGateTarget,
  podNeedingGoal,
  type WeekSession,
} from "@/lib/goals";
import {
  weekKeys,
  weekLetters,
  buildWeek,
  weekRangeShort,
  dateLabel,
  monthName,
  pct,
} from "@/lib/homeModel";
import { cleanSlots, nextNudgeLabel } from "@/lib/moveSlots";
import { whoopConfig } from "@/lib/whoop";
import { buildDeps, getServiceClient } from "@/lib/whoopStore";
import { loadWhoopHealth } from "@/lib/whoopHealth";
import { autoLogRestDay } from "@/lib/restDay";
import { unitEmoji, unitPhrase } from "@/lib/meals";
import BottomNav from "@/components/BottomNav";
import Onboarding from "@/components/Onboarding";
import PodSync from "@/components/PodSync";
import InviteButton from "@/components/InviteButton";
import NudgeButton from "@/components/NudgeButton";
import NudgeBanner from "@/components/NudgeBanner";
import ChallengeButton from "@/components/ChallengeButton";
import ChallengeInbox, { type IncomingChallenge } from "@/components/ChallengeInbox";
import PrCelebrations, { type PrCelebration } from "@/components/PrCelebrations";
import TodayCard from "@/components/home/TodayCard";
import PodCard from "@/components/home/PodCard";
import YourTurnCard from "@/components/home/YourTurnCard";
import HowItWorks from "@/components/home/HowItWorks";
import RefreshOnce from "@/components/home/RefreshOnce";
import { OpenLogButton } from "@/components/home/LogButton";
import type {
  MemberRow,
  PodData,
  TodayActivity,
  TodayData,
  WhoopState,
  YourTurnData,
} from "@/components/home/types";

const QUIET_DAYS = 5;
const SYNCED = new Set(["whoop", "healthkit"]);

async function buildSection(supabase: any, pod: any, userId: string, now: Date) {
  const podId = pod.id as string;
  const tz = pod.timezone ?? "America/Chicago";
  const wso = pod.week_starts_on ?? 1;

  const { data: members } = await supabase
    .from("pod_members")
    .select(
      "user_id, status, joined_at, goal_activity, goal_label, goal_target_per_week, goal_detail, goal_mode, goal_activities, goal_splits, pause_until, profiles(display_name, initials, avatar_color, avatar_url, share_stats)"
    )
    .eq("pod_id", podId)
    .neq("status", "left");

  // Who Pod paused after a quiet week. Its own query, so Home still loads
  // before the migration that adds the column.
  const autoPaused = new Set<string>();
  {
    const { data: ap, error } = await supabase
      .from("pod_members")
      .select("user_id, auto_paused_at")
      .eq("pod_id", podId)
      .not("auto_paused_at", "is", null);
    if (!error) (ap ?? []).forEach((r: any) => autoPaused.add(r.user_id));
  }

  const weekStart = weekStartUtc(tz, wso, now);
  const podCreatedAt = pod.created_at
    ? new Date(pod.created_at)
    : new Date(now.getTime() - 26 * 7 * 86400000);

  const { data: rawSessions } = await supabase
    .from("sessions")
    .select("user_id, logged_at, activity, activities, rest_day, source, sport_label")
    .eq("pod_id", podId)
    .gte("logged_at", podCreatedAt.toISOString());

  const joinedAtOf: Record<string, number> = {};
  (members ?? []).forEach((m: any) => {
    joinedAtOf[m.user_id] = m.joined_at
      ? new Date(m.joined_at).getTime()
      : podCreatedAt.getTime();
  });
  // Synced activities from before someone joined never belong to the pod
  // (older versions imported a week of history on connect).
  const sessions = ((rawSessions ?? []) as any[]).filter((s) => {
    if (s.rest_day || !SYNCED.has(s.source)) return true;
    const j = joinedAtOf[s.user_id];
    return j === undefined || new Date(s.logged_at).getTime() >= j - 60000;
  });

  const todayKey = dayKeyInTz(now, tz);
  const monthPrefix = todayKey.slice(0, 7);
  const keys = weekKeys(tz, wso, now);
  const letters = weekLetters(wso);

  const weekSess: Record<string, WeekSession[]> = {};
  const lastLogAt: Record<string, number> = {};
  const weekActive: Record<string, Set<string>> = {};
  const weekRest: Record<string, Set<string>> = {};
  const monthDays: Record<string, Set<string>> = {};
  const todayLogs: { userId: string; at: number; s: any }[] = [];

  sessions.forEach((s: any) => {
    const at = new Date(s.logged_at);
    const t = at.getTime();
    const k = dayKeyInTz(at, tz);
    if (!lastLogAt[s.user_id] || t > lastLogAt[s.user_id]) lastLogAt[s.user_id] = t;
    if (at >= weekStart) {
      (weekSess[s.user_id] ??= []).push({
        activity: s.activity ?? null,
        activities: s.activities ?? null,
        logged_at: s.logged_at,
        rest_day: s.rest_day ?? false,
      });
      if (s.rest_day) (weekRest[s.user_id] ??= new Set()).add(k);
      else (weekActive[s.user_id] ??= new Set()).add(k);
    }
    if (k === todayKey) todayLogs.push({ userId: s.user_id, at: t, s });
    if (s.rest_day) return; // rest days count toward goals, not activity tallies
    if (k.startsWith(monthPrefix)) (monthDays[s.user_id] ??= new Set()).add(k);
  });

  const { podStreak } = computeStreaks({
    members: (members ?? []).map((m: any) => {
      const g = parseGoal(m);
      return {
        userId: m.user_id,
        target: g.target,
        hasGoal: g.hasGoal,
        status: m.status,
        joinedAt: new Date(joinedAtOf[m.user_id]),
        mode: g.mode,
        splits: g.splits,
      };
    }),
    sessions: sessions.map((s: any) => ({
      userId: s.user_id,
      loggedAt: new Date(s.logged_at),
      activity: s.activity ?? null,
      activities: s.activities ?? null,
      restDay: s.rest_day ?? false,
    })),
    tz,
    weekStartsOn: wso,
    podCreatedAt,
    now,
  });

  // Active stake: a compact line under the pod card.
  const { data: stakeRow } = await supabase
    .from("pod_stakes")
    .select("*")
    .eq("pod_id", podId)
    .eq("status", "active")
    .maybeSingle();
  let stake: { label: string; sub: string } | null = null;
  if (stakeRow) {
    const startMs = new Date(stakeRow.period_start as string).getTime();
    const weeks = (stakeRow.period_weeks as number) ?? 1;
    const elapsed = Math.floor((now.getTime() - startMs) / (7 * 86400000)) + 1;
    const weekNow = Math.min(Math.max(elapsed, 1), weeks);
    const label =
      stakeRow.kind === "meal"
        ? (() => {
            const p = unitPhrase((stakeRow.unit_label as string | null) ?? null, 1);
            return `${unitEmoji((stakeRow.unit_label as string | null) ?? null)} ${p.charAt(0).toUpperCase() + p.slice(1)} on the line`;
          })()
        : `💰 $${Number(stakeRow.stake_amount ?? 0)} on the line`;
    stake = { label, sub: `Week ${weekNow} of ${weeks}` };
  }

  const firstName = (n: string) => n.split(/\s+/)[0];

  type Row = MemberRow & { eligible: boolean; activeToday: boolean };
  const rows: Row[] = ((members ?? []) as any[])
    .filter((m) => m.status === "active" || m.status === "paused")
    .map((m) => {
      const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const goal = parseGoal(m);
      const { done, target } = goalProgress(goal, weekSess[m.user_id] ?? [], tz);
      const joined = joinedAtOf[m.user_id];
      const isMe = m.user_id === userId;
      const paused = m.status === "paused";
      const startsMonday = goal.hasGoal && joined > weekStart.getTime();
      const name = prof?.display_name ?? "Member";
      const goalText =
        goal.mode === "split"
          ? goal.splits
              .map((s) => `${activityMeta(s.activity).emoji} ${s.target}`)
              .join("  ") + ` · ${target} days a week`
          : `${target} active ${target === 1 ? "day" : "days"} a week`;
      // You page treats sharing as on until someone turns it off; so does Home.
      const shares = prof?.share_stats ?? true;
      const pauseUntil =
        m.pause_until && (m.pause_until as string).slice(0, 10) >= todayKey
          ? shortDate(m.pause_until as string)
          : null;
      const auto = autoPaused.has(m.user_id);
      return {
        userId: m.user_id,
        name,
        initials: prof?.initials ?? "?",
        color: prof?.avatar_color ?? "#c8553d",
        avatarUrl: prof?.avatar_url ?? null,
        isMe,
        goalText,
        hasGoal: goal.hasGoal,
        pct: pct(done, target),
        done,
        target,
        week: buildWeek({
          keys,
          letters,
          todayKey,
          activeKeys: weekActive[m.user_id] ?? new Set(),
          restKeys: weekRest[m.user_id] ?? new Set(),
          joinedKey: dayKeyInTz(new Date(joined), tz),
        }),
        paused,
        pausedText: paused
          ? auto
            ? isMe
              ? "⏸ Paused after 7 quiet days. Log anything to come back"
              : "⏸ Paused after a quiet week"
            : `⏸ Paused${pauseUntil ? ` · back ~${pauseUntil}` : " this week"}`
          : undefined,
        autoPaused: auto,
        quietDays: Math.floor(
          (now.getTime() - (lastLogAt[m.user_id] ?? joined)) / 86400000
        ),
        startsMonday,
        restToday: (weekRest[m.user_id] ?? new Set()).has(todayKey),
        monthActive: isMe || shares ? monthDays[m.user_id]?.size ?? 0 : null,
        canNudge: false,
        eligible: goal.hasGoal && !paused && !startsMonday,
        activeToday: (weekActive[m.user_id] ?? new Set()).has(todayKey),
        _first: firstName(name),
      } as Row & { _first: string };
    })
    .sort((a, b) => (a.isMe === b.isMe ? 0 : a.isMe ? -1 : 1));

  rows.forEach((r) => {
    r.canNudge =
      !r.isMe && r.hasGoal && !r.paused && r.done < r.target && !r.activeToday && !r.restToday;
  });

  // The pod's number counts members whose week started with them. A brand-new
  // pod (everyone joined mid-week) gets a warm-up week that counts everyone.
  const eligible = rows.filter((r) => r.eligible);
  const counted = eligible.length
    ? eligible
    : rows.filter((r) => r.hasGoal && !r.paused);
  const podPct = counted.length
    ? Math.round(
        (counted.reduce((a, r) => a + Math.min(r.done / (r.target || 1), 1), 0) /
          counted.length) *
          100
      )
    : 0;
  const remaining = counted.reduce((a, r) => a + Math.max(r.target - r.done, 0), 0);
  const hasEligible = eligible.length > 0;
  // Only call out mid-week joiners when others are already counting.
  if (!hasEligible) rows.forEach((r) => (r.startsMonday = false));

  const podData: PodData = {
    id: podId,
    name: pod.name,
    weekRange: weekRangeShort(tz, wso, now),
    inviteCode: pod.invite_code,
    photoProof: false,
    pct: podPct,
    remaining,
    perfect: counted.length > 0 && remaining === 0,
    streak: podStreak,
    hasGoalRows: hasEligible,
    goalsSet: rows.filter((r) => r.hasGoal).length,
    members: rows,
  };

  const me = rows.find((r) => r.isMe) ?? null;
  const meCounted = !!me && counted.some((r) => r.userId === me.userId);
  const othersCounted = counted.filter((r) => !r.isMe);
  const lastOne =
    meCounted &&
    !!me &&
    me.done < me.target &&
    othersCounted.length > 0 &&
    othersCounted.every((r) => r.done >= r.target);

  // Pod-mates who showed up today, newest first, one line each.
  const nameById: Record<string, string> = {};
  rows.forEach((r: any) => (nameById[r.userId] = r._first));
  const seen = new Set<string>();
  const othersToday: TodayActivity[] = todayLogs
    .filter((l) => l.userId !== userId && !l.s.rest_day && nameById[l.userId])
    .sort((a, b) => b.at - a.at)
    .filter((l) => (seen.has(l.userId) ? false : (seen.add(l.userId), true)))
    .map((l) => {
      const key = (l.s.activities && l.s.activities[0]) || l.s.activity;
      const meta = activityMeta(key);
      return {
        name: nameById[l.userId],
        label: (l.s.sport_label as string | null) ?? meta.label.toLowerCase(),
        emoji: meta.emoji,
        ago: timeAgo(new Date(l.at), now),
      };
    });

  return {
    pod,
    tz,
    wso,
    podData,
    me,
    stake,
    lastOne,
    remaining,
    othersToday,
    myMonthKeys: monthDays[userId] ?? new Set<string>(),
    myWeekActive: weekActive[userId] ?? new Set<string>(),
    myWeekRest: weekRest[userId] ?? new Set<string>(),
    myJoinedKey: dayKeyInTz(new Date(joinedAtOf[userId] ?? podCreatedAt.getTime()), tz),
    keys,
    letters,
    todayKey,
  };
}

type Section = Awaited<ReturnType<typeof buildSection>>;

// Recovery and sleep load after the rest of Home, so a slow WHOOP response
// never holds up the screen. On a red-recovery day this also logs the rest day
// if WHOOP's notification hasn't already.
async function TodayWithWhoop({ base, userId }: { base: TodayData; userId: string }) {
  const svc = getServiceClient();
  const cfg = whoopConfig();
  if (!svc || !cfg) return <TodayCard data={{ ...base, whoop: "none" }} />;
  const { data: conn } = await svc
    .from("whoop_connections")
    .select("scopes")
    .eq("user_id", userId)
    .maybeSingle();
  if (!conn) return <TodayCard data={{ ...base, whoop: "reconnect" }} />;

  let health;
  try {
    health = await loadWhoopHealth(buildDeps(svc, cfg), userId, String(conn.scopes ?? ""));
  } catch {
    return <TodayCard data={base} />;
  }

  let restToday = base.restToday;
  let logged = false;
  if (health.recoveryCheck === "red" && !base.activeToday && !base.restToday) {
    try {
      const r = await autoLogRestDay(svc, userId);
      logged = r.logged > 0;
      restToday = restToday || logged;
    } catch {
      /* the webhook or the next visit will catch it */
    }
  }

  const data: TodayData = {
    ...base,
    whoop: health.needsReconnect ? "reconnect" : "on",
    recovery: health.recovery,
    sleep: health.sleep,
    sleepNeedsReconnect: health.sleepNeedsReconnect,
    restToday,
    week: logged
      ? base.week.map((d) => (d.isToday ? { ...d, state: "rest" as const } : d))
      : base.week,
  };
  return (
    <>
      {logged && <RefreshOnce />}
      <TodayCard data={data} />
    </>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: { pod?: string; welcome?: string; tour?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("display_name, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  const emailLocal = (user.email ?? "").split("@")[0];
  const needsName =
    !myProfile?.display_name ||
    myProfile.display_name === emailLocal ||
    myProfile.display_name === "New member";
  if (needsName) redirect("/app/welcome");

  const { data: memberships } = await supabase
    .from("pod_members")
    .select(
      "pod_id, goal_activity, goal_label, goal_target_per_week, goal_mode, goal_activities, goal_splits, pods(id, name, invite_code, max_members, timezone, week_starts_on, created_at)"
    )
    .eq("user_id", user.id)
    .neq("status", "left");

  if (!memberships || memberships.length === 0) redirect("/app/start");

  const onboarded = !!(myProfile as any)?.onboarded_at;
  const goalPod = goalGateTarget(memberships as any[], {
    onboarded,
    replayingTour: searchParams.tour === "1",
  });
  if (goalPod) redirect(`/app/goal?pod=${goalPod}&onboarding=1`);
  const allHaveGoals = podNeedingGoal(memberships as any[]) === null;

  const podsList = memberships
    .map((m: any) => (Array.isArray(m.pods) ? m.pods[0] : m.pods))
    .filter(Boolean);

  const now = new Date();
  const built: Section[] = await Promise.all(
    podsList.map((pod: any) => buildSection(supabase, pod, user.id, now))
  );
  // The pod in the URL first, then the rest.
  const focusIdx = Math.max(
    0,
    built.findIndex((s) => s.pod.id === searchParams.pod)
  );
  const sections = [built[focusIdx], ...built.filter((_, i) => i !== focusIdx)];
  const focus = sections[0];

  // Photo-proof pods (separate query so a missing migration can't break Home).
  const { data: proofRows } = await supabase
    .from("pods")
    .select("id, proof_mode")
    .in(
      "id",
      podsList.map((p: any) => p.id)
    );
  (proofRows ?? []).forEach((r: any) => {
    const s = sections.find((x) => x.pod.id === r.id);
    if (s && r.proof_mode === "photo") s.podData.photoProof = true;
  });

  // Optional profile bits, each in its own query so Home loads before the
  // matching migration has been run.
  const { data: restRow } = await supabase
    .from("profiles")
    .select("rest_days_on")
    .eq("id", user.id)
    .maybeSingle();
  const { data: whoopRow } = await supabase
    .from("profiles")
    .select("whoop_connected_at, whoop_status")
    .eq("id", user.id)
    .maybeSingle();
  const { data: slotRow } = await supabase
    .from("profiles")
    .select("move_slots, timezone")
    .eq("id", user.id)
    .maybeSingle();

  const restOn = !!(restRow as any)?.rest_days_on;
  const whoopConnected = !!(whoopRow as any)?.whoop_connected_at;
  const whoopState: WhoopState = !whoopConnected || !whoopConfig()
    ? "none"
    : (whoopRow as any)?.whoop_status === "needs_reconnect"
      ? "reconnect"
      : restOn
        ? "on"
        : "connected_off";

  const slots = cleanSlots((slotRow as any)?.move_slots);
  const myTz = ((slotRow as any)?.timezone as string | null) || focus.tz;
  let nextNudge: string | null = null;
  try {
    nextNudge = slots.length ? nextNudgeLabel(slots, myTz, now) : null;
  } catch {
    nextNudge = null;
  }

  // ---- Today (yours) ----
  const me = focus.me;
  const myActiveWeek = new Set<string>();
  const myRestWeek = new Set<string>();
  const myMonth = new Set<string>();
  sections.forEach((s) => {
    s.myWeekActive.forEach((k) => myActiveWeek.add(k));
    s.myWeekRest.forEach((k) => myRestWeek.add(k));
    s.myMonthKeys.forEach((k) => myMonth.add(k));
  });
  const activeToday = myActiveWeek.has(focus.todayKey);
  const restToday = myRestWeek.has(focus.todayKey) && !activeToday;
  const baseToday: TodayData = {
    dateLabel: dateLabel(focus.tz, now),
    my: {
      pct: me?.pct ?? 0,
      done: me?.done ?? 0,
      target: me?.target ?? 0,
      hasGoal: !!me?.hasGoal,
    },
    whoop: whoopState,
    recovery: null,
    sleep: null,
    restToday,
    activeToday,
    daysLeft: daysLeftInWeek(focus.tz, focus.wso, now),
    nextNudge,
    week: buildWeek({
      keys: focus.keys,
      letters: focus.letters,
      todayKey: focus.todayKey,
      activeKeys: myActiveWeek,
      restKeys: myRestWeek,
      joinedKey: focus.myJoinedKey,
    }),
    monthLabel: monthName(focus.tz, now),
    monthActive: myMonth.size,
  };

  const yourTurn: YourTurnData = {
    podId: focus.pod.id,
    podName: focus.pod.name,
    others: focus.othersToday,
    meActive: activeToday,
    meRested: restToday,
    lastOne: focus.lastOne,
    remainingForPerfect: focus.remaining,
    nextNudge,
    hasMoveTimes: slots.length > 0,
  };

  // ---- Header ----
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: focus.tz,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now)
  );
  const greeting =
    hour < 5 ? "Hey" : hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 22 ? "Evening" : "Hey";
  const firstName = (myProfile?.display_name ?? "there").split(/\s+/)[0];

  // ---- Nudges, challenges, PRs (unchanged) ----
  const { data: rawNudges } = await supabase
    .from("nudges")
    .select("id, from_user")
    .eq("to_user", user.id)
    .eq("seen", false)
    .order("created_at", { ascending: false })
    .limit(20);
  const fromIds = Array.from(new Set((rawNudges ?? []).map((n: any) => n.from_user)));
  const nameMap: Record<string, string> = {};
  if (fromIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", fromIds);
    (profs ?? []).forEach((p: any) => (nameMap[p.id] = p.display_name));
  }
  const nudgeList = (rawNudges ?? []).map((n: any) => ({
    id: n.id,
    fromName: nameMap[n.from_user] ?? "Someone",
  }));

  const podNameById: Record<string, string> = {};
  podsList.forEach((p: any) => (podNameById[p.id] = p.name));
  const { data: rawCh } = await supabase
    .from("challenges")
    .select("id, from_user, title, link, note, pod_id, due_date")
    .eq("to_user", user.id)
    .eq("status", "active")
    .gte("due_date", focus.todayKey)
    .in(
      "pod_id",
      podsList.map((p: any) => p.id)
    )
    .order("created_at", { ascending: false });
  const challengeFromIds = Array.from(new Set((rawCh ?? []).map((c: any) => c.from_user)));
  const chNameMap: Record<string, string> = {};
  if (challengeFromIds.length) {
    const { data: cprofs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", challengeFromIds);
    (cprofs ?? []).forEach((p: any) => (chNameMap[p.id] = p.display_name));
  }
  const incomingChallenges: IncomingChallenge[] = (rawCh ?? []).map((c: any) => ({
    id: c.id,
    fromName: chNameMap[c.from_user] ?? "Someone",
    title: c.title,
    link: c.link,
    note: c.note,
    podId: c.pod_id,
    podName: podNameById[c.pod_id] ?? "your pod",
  }));

  const prSince = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
  const { data: rawPrs } = await supabase
    .from("pod_pr_events")
    .select("id, user_id, pb_name, pod_id, created_at")
    .in(
      "pod_id",
      podsList.map((p: any) => p.id)
    )
    .neq("user_id", user.id)
    .gte("created_at", prSince)
    .order("created_at", { ascending: false })
    .limit(10);
  const prUserIds = Array.from(new Set((rawPrs ?? []).map((e: any) => e.user_id)));
  const prNameMap: Record<string, string> = {};
  if (prUserIds.length) {
    const { data: pprofs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", prUserIds);
    (pprofs ?? []).forEach((p: any) => (prNameMap[p.id] = p.display_name));
  }
  const prEvents: PrCelebration[] = (rawPrs ?? []).map((e: any) => ({
    id: e.id,
    name: prNameMap[e.user_id] ?? "Someone",
    pbName: e.pb_name,
    podName: podNameById[e.pod_id] ?? "your pod",
  }));

  // ---- Quiet in every pod: one message at the top ----
  const myStates = sections
    .map((s) => (s.me && !s.me.paused ? { podId: s.pod.id, podName: s.pod.name, quietDays: s.me.quietDays } : null))
    .filter(Boolean) as { podId: string; podName: string; quietDays: number }[];
  const quietPods = myStates.filter((p) => p.quietDays >= QUIET_DAYS);
  const quietEverywhere = quietPods.length > 0 && quietPods.length === myStates.length;
  const maxQuiet = quietPods.reduce((m, p) => Math.max(m, p.quietDays), 0);

  const welcomeSection =
    sections.find((s) => s.pod.id === searchParams.pod) ?? focus;
  const welcomeLone = welcomeSection.podData.members.length <= 1;

  // Pod-mates to show in the welcome, so a new member sees their real pod.
  const mates = focus.podData.members
    .filter((m) => !m.isMe)
    .slice(0, 3)
    .map((m) => ({ name: m.name.split(/\s+/)[0], initials: m.initials, color: m.color }));

  return (
    <>
      <main className="px-5 pb-28 pt-8">
        <Onboarding
          userId={user.id}
          pods={sections.map((s) => ({ id: s.pod.id as string, name: s.pod.name as string }))}
          podName={focus.pod.name}
          mates={mates}
          needsGoal={!allHaveGoals}
          hasMoveTimes={slots.length > 0}
          open={!onboarded || searchParams.tour === "1"}
          canSkip={allHaveGoals}
        />

        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate font-serif text-[28px] font-semibold leading-tight text-ink">
            {greeting}, {firstName}
          </h1>
          <HowItWorks />
        </div>

        <NudgeBanner nudges={nudgeList} userId={user.id} />
        <ChallengeInbox challenges={incomingChallenges} userId={user.id} />
        <PrCelebrations events={prEvents} />

        {searchParams.welcome === "1" && onboarded && (
          <div className="mt-4 rounded-2xl border border-terra/30 bg-terra/[0.08] p-4">
            <div className="text-[16px] font-semibold text-ink">
              Welcome to {welcomeSection.pod.name} 🎉
            </div>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              Your active days count from today. Tap + to log your first one.
              {welcomeLone ? " It's just you so far, so use Invite to bring your people in." : ""}
            </p>
          </div>
        )}

        {quietEverywhere && (
          <div className="mt-4 rounded-2xl border border-gold/45 bg-gold/[0.08] p-4">
            <div className="text-[16px] font-semibold text-ink">
              {maxQuiet} days since your last activity
            </div>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              Life happens. Log anything today and you're right back in, or pause
              the week so it doesn't count against you. After 7 quiet days Pod
              pauses you automatically.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {quietPods.map((p) => (
                <Link
                  key={p.podId}
                  href={`/app/pod-settings?pod=${p.podId}`}
                  className="rounded-full border border-line bg-card px-3.5 py-2 text-[14px] font-semibold text-ink-soft active:scale-95"
                >
                  ⏸ Pause{quietPods.length > 1 ? ` · ${p.podName}` : " my week"}
                </Link>
              ))}
            </div>
          </div>
        )}

        {whoopState === "on" ? (
          <Suspense fallback={<TodayCard data={baseToday} loadingWhoop />}>
            <TodayWithWhoop base={baseToday} userId={user.id} />
          </Suspense>
        ) : (
          <TodayCard data={baseToday} />
        )}

        {me && !me.paused && (
          <YourTurnCard data={yourTurn} cta={<OpenLogButton />} />
        )}

        {sections.map((sec) => (
          <div key={sec.pod.id}>
            <PodCard
              pod={sec.podData}
              headerActions={
                <>
                  <Link
                    href={`/app/pod-settings?pod=${sec.pod.id}`}
                    aria-label="Manage pod"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-ink-soft transition active:scale-95"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </Link>
                  <InviteButton code={sec.pod.invite_code} podName={sec.pod.name} />
                </>
              }
              renderActions={(m) =>
                m.canNudge ? (
                  <>
                    <ChallengeButton
                      podId={sec.pod.id}
                      fromUserId={user.id}
                      toUserId={m.userId}
                      toName={m.name}
                    />
                    <NudgeButton
                      podId={sec.pod.id}
                      fromUserId={user.id}
                      toUserId={m.userId}
                      fromName={myProfile?.display_name ?? "Someone"}
                    />
                  </>
                ) : null
              }
              footer={
                sec.me && !sec.me.hasGoal ? (
                  <Link
                    href={`/app/goal?pod=${sec.pod.id}`}
                    className="mb-2 mt-1 block rounded-2xl border border-terra bg-terra/[0.06] p-3.5 text-[14px] font-semibold text-ink"
                  >
                    Set your weekly goal to join the count ›
                  </Link>
                ) : null
              }
            />
            <Link
              href={`/app/stakes?pod=${sec.pod.id}`}
              className="mt-2.5 flex items-center justify-between rounded-2xl px-4 py-3 text-[14px] active:bg-paper-2/60"
            >
              <span className="font-semibold text-ink-soft">
                {sec.stake ? sec.stake.label : "🎯 Add stakes"}
              </span>
              <span className="text-muted">
                {sec.stake ? `${sec.stake.sub} ›` : "Optional ›"}
              </span>
            </Link>
          </div>
        ))}

        <div className="mt-6 flex justify-center gap-5 text-[13px] font-semibold text-muted">
          <Link href="/app/start/create?from=home" className="underline-offset-2 hover:underline">
            Start another pod
          </Link>
          <Link href="/app/start/join?from=home" className="underline-offset-2 hover:underline">
            Join with a code
          </Link>
        </div>
      </main>

      <PodSync />
      <BottomNav active="home" podId={focus.pod.id} userId={user.id} />
    </>
  );
}
