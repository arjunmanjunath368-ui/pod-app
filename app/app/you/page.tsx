import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activityMeta, type ActivityKey } from "@/lib/activities";
import { parseGoal, goalProgress } from "@/lib/goals";
import { weekStartUtc } from "@/lib/week";
import { computeYouStats } from "@/lib/youStats";
import YouStats from "@/components/YouStats";
import BottomNav from "@/components/BottomNav";
import SignOutButton from "@/components/SignOutButton";
import AvatarUpload from "@/components/AvatarUpload";
import MyGoals from "@/components/MyGoals";
import ShareStatsToggle from "@/components/ShareStatsToggle";
import PersonalBests, { type PBEntry } from "@/components/PersonalBests";

export default async function YouPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, initials, avatar_color, avatar_url, avatar_source_url, personal_goals, share_stats")
    .eq("id", user.id)
    .maybeSingle();

  const { data: memberships } = await supabase
    .from("pod_members")
    .select(
      "pod_id, joined_at, goal_activity, goal_label, goal_target_per_week, goal_detail, goal_mode, goal_activities, goal_splits, pods(id, name, timezone, week_starts_on)"
    )
    .eq("user_id", user.id)
    .neq("status", "left");

  // Personal bests (private to this user).
  const { data: rawPbs } = await supabase
    .from("personal_bests")
    .select("id, name, value, unit, higher_is_better, details, achieved_on")
    .eq("user_id", user.id)
    .order("achieved_on", { ascending: false });
  const personalBests: PBEntry[] = (rawPbs ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    value: Number(p.value),
    unit: p.unit,
    higherIsBetter: p.higher_is_better,
    details: p.details,
    achievedOn: p.achieved_on,
  }));

  // This user's sessions over ~13 months — enough for all the timeframe views.
  const since = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
  const { data: mySessions } = await supabase
    .from("sessions")
    .select("pod_id, logged_at, activity, activities")
    .eq("user_id", user.id)
    .gte("logged_at", since);

  const firstMembershipPod = memberships?.[0]
    ? Array.isArray(memberships[0].pods)
      ? memberships[0].pods[0]
      : memberships[0].pods
    : null;
  const userTz = (firstMembershipPod as any)?.timezone ?? "America/Chicago";

  // Timeframe analytics (Pod-native: derived from logged sessions + goals).
  const youStats = computeYouStats({
    sessions: (mySessions ?? []).map((s: any) => ({
      podId: s.pod_id as string,
      loggedAt: new Date(s.logged_at),
      activity: (s.activity ?? null) as string | null,
      activities: (s.activities ?? null) as string[] | null,
    })),
    memberships: (memberships ?? []).map((m: any) => ({
      podId: m.pod_id as string,
      goal: parseGoal(m),
      joinedAt: m.joined_at ? new Date(m.joined_at) : null,
    })),
    tz: userTz,
    weekStartsOn: (firstMembershipPod as any)?.week_starts_on ?? 1,
  });

  const pods = (memberships ?? []).map((m: any) => {
    const pod = Array.isArray(m.pods) ? m.pods[0] : m.pods;
    const tz = pod?.timezone ?? "America/Chicago";
    const weekStart = weekStartUtc(tz, pod?.week_starts_on ?? 1);
    const goal = parseGoal(m);
    const mine = (mySessions ?? [])
      .filter(
        (s: any) => s.pod_id === m.pod_id && new Date(s.logged_at) >= weekStart
      )
      .map((s: any) => ({
        activity: s.activity ?? null,
        activities: s.activities ?? null,
      }));
    const { done, target, ratio } = goalProgress(goal, mine);
    const joinedAt = m.joined_at ? new Date(m.joined_at) : null;
    const goalNotStarted =
      goal.hasGoal && !!joinedAt && joinedAt.getTime() > weekStart.getTime();
    return {
      podId: m.pod_id as string,
      name: pod?.name ?? "Pod",
      activity: m.goal_activity as ActivityKey | null,
      label: m.goal_label as string | null,
      target,
      detail: m.goal_detail as string | null,
      done,
      hasGoal: goal.hasGoal,
      goalNotStarted,
      remaining: Math.max(target - done, 0),
      ratio,
    };
  });

  const firstPod = pods[0];

  return (
    <>
      <main className="px-5 pb-28 pt-9">
        <AvatarUpload
          userId={user.id}
          hasPhoto={!!profile?.avatar_url}
          avatarUrl={profile?.avatar_url ?? null}
          sourceUrl={profile?.avatar_source_url ?? null}
          displayName={profile?.display_name ?? "You"}
          initials={profile?.initials ?? "?"}
          color={profile?.avatar_color ?? "#c8553d"}
        />

        <Link
          href="/app/highlight"
          className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-ink p-4 text-paper transition active:scale-[0.99]"
        >
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sage-soft">
              ✨ Monthly highlight
            </div>
            <div className="mt-0.5 text-[15px] font-semibold">
              See how your month's going →
            </div>
          </div>
          <span className="text-[24px] leading-none">🏆</span>
        </Link>

        <div className="mt-7 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
          My goals
        </div>
        <div className="mt-3">
          <MyGoals
            userId={user.id}
            initial={(profile as any)?.personal_goals ?? []}
          />
        </div>

        <div className="mt-7 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
          Your stats
        </div>
        <div className="mt-3">
          <YouStats data={youStats} />
        </div>

        <div className="mt-3 rounded-2xl border border-line bg-card p-4">
          <ShareStatsToggle
            userId={user.id}
            initial={(profile as any)?.share_stats ?? true}
          />
        </div>

        <div className="mt-7 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
          Personal bests
        </div>
        <PersonalBests
          userId={user.id}
          entries={personalBests}
          podIds={(memberships ?? []).map((m: any) => m.pod_id)}
          shareStats={(profile as any)?.share_stats ?? true}
        />

        <div className="mt-7 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
          Your weekly goals
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          {pods.map((p: any) => {
            const meta = activityMeta(p.activity);
            return (
              <div
                key={p.podId}
                className="rounded-2xl border border-line bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[16px] font-semibold text-ink">
                    {p.name}
                  </div>
                  <Link
                    href={`/app/goal?pod=${p.podId}`}
                    className="text-[13px] font-semibold text-terra"
                  >
                    {p.target ? "Edit" : "Set goal"}
                  </Link>
                </div>
                <div className="mt-1 text-[13px] text-muted">
                  {p.hasGoal
                    ? `${meta.emoji} ${p.label ?? meta.label} · ${p.target}×/week${
                        p.detail ? ` · ${p.detail}` : ""
                      }`
                    : "No weekly goal set yet"}
                </div>

                {p.goalNotStarted ? (
                  <div className="mt-3 text-[13px] font-medium text-muted">
                    🌱 Your weekly goal starts Monday — today's logs still build
                    your day streak.
                  </div>
                ) : (
                  p.hasGoal && (
                    <>
                      <div className="mt-3 flex items-center justify-between text-[13px]">
                        <span className="font-semibold text-ink">
                          {p.done}
                          <span className="text-muted">
                            /{p.target} this week
                          </span>
                        </span>
                        <span
                          className={
                            p.remaining === 0
                              ? "font-semibold text-sage"
                              : "text-muted"
                          }
                        >
                          {p.remaining === 0
                            ? "Goal hit ✓"
                            : `${p.remaining} to go`}
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-paper-2">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round(p.ratio * 100)}%`,
                            backgroundColor:
                              p.ratio >= 1 ? "#7a9471" : "#c8553d",
                          }}
                        />
                      </div>
                    </>
                  )
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/app/start/join?from=you"
            className="w-full rounded-2xl bg-terra py-3.5 text-center text-[15px] font-semibold text-white transition active:scale-[0.99]"
          >
            Join another pod
          </Link>
          <SignOutButton />
        </div>
      </main>

      {firstPod && (
        <BottomNav
          active="you"
          podId={firstPod.podId}
          userId={user.id}
          defaultActivity={(firstPod.activity ?? "strength") as ActivityKey}
        />
      )}
    </>
  );
}
