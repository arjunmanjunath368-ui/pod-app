import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import SignOutButton from "@/components/SignOutButton";
import NotificationToggle from "@/components/NotificationToggle";
import { BRAND_NAME } from "@/lib/brand";
import WalkthroughCards, { type WalkCard } from "@/components/WalkthroughCards";

const ABOUT_CARDS: WalkCard[] = [
  {
    emoji: "🫛",
    title: "What a pod is",
    body: "A handful of people you trust, each chasing their own goal and keeping each other honest, week to week. No randoms, no global leaderboard.",
  },
  {
    emoji: "🎯",
    title: "Different goals, same game",
    body: "Your goal is yours alone — nobody's ranked on who lifts more or runs farther. You're measured on one thing: showing up.",
  },
  {
    emoji: "🔥",
    title: "Streaks & perfect weeks",
    body: "Hit your number on whatever days you like — order doesn't matter. When everyone hits theirs, that's a perfect week, and perfect weeks build the pod's streak.",
  },
  {
    emoji: "💪",
    title: "Cheer, nudge, challenge",
    body: "Cheer the wins. Nudge the no-shows. Short on time? Send a teammate a quick challenge — it clears the moment they show up. Keeping each other going is the whole point.",
  },
];

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Account settings aren't pod-scoped, but the bottom nav still needs a pod
  // for its other tabs.
  const { data: memberships } = await supabase
    .from("pod_members")
    .select("pod_id")
    .eq("user_id", user.id)
    .neq("status", "left")
    .limit(1);
  if (!memberships || memberships.length === 0) redirect("/app/start");
  const navPodId = memberships[0].pod_id as string;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const displayName = profile?.display_name ?? "You";

  return (
    <>
      <main className="px-5 pb-28 pt-9">
        <h1 className="mb-5 font-serif text-[26px] font-semibold leading-tight text-ink">
          Settings
        </h1>

        {/* Display name (account-level) */}
        <div className="rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink">
                Display name
              </div>
              <div className="mt-0.5 truncate text-[16px] text-ink-soft">
                {displayName}
              </div>
              <p className="mt-0.5 text-[13px] text-muted">
                How your pods see you.
              </p>
            </div>
            <Link
              href={`/app/welcome?from=settings&pod=${navPodId}`}
              className="shrink-0 text-[13px] font-semibold text-terra"
            >
              Edit
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <NotificationToggle userId={user.id} />
        </div>

        {/* How it works */}
        <div className="mt-7 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
          How {BRAND_NAME} works
        </div>
        <div className="mt-3">
          <WalkthroughCards cards={ABOUT_CARDS} />
        </div>

        <div className="mt-8">
          <SignOutButton />
        </div>
      </main>

      <BottomNav active="settings" podId={navPodId} userId={user.id} />
    </>
  );
}
