import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import PodSettings from "@/components/PodSettings";
import SignOutButton from "@/components/SignOutButton";
import NotificationToggle from "@/components/NotificationToggle";
import { BRAND_NAME } from "@/lib/brand";
import { weekStartUtc } from "@/lib/week";
import { dayKeyInTz } from "@/lib/days";
import WalkthroughCards, { type WalkCard } from "@/components/WalkthroughCards";

const ABOUT_CARDS: WalkCard[] = [
  {
    emoji: "🫛",
    title: "What a pod is",
    body: "A handful of people you trust, each working toward their own goal and keeping each other honest, week to week.",
  },
  {
    emoji: "🎯",
    title: "Different goals, same game",
    body: "Your goal is yours alone — nobody's ranked on who lifts more or runs farther. You're measured only on showing up.",
  },
  {
    emoji: "🔥",
    title: "Streaks & perfect weeks",
    body: "Hit your number on any days you like — order doesn't matter. When everyone hits theirs, that's a perfect week, and perfect weeks build the pod's streak.",
  },
  {
    emoji: "💪",
    title: "Nudges, cheers & stakes",
    body: "Quiet teammate? Send a nudge. Someone on fire? Cheer them on. Pausing protects the streak when life gets in the way — and the pod can add weekly stakes for extra fire.",
  },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { pod?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("pod_members")
    .select("pod_id, status, pause_until, pods(id, name, timezone, week_starts_on)")
    .eq("user_id", user.id)
    .neq("status", "left");

  if (!memberships || memberships.length === 0) redirect("/app/start");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const displayName = profile?.display_name ?? "You";

  const rows = memberships.map((m: any) => {
    const pod = Array.isArray(m.pods) ? m.pods[0] : m.pods;
    return {
      podId: m.pod_id as string,
      status: m.status as string,
      pauseUntil: (m.pause_until as string | null) ?? null,
      name: pod?.name ?? "Pod",
      tz: pod?.timezone ?? "UTC",
      wso: pod?.week_starts_on ?? 1,
    };
  });
  const current = rows.find((r) => r.podId === searchParams.pod) ?? rows[0];

  // Is a stakes period live? (drives the resume "join now vs. next Monday" choice)
  const { data: stakeRow } = await supabase
    .from("pod_stakes")
    .select("status")
    .eq("pod_id", current.podId)
    .maybeSingle();
  const stakesActive = stakeRow?.status === "active";

  const wsInstant = weekStartUtc(current.tz, current.wso);
  const currentWeekStart = dayKeyInTz(wsInstant, current.tz);
  const nextWeekStart = dayKeyInTz(
    new Date(wsInstant.getTime() + 7 * 86400000),
    current.tz
  );

  return (
    <>
      <main className="flex-1 overflow-y-auto px-5 pb-28 pt-9">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
          Settings · {current.name}
        </div>
        <h1 className="mb-5 font-serif text-[26px] font-semibold leading-tight text-ink">
          Settings
        </h1>

        <PodSettings
          podId={current.podId}
          userId={user.id}
          initialStatus={current.status}
          podName={current.name}
          displayName={displayName}
          stakesActive={stakesActive}
          currentWeekStart={currentWeekStart}
          nextWeekStart={nextWeekStart}
          initialPauseUntil={current.pauseUntil}
        />

        <div className="mt-4">
          <NotificationToggle userId={user.id} />
        </div>

        <a
          href={`/app/stakes?pod=${current.podId}`}
          className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-card p-4 transition active:scale-[0.99]"
        >
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-ink">Stakes</div>
            <p className="mt-1 text-[14px] text-muted">
              Put a number on the line each week.
            </p>
          </div>
          <span className="ml-3 text-muted">→</span>
        </a>

        {/* How it works */}
        <div className="mt-7 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
          How {BRAND_NAME} works
        </div>
        <div className="mt-3">
          <WalkthroughCards cards={ABOUT_CARDS} />
        </div>

        <div className="mt-7 flex justify-end">
          <SignOutButton />
        </div>
      </main>

      <BottomNav active="settings" podId={current.podId} userId={user.id} />
    </>
  );
}
