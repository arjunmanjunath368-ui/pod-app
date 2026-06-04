import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { weekStartUtc, weekRangeLabel } from "@/lib/week";
import { computeStreaks } from "@/lib/streaks";
import { dayKeyInTz } from "@/lib/days";
import { activityMeta, type ActivityKey } from "@/lib/activities";
import BottomNav from "@/components/BottomNav";
import InviteButton from "@/components/InviteButton";
import NudgeButton from "@/components/NudgeButton";
import NudgeBanner from "@/components/NudgeBanner";

async function buildSection(supabase: any, pod: any, userId: string, now: Date) {
  const podId = pod.id as string;
  const tz = pod.timezone ?? "America/Chicago";
  const wso = pod.week_starts_on ?? 1;

  const { data: members } = await supabase
    .from("pod_members")
    .select(
      "user_id, status, joined_at, goal_activity, goal_label, goal_target_per_week, goal_detail, profiles(display_name, initials, avatar_color, avatar_url, share_stats)"
    )
    .eq("pod_id", podId)
    .neq("status", "left");

  const weekStart = weekStartUtc(tz, wso);
  const podCreatedAt = pod.created_at
    ? new Date(pod.created_at)
    : new Date(Date.now() - 26 * 7 * 86400000);

  const { data: sessions } = await supabase
    .from("sessions")
    .select("user_id, logged_at")
    .eq("pod_id", podId)
    .gte("logged_at", podCreatedAt.toISOString());

  const counts: Record<string, number> = {};
  const monthPrefix = dayKeyInTz(now, tz).slice(0, 7);
  const monthDays: Record<string, Set<string>> = {};
  const allDays: Record<string, Set<string>> = {};
  (sessions ?? []).forEach((s: any) => {
    if (new Date(s.logged_at) >= weekStart)
      counts[s.user_id] = (counts[s.user_id] ?? 0) + 1;
    const k = dayKeyInTz(new Date(s.logged_at), tz);
    (allDays[s.user_id] ??= new Set()).add(k);
    if (k.startsWith(monthPrefix)) (monthDays[s.user_id] ??= new Set()).add(k);
  });

  const { podStreak } = computeStreaks({
    members: (members ?? []).map((m: any) => ({
      userId: m.user_id,
      target: m.goal_target_per_week ?? 0,
      hasGoal: !!m.goal_target_per_week,
      status: m.status,
      joinedAt: m.joined_at ? new Date(m.joined_at) : podCreatedAt,
    })),
    sessions: (sessions ?? []).map((s: any) => ({
      userId: s.user_id,
      loggedAt: new Date(s.logged_at),
    })),
    tz,
    weekStartsOn: wso,
    podCreatedAt,
  });

  const rows = (members ?? [])
    .filter((m: any) => m.status === "active" || m.status === "paused")
    .map((m: any) => {
      const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const target = m.goal_target_per_week ?? 0;
      const done = counts[m.user_id] ?? 0;
      const hasGoal = !!m.goal_target_per_week;
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
        hasGoal,
        ratio: hasGoal ? Math.min(done / target, 1) : 0,
        fire: monthDays[m.user_id]?.size ?? 0,
        total: allDays[m.user_id]?.size ?? 0,
        shareStats: prof?.share_stats ?? false,
        paused: m.status === "paused",
        isMe: m.user_id === userId,
      };
    })
    .sort((a: any, b: any) => (a.isMe === b.isMe ? 0 : a.isMe ? -1 : 1));

  const goalRows = rows.filter((r: any) => r.hasGoal && !r.paused);
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

  return { pod, rows, goalRows, podPct, remainingLabel, podStreak, weekRange: weekRangeLabel(tz, wso) };
}

export default async function Home({
  searchParams,
}: {
  searchParams: { pod?: string; welcome?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("display_name")
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

  const navPodId = podsList[0].id as string;

  const welcomePod =
    sections.find((s: any) => s.pod.id === searchParams.pod) ?? sections[0];
  const welcomeLone = !!welcomePod && welcomePod.rows.length <= 1;

  return (
    <>
      <main className="flex-1 overflow-y-auto px-5 pb-28 pt-8">
        {/* Header */}
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
          {weekday} · {twist}
        </div>
        <h1 className="font-serif text-[27px] font-semibold leading-tight text-ink">
          {greeting}, {firstName}
        </h1>

        <NudgeBanner nudges={nudgeList} userId={user.id} />

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
                <InviteButton
                  code={sec.pod.invite_code}
                  podName={sec.pod.name}
                />
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
                      {sec.goalRows.length} of {sec.rows.length} have goals set
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
                ) : (
                  <p className="mt-3 text-[15px] leading-relaxed text-sage-soft">
                    Once people set their weekly goals, you'll see how the pod is
                    tracking together here.
                  </p>
                )}
              </div>

              {/* Member rows */}
              <div className="mt-3 flex flex-col gap-2.5">
                {sec.rows.map((r: any) => {
                  const meta = activityMeta(r.activity);
                  const behind =
                    !r.isMe && r.hasGoal && !r.paused && r.done < r.target;
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
                          </div>
                          {r.paused ? (
                            <div className="mt-0.5 text-[15px] font-medium text-muted">
                              ⏸ Paused this week
                            </div>
                          ) : r.hasGoal ? (
                            <div className="mt-0.5 text-[15px] text-muted">
                              {meta.emoji} {r.label ?? meta.label} ·{" "}
                              {r.target}×/week
                              {r.detail ? ` · ${r.detail}` : ""}
                            </div>
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
                        {r.hasGoal && !r.paused && (
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

                      {r.hasGoal && !r.paused && (
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

                      {behind && (
                        <div className="mt-3 flex justify-end">
                          <NudgeButton
                            podId={sec.pod.id}
                            fromUserId={user.id}
                            toUserId={r.userId}
                            fromName={myProfile?.display_name ?? "Someone"}
                          />
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

      <BottomNav active="home" podId={navPodId} userId={user.id} />
    </>
  );
}
