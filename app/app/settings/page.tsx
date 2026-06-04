import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import PodSettings from "@/components/PodSettings";
import SignOutButton from "@/components/SignOutButton";
import NotificationToggle from "@/components/NotificationToggle";
import { BRAND_NAME } from "@/lib/brand";

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
    .select("pod_id, status, pods(id, name)")
    .eq("user_id", user.id)
    .neq("status", "left");

  if (!memberships || memberships.length === 0) redirect("/app/start");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const displayName = profile?.display_name ?? "You";

  const rows = memberships.map((m: any) => ({
    podId: m.pod_id as string,
    status: m.status as string,
    name: (Array.isArray(m.pods) ? m.pods[0] : m.pods)?.name ?? "Pod",
  }));
  const current = rows.find((r) => r.podId === searchParams.pod) ?? rows[0];

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
        />

        <div className="mt-4">
          <NotificationToggle userId={user.id} />
        </div>

        {/* How it works */}
        <div className="mt-7 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
          How {BRAND_NAME} works
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-card p-4 text-[15px] leading-relaxed text-ink-soft">
          <p>
            Everyone sets their own weekly goal — how many times they'll show
            up. You're scored together on consistency, not on who does the most.
          </p>
          <p className="mt-2.5">
            Hit your number any days you like; the order doesn't matter. A week
            you complete is a streak of one — string them together to build your
            run.
          </p>
          <p className="mt-2.5">
            A <b className="text-ink">perfect week</b> is when everyone hits
            their goal. Consecutive perfect weeks build the pod's streak — so
            one person slacking shows. Pausing protects the streak when life
            gets in the way.
          </p>
        </div>

        <div className="mt-7 flex justify-end">
          <SignOutButton />
        </div>
      </main>

      <BottomNav active="settings" podId={current.podId} userId={user.id} />
    </>
  );
}
