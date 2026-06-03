import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activityMeta, type ActivityKey } from "@/lib/activities";
import BottomNav from "@/components/BottomNav";
import SignOutButton from "@/components/SignOutButton";
import { BRAND_NAME, BRAND_MARK } from "@/lib/brand";

export default async function YouPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, initials, avatar_color")
    .eq("id", user.id)
    .maybeSingle();

  const { data: memberships } = await supabase
    .from("pod_members")
    .select(
      "pod_id, goal_activity, goal_label, goal_target_per_week, goal_detail, pods(id, name)"
    )
    .eq("user_id", user.id)
    .neq("status", "left");

  const pods = (memberships ?? []).map((m: any) => {
    const pod = Array.isArray(m.pods) ? m.pods[0] : m.pods;
    return {
      podId: m.pod_id as string,
      name: pod?.name ?? "Pod",
      activity: m.goal_activity as ActivityKey | null,
      label: m.goal_label as string | null,
      target: m.goal_target_per_week as number | null,
      detail: m.goal_detail as string | null,
    };
  });

  const firstPod = pods[0];

  return (
    <>
      <main className="flex-1 overflow-y-auto px-5 pb-28 pt-9">
        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-semibold text-white"
            style={{ backgroundColor: profile?.avatar_color ?? "#c8553d" }}
          >
            {profile?.initials ?? "?"}
          </div>
          <div>
            <h1 className="font-serif text-[24px] font-semibold leading-tight text-ink">
              {profile?.display_name ?? "You"}
            </h1>
            <div className="text-[12.5px] text-muted">
              {BRAND_MARK} {BRAND_NAME} member
            </div>
          </div>
        </div>

        <div className="mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Your weekly commitments
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
                  <div className="text-[15px] font-semibold text-ink">
                    {p.name}
                  </div>
                  <Link
                    href={`/app/goal?pod=${p.podId}`}
                    className="text-[12.5px] font-semibold text-terra"
                  >
                    {p.target ? "Edit" : "Set goal"}
                  </Link>
                </div>
                <div className="mt-1 text-[12.5px] text-muted">
                  {p.target
                    ? `${meta.emoji} ${p.label ?? meta.label} · ${p.target}×/week${
                        p.detail ? ` · ${p.detail}` : ""
                      }`
                    : "No weekly goal set yet"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Link
            href="/app/start/join"
            className="text-[13px] font-semibold text-terra"
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
