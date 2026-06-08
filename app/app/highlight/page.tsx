import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseGoal, goalHit } from "@/lib/goals";
import { weekStartUtc } from "@/lib/week";
import { dayKeyInTz } from "@/lib/days";

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
    .select("pod_id, logged_at, activity")
    .eq("user_id", user.id)
    .gte("logged_at", since);
  const myAll = (rawMine ?? []).map((s: any) => ({
    podId: s.pod_id as string,
    loggedAt: new Date(s.logged_at),
    activity: (s.activity ?? null) as string | null,
  }));

  // Active days this month + sessions logged this month.
  const monthDayKeys = new Set<string>();
  let sessionsThisMonth = 0;
  for (const s of myAll) {
    const k = dayKeyInTz(s.loggedAt, tz);
    if (inMonth(k)) {
      monthDayKeys.add(k);
      sessionsThisMonth++;
    }
  }
  const activeDays = monthDayKeys.size;

  // Current day streak (consecutive days up to today with at least one session).
  const allDayKeys = new Set(myAll.map((s) => dayKeyInTz(s.loggedAt, tz)));
  let dayStreak = 0;
  let cursor = new Date(now);
  if (!allDayKeys.has(dayKeyInTz(cursor, tz))) {
    cursor = new Date(cursor.getTime() - 86400000); // today not logged yet — start at yesterday
  }
  while (allDayKeys.has(dayKeyInTz(cursor, tz))) {
    dayStreak++;
    cursor = new Date(cursor.getTime() - 86400000);
  }

  // Weeks you hit your goal this month (per pod, weeks whose start falls in the
  // month and where you were already in the pod). Summed across pods.
  let goalWeeks = 0;
  for (const m of memberships) {
    const goal = parseGoal(m);
    if (!goal.hasGoal) continue;
    const pod = podOf(m);
    if (!pod) continue;
    const ptz = pod.timezone ?? tz;
    const wso = pod.week_starts_on ?? 1;
    const joinedAt = m.joined_at ? new Date(m.joined_at) : null;
    const podMine = myAll.filter((s) => s.podId === m.pod_id);
    let prevStart: number | null = null;
    for (let i = 0; i < 6; i++) {
      const ref = new Date(now.getTime() - i * 7 * 86400000);
      const ws = weekStartUtc(ptz, wso, ref);
      const wsKey = dayKeyInTz(ws, ptz);
      const upper = prevStart ?? now.getTime() + 1;
      prevStart = ws.getTime();
      if (!inMonth(wsKey)) {
        // Once we've walked back past the month, older weeks won't qualify.
        if (ws.getTime() < new Date(`${monthPrefix}-01T00:00:00Z`).getTime())
          break;
        continue;
      }
      if (joinedAt && joinedAt.getTime() > ws.getTime()) continue; // not in pod at week start
      const weekSessions = podMine
        .filter(
          (s) => s.loggedAt.getTime() >= ws.getTime() && s.loggedAt.getTime() < upper
        )
        .map((s) => ({ activity: (s.activity ?? "other") as any }));
      if (goalHit(goal, weekSessions)) goalWeeks++;
    }
  }

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

  const stats: { label: string; value: string }[] = [
    { label: activeDays === 1 ? "active day" : "active days", value: String(activeDays) },
    {
      label: sessionsThisMonth === 1 ? "session" : "sessions",
      value: String(sessionsThisMonth),
    },
    {
      label: dayStreak === 1 ? "day streak" : "day streak",
      value: dayStreak > 0 ? `🔥${dayStreak}` : "0",
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
          {/* Consistency tiles */}
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-ink p-4 text-center text-paper"
              >
                <div className="font-serif text-[26px] font-semibold leading-none">
                  {s.value}
                </div>
                <div className="mt-1 text-[12px] leading-tight text-sage-soft">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {goalWeeks > 0 && (
            <div className="mt-2.5 rounded-2xl border border-line bg-card p-4">
              <span className="text-[15px] text-ink">
                🎯 You hit your weekly goal{" "}
                <span className="font-semibold text-terra">
                  {goalWeeks} {goalWeeks === 1 ? "week" : "weeks"}
                </span>{" "}
                this month.
              </span>
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

          <p className="mt-7 text-center text-[14px] leading-relaxed text-muted">
            Every session is a vote for the person you're becoming. Keep showing
            up. 💪
          </p>
        </>
      )}
    </div>
  );
}
