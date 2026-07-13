import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { weekStartUtc, weekRangeLabel } from "@/lib/week";
import { computeStreaks } from "@/lib/streaks";
import { dayKeyInTz, shortDate } from "@/lib/days";
import { activityMeta, type ActivityKey } from "@/lib/activities";
import { parseGoal, goalProgress, splitBreakdown, goalHit } from "@/lib/goals";
import BottomNav from "@/components/BottomNav";
import Onboarding from "@/components/Onboarding";
import PodSync from "@/components/PodSync";
import InviteButton from "@/components/InviteButton";
import NudgeButton from "@/components/NudgeButton";
import NudgeBanner from "@/components/NudgeBanner";
import ChallengeButton from "@/components/ChallengeButton";
import ChallengeInbox, {
  type IncomingChallenge,
} from "@/components/ChallengeInbox";
import PrCelebrations, {
  type PrCelebration,
} from "@/components/PrCelebrations";

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

  const weekStart = weekStartUtc(tz, wso);
  const podCreatedAt = pod.created_at
    ? new Date(pod.created_at)
    : new Date(Date.now() - 26 * 7 * 86400000);

  const { data: sessions } = await supabase
    .from("sessions")
    .select("user_id, logged_at, activity, activities")
    .eq("pod_id", podId)
    .gte("logged_at", podCreatedAt.toISOString());

  const weekSess: Record<
    string,
    { activity: string | null; activities: string[] | null }[]
  > = {};
  const lastLogAt: Record<string, number> = {};
  const monthPrefix = dayKeyInTz(now, tz).slice(0, 7);
  const monthDays: Record<string, Set<string>> = {};
  const allDays: Record<string, Set<string>> = {};
  (sessions ?? []).forEach((s: any) => {
    const t = new Date(s.logged_at).getTime();
    if (!lastLogAt[s.user_id] || t > lastLogAt[s.user_id])
      lastLogAt[s.user_id] = t;
    if (new Date(s.logged_at) >= weekStart)
      (weekSess[s.user_id] ??= []).push({
        activity: s.activity ?? null,
        activities: s.activities ?? null,
      });
    const k = dayKeyInTz(new Date(s.logged_at), tz);
    (allDays[s.user_id] ??= new Set()).add(k);
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
        joinedAt: m.joined_at ? new Date(m.joined_at) : podCreatedAt,
        mode: g.mode,
        splits: g.splits,
      };
    }),
    sessions: (sessions ?? []).map((s: any) => ({
      userId: s.user_id,
      loggedAt: new Date(s.logged_at),
      activity: s.activity ?? null,
      activities: s.activities ?? null,
    })),
    tz,
    weekStartsOn: wso,
    podCreatedAt,
  });

  // Active stake for this pod — surfaced on Home so the money isn't buried in a
  // settings menu (it's the thing people most need to keep an eye on).
  const { data: stakeRow } = await supabase
    .from("pod_stakes")
    .select("status, stake_amount, period_start, period_weeks")
    .eq("pod_id", podId)
    .eq("status", "active")
    .maybeSingle();
  let stake: { amount: number; weekNow: number; weeks: number } | null = null;
  if (stakeRow) {
    const startMs = new Date(stakeRow.period_start as string).getTime();
    const weeks = (stakeRow.period_weeks as number) ?? 1;
    const elapsed = Math.floor((now.getTime() - startMs) / (7 * 86400000)) + 1;
    stake = {
      amount: Number(stakeRow.stake_amount ?? 0),
      weekNow: Math.min(Math.max(elapsed, 1), weeks),
      weeks,
    };
  }

  const rows = (members ?? [])
    .filter((m: any) => m.status === "active" || m.status === "paused")
    .map((m: any) => {
      const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const goal = parseGoal(m);
      const mine = weekSess[m.user_id] ?? [];
      const { done, target, ratio } = goalProgress(goal, mine);
      const joinedAt = m.joined_at ? new Date(m.joined_at) : podCreatedAt;
      // Joined after this week's Monday → weekly goal hasn't started yet.
      const goalNotStarted =
        goal.hasGoal && joinedAt.getTime() > weekStart.getTime();
      return {
        userId: m.user_id,
        name: prof?.display_name ?? "Member",
        initials: prof?.initials ?? "?",
        color: prof?.avatar_color ?? "#c8553d",
        avatarUrl: prof?.avatar_url ?? null,
        activity: m.goal_activity as ActivityKey | null,
        label: m.goal_label as string | null,
        target,
        detail: m.goal_detail as string | null,
        done,
        hasGoal: goal.hasGoal,
        ratio,
        mode: goal.mode,
        breakdown:
          goal.mode === "split" ? splitBreakdown(goal, mine) : [],
        fire: monthDays[m.user_id]?.size ?? 0,
        total: allDays[m.user_id]?.size ?? 0,
        shareStats: prof?.share_stats ?? false,
        paused: m.status === "paused",
        pauseUntil:
          m.pause_until &&
          (m.pause_until as string).slice(0, 10) >= dayKeyInTz(now, tz)
            ? shortDate(m.pause_until as string)
            : null,
        pauseOverdue:
          !!m.pause_until &&
          (m.pause_until as string).slice(0, 10) < dayKeyInTz(now, tz),
        goalNotStarted,
        isMe: m.user_id === userId,
        // Days since their last log in this pod (from joining if never logged).
        // Drives the quiet-member label and the self "pause?" prompt.
        quietDays: Math.floor(
          (now.getTime() -
            (lastLogAt[m.user_id] ?? joinedAt.getTime())) /
            86400000
        ),
      };
    })
    .sort((a: any, b: any) => (a.isMe === b.isMe ? 0 : a.isMe ? -1 : 1));

  const goalRows = rows.filter(
    (r: any) => r.hasGoal && !r.paused && !r.goalNotStarted
  );
  const podPct = goalRows.length
    ? Math.round(
        (goalRows.reduce((acc: number, r: any) => acc + r.ratio, 0) /
          goalRows.length) *
          100
      )
    : 0;
  const totalRemaining = goalRows.reduce(
    (acc: number, r: any) => acc + Math.max(r.target - r.done, 0),
    0
  );
  const remainingLabel =
    totalRemaining === 0
      ? "Perfect week — everyone showed up 🎉"
      : `${totalRemaining} ${
          totalRemaining === 1 ? "session" : "sessions"
        } from a perfect week.`;

  // The current user's own goal status in this pod, for the momentum banner:
  // did I hit my goal this week yet, and did I hit it last week?
  const meMember = (members ?? []).find((m: any) => m.user_id === userId);
  const myGoal = meMember ? parseGoal(meMember) : null;
  let meHasGoal = false;
  let meHitThisWeek = false;
  let meHitLastWeek = false;
  if (myGoal?.hasGoal) {
    meHasGoal = true;
    meHitThisWeek = goalHit(myGoal, weekSess[userId] ?? []);
    const lastWeekStart = new Date(weekStart.getTime() - 7 * 86400000);
    const lastWeekMine = (sessions ?? [])
      .filter(
        (s: any) =>
          s.user_id === userId &&
          new Date(s.logged_at) >= lastWeekStart &&
          new Date(s.logged_at) < weekStart
      )
      .map((s: any) => ({
        activity: s.activity ?? null,
        activities: s.activities ?? null,
      }));
    meHitLastWeek = goalHit(myGoal, lastWeekMine);
  }

  return { pod, rows, goalRows, goalsSet: rows.filter((r: any) => r.hasGoal).length, podPct, remainingLabel, podStreak, weekRange: weekRangeLabel(tz, wso), meHasGoal, meHitThisWeek, meHitLastWeek, stake };
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
      "pod_id, pods(id, name, invite_code, max_members, timezone, week_starts_on, created_at)"
    )
    .eq("user_id", user.id)
    .neq("status", "left");

  if (!memberships || memberships.length === 0) redirect("/app/start");

  const podsList = memberships
    .map((m: any) => (Array.isArray(m.pods) ? m.pods[0] : m.pods))
    .filter(Boolean);

  const now = new Date();
  const sections = await Promise.all(
    podsList.map((pod: any) => buildSection(supabase, pod, user.id, now))
  );

  // Momentum banner: shown until I've hit my goal somewhere this week. If I
  // hit it last week, celebrate the momentum; if not, offer a clean-slate nudge.
  const meHasGoalAny = sections.some((s: any) => s.meHasGoal);
  const meHitThisWeekAny = sections.some((s: any) => s.meHitThisWeek);
  const meHitLastWeekAny = sections.some((s: any) => s.meHitLastWeek);
  const showMomentum = meHasGoalAny && !meHitThisWeekAny;
  const momentum = meHitLastWeekAny
    ? {
        text: "Strong week behind you — keep the momentum going.",
        icon: "🔥",
        tone: "sage" as const,
      }
    : {
        text: "New week, fresh start. It's never too late to show up.",
        icon: "🌱",
        tone: "terra" as const,
      };

  // Header greeting (uses the first pod's timezone)
  const tz = podsList[0]?.timezone ?? "America/Chicago";
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).format(now)
  );
  const greeting =
    hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 22 ? "Evening" : "Hey";
  const firstName = (myProfile?.display_name ?? "there").split(/\s+/)[0];
  const DAY_TWIST: Record<string, string> = {
    Monday: "Make it count",
    Tuesday: "Keep it rolling",
    Wednesday: "Halfway strong",
    Thursday: "Earn the weekend",
    Friday: "Finish strong",
    Saturday: "Show up for you",
    Sunday: "Close it out",
  };
  const twist = DAY_TWIST[weekday] ?? "Let's move";

  // Unseen nudges for me
  const { data: rawNudges } = await supabase
    .from("nudges")
    .select("id, from_user")
    .eq("to_user", user.id)
    .eq("seen", false)
    .order("created_at", { ascending: false })
    .limit(20);
  const fromIds = Array.from(
    new Set((rawNudges ?? []).map((n: any) => n.from_user))
  );
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

  // Challenges sent to me that are still open (due today or later).
  const todayTz = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const podNameById: Record<string, string> = {};
  podsList.forEach((p: any) => (podNameById[p.id] = p.name));
  const { data: rawCh } = await supabase
    .from("challenges")
    .select("id, from_user, title, link, note, pod_id, due_date")
    .eq("to_user", user.id)
    .eq("status", "active")
    .gte("due_date", todayTz)
    .in(
      "pod_id",
      podsList.map((p: any) => p.id)
    )
    .order("created_at", { ascending: false });
  const challengeFromIds = Array.from(
    new Set((rawCh ?? []).map((c: any) => c.from_user))
  );
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

  // Recent PR milestones from pod-mates (last ~36h, not mine) — a gentle cheer.
  const prSince = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
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
  const prUserIds = Array.from(
    new Set((rawPrs ?? []).map((e: any) => e.user_id))
  );
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

  const navPodId = podsList[0].id as string;

  const welcomePod =
    sections.find((s: any) => s.pod.id === searchParams.pod) ?? sections[0];
  const welcomeLone = !!welcomePod && welcomePod.rows.length <= 1;

  // ---- Absence, across pods ----
  // Quiet everywhere → say it ONCE at the top. Quiet in only some pods → say it
  // inside those pods, worded against the ones you HAVE been logging in (a
  // generic "you've been away" would be plainly false for the active pod).
  const QUIET_DAYS = 5;
  const myPodStates = sections
    .map((s: any) => {
      const me = s.rows.find((r: any) => r.isMe);
      return me
        ? {
            podId: s.pod.id,
            podName: s.pod.name,
            quietDays: me.quietDays as number,
            paused: !!me.paused,
          }
        : null;
    })
    .filter(Boolean)
    .filter((x: any) => !x.paused) as {
    podId: string;
    podName: string;
    quietDays: number;
    paused: boolean;
  }[];
  const quietPods = myPodStates.filter((p) => p.quietDays >= QUIET_DAYS);
  const activePods = myPodStates.filter((p) => p.quietDays < QUIET_DAYS);
  const quietEverywhere = quietPods.length > 0 && activePods.length === 0;
  const maxQuiet = quietPods.reduce((m, p) => Math.max(m, p.quietDays), 0);
  const activeNames = activePods.map((p) => p.podName).join(" and ");

  return (
    <>
      <main className="px-5 pb-28 pt-8">
        {/* First run (or replayed from Settings) — explain what Pod is before
            anything else on the screen has to make sense on its own. */}
        <Onboarding
          userId={user.id}
          open={!(myProfile as any)?.onboarded_at || searchParams.tour === "1"}
        />

        {/* Header */}
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
          {weekday} · {twist}
        </div>
        <h1 className="font-serif text-[27px] font-semibold leading-tight text-ink">
          {greeting}, {firstName}
        </h1>

        <NudgeBanner nudges={nudgeList} userId={user.id} />

        <ChallengeInbox challenges={incomingChallenges} userId={user.id} />

        <PrCelebrations events={prEvents} />

        {/* Away from all your pods — one message, not one per pod. */}
        {quietEverywhere && (
          <div className="mt-4 rounded-2xl border border-gold/45 bg-gold/[0.08] p-4">
            <div className="text-[16px] font-semibold text-ink">
              {maxQuiet} days since your last workout
            </div>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              Travel, work, life — it happens. Pause a week and it won't count
              against you. Or log one today and you're right back in.
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

        {showMomentum && (
          <div
            className={`mt-4 flex items-center gap-3 rounded-2xl border p-4 ${
              momentum.tone === "sage"
                ? "border-sage/30 bg-sage/[0.08]"
                : "border-terra/30 bg-terra/[0.08]"
            }`}
          >
            <span className="text-[22px] leading-none">{momentum.icon}</span>
            <p className="text-[14px] font-medium leading-snug text-ink">
              {momentum.text}
            </p>
          </div>
        )}

        {searchParams.welcome === "1" && (
          <div className="mt-4 rounded-2xl border border-terra/30 bg-terra/[0.08] p-4">
            <div className="text-[16px] font-semibold text-ink">
              You're all set 🎉
            </div>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              Welcome to{" "}
              {sections.find((s: any) => s.pod.id === searchParams.pod)?.pod
                .name ?? "your pod"}
              . Tap the + below to log your first session — that's all it takes
              to show up for your pod.
              {welcomeLone
                ? " It's just you so far — use Invite to bring your people in."
                : ""}
            </p>
          </div>
        )}

        {sections.map((sec: any) => {
          const me = sec.rows.find((r: any) => r.isMe);
          return (
            <div key={sec.pod.id} className="mt-7">
              {/* Pod label */}
              <div className="flex items-center justify-between gap-3">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {sec.pod.name}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/app/pod-settings?pod=${sec.pod.id}`}
                    aria-label="Manage pod"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-ink-soft transition active:scale-95"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </Link>
                  <InviteButton
                    code={sec.pod.invite_code}
                    podName={sec.pod.name}
                  />
                </div>
              </div>

              {/* Set-your-goal prompt */}
              {me && !me.hasGoal && (
                <Link
                  href={`/app/goal?pod=${sec.pod.id}`}
                  className="mt-3 block rounded-2xl border border-terra bg-terra/[0.06] p-4"
                >
                  <div className="text-[15px] font-semibold text-ink">
                    Set your weekly goal →
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted">
                    Pick how many times you'll show up. Until you do, you're not
                    in the count.
                  </div>
                </Link>
              )}

              {/* Consistency card */}
              <div className="mt-3 rounded-3xl bg-ink p-6 text-paper shadow-pod-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sage-soft">
                      Your pod · this week
                    </div>
                    <div className="mt-0.5 text-[12px] text-sage-soft/80">
                      {sec.weekRange}
                    </div>
                  </div>
                  {sec.podStreak > 0 ? (
                    <div className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-semibold text-paper">
                      🔥 {sec.podStreak}-week pod streak
                    </div>
                  ) : (
                    <div className="text-[12px] text-sage-soft">
                      {sec.goalsSet} of {sec.rows.length} have goals set
                    </div>
                  )}
                </div>

                {sec.goalRows.length > 0 ? (
                  <>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-serif text-[52px] font-semibold leading-none text-paper">
                        {sec.podPct}%
                      </span>
                      <span className="text-[15px] text-sage-soft">
                        of the pod's goals hit
                      </span>
                    </div>
                    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/12">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#4ADE80] to-[#60A5FA]"
                        style={{ width: `${sec.podPct}%` }}
                      />
                    </div>
                    <div className="mt-3 text-[15px] font-semibold text-gold">
                      {sec.remainingLabel}
                    </div>
                    <p className="mt-3 text-[15px] leading-relaxed text-sage-soft">
                      It's not about who does the most. The pod rises when
                      everyone shows up to their own goal.
                    </p>
                  </>
                ) : sec.goalsSet > 0 ? (
                  <p className="mt-3 text-[15px] leading-relaxed text-sage-soft">
                    Goals are set 🌱 Your pod's week kicks off Monday — tracking
                    starts then.
                  </p>
                ) : (
                  <p className="mt-3 text-[15px] leading-relaxed text-sage-soft">
                    Once people set their weekly goals, you'll see how the pod is
                    tracking together here.
                  </p>
                )}
              </div>

              {/* Quiet in THIS pod while logging in another — the one case a
                  pod-specific message is truer than a blanket one. */}
              {(() => {
                const mine = sec.rows.find((r: any) => r.isMe);
                if (!mine || mine.paused || mine.quietDays < QUIET_DAYS)
                  return null;
                if (quietEverywhere) return null; // already said at the top
                return (
                  <div className="mt-3 rounded-2xl border border-gold/45 bg-gold/[0.08] p-4">
                    <div className="text-[15px] font-semibold text-ink">
                      Nothing logged here in {mine.quietDays} days
                    </div>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
                      {activeNames
                        ? `You've been showing up in ${activeNames} — this pod just hasn't seen it. Log here too, or pause the week.`
                        : "Log one to pick things back up, or pause the week if you're away."}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/app/pod-settings?pod=${sec.pod.id}`}
                        className="rounded-full border border-line bg-card px-3.5 py-2 text-[14px] font-semibold text-ink-soft active:scale-95"
                      >
                        ⏸ Pause my week
                      </Link>
                    </div>
                  </div>
                );
              })()}

              {/* Stakes — visible on Home, not buried in the gear menu. */}
              <Link
                href={`/app/stakes?pod=${sec.pod.id}`}
                className={`mt-3 flex items-center justify-between rounded-2xl border p-4 active:scale-[0.99] ${
                  sec.stake
                    ? "border-gold/50 bg-gold/[0.08]"
                    : "border-line bg-card"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-ink">
                    {sec.stake
                      ? `\u{1F4B0} $${sec.stake.amount} on the line`
                      : "\u{1F4B0} Add stakes"}
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted">
                    {sec.stake
                      ? `Week ${sec.stake.weekNow} of ${sec.stake.weeks} \u00b7 see standings`
                      : "Put real money on the week \u2014 miss your goal, you pay in."}
                  </div>
                </div>
                <span className="ml-3 shrink-0 text-muted" aria-hidden>
                  \u203a
                </span>
              </Link>

              {/* Member rows */}
              <div className="mt-3 flex flex-col gap-2.5">
                {sec.rows.map((r: any) => {
                  const meta = activityMeta(r.activity);
                  const behind =
                    !r.isMe &&
                    r.hasGoal &&
                    !r.paused &&
                    !r.goalNotStarted &&
                    r.done < r.target;
                  return (
                    <div
                      key={r.userId}
                      className="rounded-2xl border border-line bg-card p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          url={r.avatarUrl}
                          initials={r.initials}
                          color={r.color}
                          size={44}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[16px] font-semibold text-ink">
                              {r.name}
                            </span>
                            {r.shareStats && r.total > 0 && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 text-[12px] font-semibold text-terra">
                                🔥 {r.total} {r.total === 1 ? "day" : "days"}
                              </span>
                            )}
                            {r.isMe && (
                              <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[12px] font-semibold text-muted">
                                you
                              </span>
                            )}
                            {!r.paused && !r.isMe && r.quietDays >= 5 && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 text-[12px] font-semibold text-muted">
                                💤 quiet {r.quietDays}d
                              </span>
                            )}
                          </div>
                          {r.paused ? (
                            r.isMe ? (
                              <Link
                                href={`/app/pod-settings?pod=${sec.pod.id}`}
                                className="mt-0.5 inline-flex items-center gap-1 text-[15px] font-semibold text-terra"
                              >
                                <span>
                                  ⏸ Paused
                                  {r.pauseUntil
                                    ? ` · back ~${r.pauseUntil}`
                                    : ""}{" "}
                                  · Resume
                                </span>
                                <span aria-hidden>›</span>
                              </Link>
                            ) : (
                              <div className="mt-0.5 text-[15px] font-medium text-muted">
                                ⏸ Paused
                                {r.pauseUntil
                                  ? ` · back ~${r.pauseUntil}`
                                  : r.pauseOverdue
                                    ? " · ready to resume"
                                    : " this week"}
                              </div>
                            )
                          ) : r.goalNotStarted ? (
                            <div className="mt-0.5 text-[15px] text-muted">
                              🌱 Goal starts Monday
                            </div>
                          ) : r.hasGoal ? (
                            r.mode === "split" ? (
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[15px] text-muted">
                                {r.breakdown.map((b: any) => {
                                  const bm = activityMeta(b.activity);
                                  const met = b.done >= b.target;
                                  return (
                                    <span
                                      key={b.activity}
                                      className={met ? "text-sage" : ""}
                                    >
                                      {bm.emoji} {b.done}/{b.target}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="mt-0.5 text-[15px] text-muted">
                                {meta.emoji} {r.label ?? meta.label} ·{" "}
                                {r.target}×/week
                                {r.detail ? ` · ${r.detail}` : ""}
                              </div>
                            )
                          ) : r.isMe ? (
                            <Link
                              href={`/app/goal?pod=${sec.pod.id}`}
                              className="mt-0.5 inline-block text-[15px] font-semibold text-terra"
                            >
                              Set your goal →
                            </Link>
                          ) : (
                            <div className="mt-0.5 text-[15px] text-muted">
                              Getting set up…
                            </div>
                          )}
                        </div>
                        {r.hasGoal && !r.paused && !r.goalNotStarted && (
                          <div className="shrink-0 text-right">
                            <div className="font-serif text-[18px] font-semibold text-ink">
                              {r.done}
                              <span className="text-[15px] text-muted">
                                /{r.target}
                              </span>
                            </div>
                            <div className="text-[12px] uppercase tracking-wide text-muted">
                              this week
                            </div>
                          </div>
                        )}
                      </div>

                      {r.hasGoal && !r.paused && !r.goalNotStarted && (
                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper-2">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.round(r.ratio * 100)}%`,
                              backgroundColor:
                                r.ratio >= 1 ? "#7a9471" : "#c8553d",
                            }}
                          />
                        </div>
                      )}

                      {(!r.isMe || behind) && (
                        <div className="mt-3 flex justify-end gap-2">
                          {!r.isMe && (
                            <ChallengeButton
                              podId={sec.pod.id}
                              fromUserId={user.id}
                              toUserId={r.userId}
                              toName={r.name}
                            />
                          )}
                          {behind && (
                            <NudgeButton
                              podId={sec.pod.id}
                              fromUserId={user.id}
                              toUserId={r.userId}
                              fromName={myProfile?.display_name ?? "Someone"}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* Start or join another pod */}
        <div className="mt-8 rounded-2xl border border-line bg-card p-4">
          <div className="text-[15px] font-semibold text-ink">
            Another pod?
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            Start one for a different circle, or join with a code.
          </p>
          <div className="mt-3 flex gap-2.5">
            <Link
              href="/app/start/create?from=home"
              className="flex-1 rounded-xl bg-ink py-3 text-center text-[14px] font-semibold text-paper transition active:scale-[0.99]"
            >
              Start a pod
            </Link>
            <Link
              href="/app/start/join?from=home"
              className="flex-1 rounded-xl border border-line bg-paper-2/60 py-3 text-center text-[14px] font-semibold text-ink-soft transition active:scale-[0.99]"
            >
              Join with a code
            </Link>
          </div>
        </div>

      </main>


      <PodSync />
      <BottomNav active="home" podId={navPodId} userId={user.id} />
    </>
  );
}
