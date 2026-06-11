import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseGoal, goalHit } from "@/lib/goals";
import { weekStartUtc } from "@/lib/week";
import { dayKeyInTz } from "@/lib/days";
import { activityMeta } from "@/lib/activities";
import ShareMonthButton from "@/components/ShareMonthButton";
import HighlightTiles from "@/components/HighlightTiles";

export default async function HighlightPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const firstName = (profile?.display_name ?? "there").split(/\s+/)[0];

  const { data: memberships } = await supabase
    .from("pod_members")
    .select(
      "pod_id, joined_at, goal_activity, goal_label, goal_target_per_week, goal_detail, goal_mode, goal_activities, goal_splits, pods(id, name, timezone, week_starts_on, created_at)"
    )
    .eq("user_id", user.id)
    .neq("status", "left");
  if (!memberships || memberships.length === 0) redirect("/app/start");

  const podOf = (m: any) => (Array.isArray(m.pods) ? m.pods[0] : m.pods);
  const podsList = memberships.map(podOf).filter(Boolean);
  const podIds = podsList.map((p: any) => p.id);

  const now = new Date();
  const tz = podsList[0]?.timezone ?? "America/Chicago";
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const monthPrefix = todayKey.slice(0, 7); // "YYYY-MM"
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "long",
  }).format(now);
  const inMonth = (key: string | null) => !!key && key.startsWith(monthPrefix);

  // My sessions over a window that covers the month + streak lookback.
  const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rawMine } = await supabase
    .from("sessions")
    .select("pod_id, logged_at, activity, activities")
    .eq("user_id", user.id)
    .gte("logged_at", since);
  const myAll = (rawMine ?? []).map((s: any) => ({
    podId: s.pod_id as string,
    loggedAt: new Date(s.logged_at),
    activity: (s.activity ?? null) as string | null,
    activities: (s.activities ?? null) as string[] | null,
  }));

  // A workout logged into several pods is stored once per pod (same instant).
  // For *your* personal recap, collapse those copies so your counts aren't
  // doubled by pod membership. (Active days already de-dupe by calendar day.)
  // A workout logged into several pods in one tap creates one row per pod,
  // landing milliseconds apart — so we collapse copies by (calendar day +
  // activity set) rather than exact time. You don't realistically log two
  // separate identical workouts on the same day, so this counts each once.
  const seenKey = new Set<string>();
  const myUnique = myAll.filter((s) => {
    const day = dayKeyInTz(s.loggedAt, tz);
    const acts = (
      s.activities && s.activities.length
        ? s.activities
        : s.activity
          ? [s.activity]
          : []
    )
      .slice()
      .sort()
      .join(",");
    const key = `${day}|${acts}`;
    if (seenKey.has(key)) return false;
    seenKey.add(key);
    return true;
  });

  // Active days this month + workouts logged this month.
  const monthDayKeys = new Set<string>();
  const activityCounts: Record<string, number> = {};
  for (const s of myUnique) {
    const k = dayKeyInTz(s.loggedAt, tz);
    if (inMonth(k)) {
      monthDayKeys.add(k);
      const acts =
        s.activities && s.activities.length
          ? s.activities
          : s.activity
            ? [s.activity]
            : [];
      for (const a of acts) activityCounts[a] = (activityCounts[a] ?? 0) + 1;
    }
  }
  const activeDays = monthDayKeys.size;
  const loggedBreakdown = Object.entries(activityCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ meta: activityMeta(key as any), count }));

  // Personal weekly metrics on one grid (your timezone, Monday start),
  // aggregated across pods: a week is "on track" only if you hit your goal in
  // every pod where you had an active goal that week. personalWeeks[0] is the
  // current week, [1] last week, and so on.
  const WSO = 1;
  type Wk = { onTrack: boolean; hasGoal: boolean; completed: boolean };
  const personalWeeks: Wk[] = [];
  for (let i = 0; i < 6; i++) {
    const ref = new Date(now.getTime() - i * 7 * 86400000);
    const ws = weekStartUtc(tz, WSO, ref);
    const wsKey = dayKeyInTz(ws, tz);
    if (!inMonth(wsKey)) {
      if (ws.getTime() < new Date(`${monthPrefix}-01T00:00:00Z`).getTime()) break;
      continue;
    }
    const weekEnd = ws.getTime() + 7 * 86400000;
    let goalPods = 0;
    let hitPods = 0;
    for (const m of memberships) {
      const goal = parseGoal(m);
      if (!goal.hasGoal) continue;
      const joinedAt = m.joined_at ? new Date(m.joined_at) : null;
      if (joinedAt && joinedAt.getTime() > ws.getTime()) continue; // not in yet
      goalPods++;
      const podMine = myAll
        .filter(
          (s) =>
            s.podId === m.pod_id &&
            s.loggedAt.getTime() >= ws.getTime() &&
            s.loggedAt.getTime() < weekEnd
        )
        .map((s) => ({
          activity: (s.activity ?? "other") as any,
          activities: s.activities ?? null,
        }));
      if (goalHit(goal, podMine)) hitPods++;
    }
    personalWeeks.push({
      hasGoal: goalPods > 0,
      onTrack: goalPods > 0 && hitPods === goalPods,
      completed: weekEnd <= now.getTime(),
    });
  }

  // Week streak: consecutive on-track weeks from now back. An in-progress week
  // that you haven't hit yet doesn't break it; a finished, missed week does.
  let weekStreak = 0;
  for (const w of personalWeeks) {
    if (!w.hasGoal) continue;
    if (w.onTrack) {
      weekStreak++;
      continue;
    }
    if (!w.completed) continue; // current week still open — no penalty
    break;
  }

  // Consistency: share of this month's *finished* goal-weeks you hit.
  const finishedGoalWeeks = personalWeeks.filter((w) => w.hasGoal && w.completed);
  const onTrackFinished = finishedGoalWeeks.filter((w) => w.onTrack).length;
  const consistencyPct =
    finishedGoalWeeks.length > 0
      ? Math.round((100 * onTrackFinished) / finishedGoalWeeks.length)
      : null; // no finished weeks yet (e.g. first week) → empty state

  // Personal bests set this month.
  const { data: rawPbs } = await supabase
    .from("personal_bests")
    .select("name, achieved_on")
    .eq("user_id", user.id)
    .order("achieved_on", { ascending: false });
  const monthPbs = (rawPbs ?? [])
    .filter((p: any) => inMonth(p.achieved_on))
    .map((p: any) => p.name as string);

  // Challenges this month — answered (I completed) + sent.
  const { data: rawSent } = await supabase
    .from("challenges")
    .select("created_at")
    .eq("from_user", user.id);
  const challengesSent = (rawSent ?? []).filter((c: any) =>
    inMonth(dayKeyInTz(new Date(c.created_at), tz))
  ).length;
  const { data: rawAnswered } = await supabase
    .from("challenges")
    .select("completed_at")
    .eq("to_user", user.id)
    .eq("status", "completed");
  const challengesAnswered = (rawAnswered ?? []).filter(
    (c: any) => c.completed_at && inMonth(dayKeyInTz(new Date(c.completed_at), tz))
  ).length;

  // Pod collective showing-up this month + active member counts.
  const { data: rawPodSessions } = await supabase
    .from("sessions")
    .select("pod_id, user_id, logged_at")
    .in("pod_id", podIds)
    .gte("logged_at", since);
  const { data: rawMembers } = await supabase
    .from("pod_members")
    .select("pod_id, user_id")
    .in("pod_id", podIds)
    .eq("status", "active");
  const podStats = podsList.map((p: any) => {
    const ptz = p.timezone ?? tz;
    const sessions = (rawPodSessions ?? []).filter(
      (s: any) =>
        s.pod_id === p.id && inMonth(dayKeyInTz(new Date(s.logged_at), ptz))
    ).length;
    const members = (rawMembers ?? []).filter(
      (mm: any) => mm.pod_id === p.id
    ).length;
    return { id: p.id, name: p.name as string, sessions, members };
  });

  const nothingYet =
    activeDays === 0 &&
    monthPbs.length === 0 &&
    challengesSent === 0 &&
    challengesAnswered === 0;

  const stats: { label: string; value: string; explain: string }[] = [
    {
      label: activeDays === 1 ? "active day" : "active days",
      value: String(activeDays),
      explain: "Days you logged at least one workout this month.",
    },
    {
      label: "week streak",
      value: weekStreak > 0 ? `🔥${weekStreak}` : "0",
      explain:
        "Weeks in a row you've hit your goal. Rest days don't break it — only a full missed week does.",
    },
    {
      label: "consistency",
      value: consistencyPct === null ? "—" : `${consistencyPct}%`,
      explain:
        "Share of this month's finished weeks where you hit your goal.",
    },
  ];

  return (
    <div className="flex flex-1 flex-col px-5 pb-12 pt-6">
      <Link
        href="/app/you"
        className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted active:scale-95"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        You
      </Link>

      <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-terra">
        ✨ Monthly highlight
      </div>
      <h1 className="mt-1 font-serif text-[30px] font-semibold leading-tight text-ink">
        Your {monthLabel}
      </h1>
      <p className="mt-1 text-[14px] text-muted">
        {firstName}'s month so far — it's still being written.
      </p>

      {nothingYet ? (
        <div className="mt-8 rounded-3xl border border-dashed border-line bg-card p-8 text-center">
          <div className="text-[32px]">🌱</div>
          <p className="mt-2 font-serif text-[18px] font-semibold text-ink">
            Your {monthLabel} starts now
          </p>
          <p className="mx-auto mt-1 max-w-[280px] text-[14px] leading-relaxed text-muted">
            Log a session, set a personal best, answer a challenge — and watch
            this fill up.
          </p>
        </div>
      ) : (
        <>
          {/* Consistency tiles (tap to flip for an explanation) */}
          <HighlightTiles tiles={stats} />

          {finishedGoalWeeks.length > 0 && (
            <div className="mt-2.5 rounded-2xl border border-line bg-card p-4">
              <span className="text-[15px] text-ink">
                🎯 You stayed on track{" "}
                <span className="font-semibold text-terra">
                  {onTrackFinished} of {finishedGoalWeeks.length}{" "}
                  {finishedGoalWeeks.length === 1 ? "week" : "weeks"}
                </span>{" "}
                this month.
              </span>
            </div>
          )}

          {/* What you actually logged */}
          {loggedBreakdown.length > 0 && (
            <div className="mt-6">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
                What you logged
              </div>
              <div className="mt-3 rounded-2xl border border-line bg-card p-4">
                <div className="flex flex-col gap-2.5">
                  {loggedBreakdown.map((b) => (
                    <div
                      key={b.meta.label}
                      className="flex items-center justify-between"
                    >
                      <span className="text-[15px] text-ink">
                        {b.meta.emoji} {b.meta.label}
                      </span>
                      <span className="text-[15px] font-semibold text-ink">
                        {b.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bests */}
          {monthPbs.length > 0 && (
            <div className="mt-6">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
                Bests you set
              </div>
              <div className="mt-3 rounded-2xl border border-line bg-card p-4">
                <div className="flex flex-wrap gap-2">
                  {monthPbs.map((n, i) => (
                    <span
                      key={`${n}-${i}`}
                      className="rounded-full bg-gold/[0.14] px-3 py-1.5 text-[13px] font-semibold text-ink"
                    >
                      🏆 {n}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Challenges */}
          {(challengesAnswered > 0 || challengesSent > 0) && (
            <div className="mt-6">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
                Keeping each other going
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-line bg-card p-4">
                  <div className="font-serif text-[24px] font-semibold leading-none text-ink">
                    {challengesAnswered}
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    challenge{challengesAnswered === 1 ? "" : "s"} you rose to
                  </div>
                </div>
                <div className="rounded-2xl border border-line bg-card p-4">
                  <div className="font-serif text-[24px] font-semibold leading-none text-ink">
                    {challengesSent}
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    you sent a teammate
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pods */}
          <div className="mt-6">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
              Your {podStats.length === 1 ? "pod" : "pods"} this month
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {podStats.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-line bg-card p-4"
                >
                  <div className="text-[15px] font-semibold text-ink">
                    {p.name}
                  </div>
                  <div className="mt-0.5 text-[14px] text-ink-soft">
                    {p.members} {p.members === 1 ? "member" : "members"} showed up{" "}
                    <span className="font-semibold text-sage">
                      {p.sessions} {p.sessions === 1 ? "time" : "times"}
                    </span>{" "}
                    together.
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ShareMonthButton
            monthLabel={monthLabel}
            name={firstName}
            activeDays={activeDays}
            weekStreak={weekStreak}
            consistency={consistencyPct}
            onTrackWeeks={onTrackFinished}
            pbCount={monthPbs.length}
            challenges={challengesAnswered + challengesSent}
          />

          <p className="mt-7 text-center text-[14px] leading-relaxed text-muted">
            Every session is a vote for the person you're becoming. Keep showing
            up. 💪
          </p>
        </>
      )}
    </div>
  );
}
