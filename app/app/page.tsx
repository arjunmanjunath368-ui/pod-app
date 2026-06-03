import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { weekStartUtc } from "@/lib/week";
import { activityMeta, type ActivityKey } from "@/lib/activities";
import BottomNav from "@/components/BottomNav";
import InviteButton from "@/components/InviteButton";

export default async function Home({
  searchParams,
}: {
  searchParams: { pod?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // First-run: make sure the person has chosen a display name (not the email default)
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

  // Which pods am I in?
  const { data: memberships } = await supabase
    .from("pod_members")
    .select(
      "pod_id, pods(id, name, invite_code, max_members, timezone, week_starts_on)"
    )
    .eq("user_id", user.id)
    .neq("status", "left");

  if (!memberships || memberships.length === 0) redirect("/app/start");

  const podsList = memberships
    .map((m: any) => (Array.isArray(m.pods) ? m.pods[0] : m.pods))
    .filter(Boolean);
  const current =
    podsList.find((p: any) => p.id === searchParams.pod) ?? podsList[0];
  const podId = current.id as string;

  // Members of the current pod (with their goal + profile)
  const { data: members } = await supabase
    .from("pod_members")
    .select(
      "user_id, role, status, goal_activity, goal_label, goal_target_per_week, goal_detail, profiles(display_name, initials, avatar_color)"
    )
    .eq("pod_id", podId)
    .neq("status", "left");

  // This week's sessions for the pod
  const weekStart = weekStartUtc(
    current.timezone ?? "America/Chicago",
    current.week_starts_on ?? 1
  );
  const { data: sessions } = await supabase
    .from("sessions")
    .select("user_id, logged_at")
    .eq("pod_id", podId)
    .gte("logged_at", weekStart.toISOString());

  const counts: Record<string, number> = {};
  (sessions ?? []).forEach((s: any) => {
    counts[s.user_id] = (counts[s.user_id] ?? 0) + 1;
  });

  const rows = (members ?? [])
    .filter((m: any) => m.status === "active")
    .map((m: any) => {
      const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const target = m.goal_target_per_week ?? 0;
      const done = counts[m.user_id] ?? 0;
      const hasGoal = !!m.goal_target_per_week;
      const ratio = hasGoal ? Math.min(done / target, 1) : 0;
      return {
        userId: m.user_id,
        name: prof?.display_name ?? "Member",
        initials: prof?.initials ?? "?",
        color: prof?.avatar_color ?? "#c8553d",
        activity: m.goal_activity as ActivityKey | null,
        label: m.goal_label as string | null,
        target,
        detail: m.goal_detail as string | null,
        done,
        hasGoal,
        ratio,
        isMe: m.user_id === user.id,
      };
    })
    // put me first
    .sort((a: any, b: any) => (a.isMe === b.isMe ? 0 : a.isMe ? -1 : 1));

  const goalRows = rows.filter((r: any) => r.hasGoal);
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
      ? "Everyone's hit their goal this week 🎉"
      : `${totalRemaining} ${
          totalRemaining === 1 ? "session" : "sessions"
        } to go to hit every goal.`;

  const me = rows.find((r: any) => r.isMe);
  const myDefaultActivity = (me?.activity ?? "strength") as ActivityKey;

  return (
    <>
      <main className="flex-1 overflow-y-auto px-5 pb-28 pt-8">
        {/* Pod header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Your pod
            </div>
            <h1 className="font-serif text-[27px] font-semibold leading-tight text-ink">
              {current.name}
            </h1>
          </div>
          <div className="pt-1">
            <InviteButton code={current.invite_code} podName={current.name} />
          </div>
        </div>

        {/* Set-your-goal prompt */}
        {me && !me.hasGoal && (
          <Link
            href={`/app/goal?pod=${podId}`}
            className="mt-5 block rounded-2xl border border-terra bg-terra/[0.06] p-4"
          >
            <div className="text-[14px] font-semibold text-ink">
              Set your weekly goal →
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted">
              Pick how many times you'll show up each week. Until you do, you're
              not in the count.
            </div>
          </Link>
        )}

        {/* Pod consistency card */}
        <div className="mt-5 rounded-3xl bg-ink p-6 text-paper shadow-pod-lg">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sage-soft">
              This week
            </div>
            <div className="text-[11px] text-sage-soft">
              {goalRows.length} of {rows.length} have goals set
            </div>
          </div>

          {goalRows.length > 0 ? (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-serif text-[52px] font-semibold leading-none text-paper">
                  {podPct}%
                </span>
                <span className="text-[13px] text-sage-soft">
                  of goals hit
                </span>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#4ADE80] to-[#60A5FA]"
                  style={{ width: `${podPct}%` }}
                />
              </div>
              <div className="mt-3 text-[12.5px] font-semibold text-gold">
                {remainingLabel}
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-sage-soft">
                It's not about who does the most. The pod rises when everyone
                shows up to their own goal.
              </p>
            </>
          ) : (
            <p className="mt-3 text-[13.5px] leading-relaxed text-sage-soft">
              Once people set their weekly goals, you'll see how the pod is
              tracking together here.
            </p>
          )}
        </div>

        {/* Member rows */}
        <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          The pod
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          {rows.map((r: any) => {
            const meta = activityMeta(r.activity);
            return (
              <div
                key={r.userId}
                className="rounded-2xl border border-line bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-semibold text-ink">
                        {r.name}
                      </span>
                      {r.isMe && (
                        <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[10px] font-semibold text-muted">
                          you
                        </span>
                      )}
                    </div>
                    {r.hasGoal ? (
                      <div className="mt-0.5 text-[12.5px] text-muted">
                        {meta.emoji} {r.label ?? meta.label} · {r.target}×/week
                        {r.detail ? ` · ${r.detail}` : ""}
                      </div>
                    ) : r.isMe ? (
                      <Link
                        href={`/app/goal?pod=${podId}`}
                        className="mt-0.5 inline-block text-[12.5px] font-semibold text-terra"
                      >
                        Set your goal →
                      </Link>
                    ) : (
                      <div className="mt-0.5 text-[12.5px] text-muted">
                        Getting set up…
                      </div>
                    )}
                  </div>
                  {r.hasGoal && (
                    <div className="text-right">
                      <div className="font-serif text-[18px] font-semibold text-ink">
                        {r.done}
                        <span className="text-[13px] text-muted">
                          /{r.target}
                        </span>
                      </div>
                      <div className="text-[10.5px] uppercase tracking-wide text-muted">
                        this week
                      </div>
                    </div>
                  )}
                </div>
                {r.hasGoal && (
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(r.ratio * 100)}%`,
                        backgroundColor: r.ratio >= 1 ? "#7a9471" : "#c8553d",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pod switcher (only if in more than one) */}
        {podsList.length > 1 && (
          <div className="mt-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Switch pod
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {podsList.map((p: any) => (
                <Link
                  key={p.id}
                  href={`/app?pod=${p.id}`}
                  className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
                    p.id === podId
                      ? "bg-ink text-paper"
                      : "border border-line bg-card text-ink-soft"
                  }`}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav
        active="home"
        podId={podId}
        userId={user.id}
        defaultActivity={myDefaultActivity}
      />
    </>
  );
}
