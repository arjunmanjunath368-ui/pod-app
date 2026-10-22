import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import SignOutButton from "@/components/SignOutButton";
import NotificationToggle from "@/components/NotificationToggle";
import { isAdminEmail } from "@/lib/admin";
import WhoopPanel from "@/components/WhoopPanel";
import { whoopConfig } from "@/lib/whoop";
import { getServiceClient } from "@/lib/whoopStore";
import MoveTimesPanel from "@/components/MoveTimesPanel";
import { cleanSlots } from "@/lib/moveSlots";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { whoop?: string };
}) {
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

  // Separate query on purpose: if the WHOOP migration hasn't been run yet this
  // one returns nothing, and the rest of Settings is unaffected.
  const { data: whoopStatus } = await supabase
    .from("profiles")
    .select("whoop_connected_at, whoop_status")
    .eq("id", user.id)
    .maybeSingle();
  // Its own query too, so Settings still loads before the rest-day migration.
  const { data: restRow } = await supabase
    .from("profiles")
    .select("rest_days_on")
    .eq("id", user.id)
    .maybeSingle();
  // Members who turned on rest days before sleep was added need to reconnect
  // once for WHOOP to share it.
  let needsSleep = false;
  if ((restRow as any)?.rest_days_on && (whoopStatus as any)?.whoop_connected_at) {
    const svc = getServiceClient();
    if (svc) {
      const { data: conn } = await svc
        .from("whoop_connections")
        .select("scopes")
        .eq("user_id", user.id)
        .maybeSingle();
      const scopes = String(conn?.scopes ?? "");
      needsSleep = !!scopes && scopes.split(" ").indexOf("read:sleep") === -1;
    }
  }
  // And move times, which need the Home v2 migration.
  const { data: slotRow, error: slotErr } = await supabase
    .from("profiles")
    .select("move_slots")
    .eq("id", user.id)
    .maybeSingle();

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

        <div className="mt-4">
          <MoveTimesPanel
            userId={user.id}
            initial={cleanSlots((slotRow as any)?.move_slots)}
            available={!slotErr}
          />
        </div>


        {whoopConfig() && (
          <div id="whoop" className="mt-4 scroll-mt-6">
            <WhoopPanel
              connected={!!(whoopStatus as any)?.whoop_connected_at}
              needsReconnect={(whoopStatus as any)?.whoop_status === "needs_reconnect"}
              restOn={!!(restRow as any)?.rest_days_on}
              needsSleep={needsSleep}
              flash={searchParams.whoop ?? null}
            />
          </div>
        )}

        <Link
          href="/app/demo"
          className="mt-7 flex items-center justify-between rounded-2xl border border-line bg-card p-4 active:scale-[0.99]"
        >
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-ink">✨ Demo pod</div>
            <div className="mt-0.5 text-[13px] text-muted">
              A full pod with simulated data, for showing Pod to someone.
            </div>
          </div>
          <span className="ml-3 shrink-0 text-[18px] text-muted" aria-hidden>
            ›
          </span>
        </Link>

        {isAdminEmail(user.email) && (
          <Link
            href="/app/admin"
            className="mt-3 block rounded-2xl border border-line bg-card p-4 text-[15px] font-semibold text-ink-soft active:scale-[0.99]"
          >
            📊 Pod health (admin)
          </Link>
        )}

        <Link
          href="/privacy"
          className="mt-4 block text-center text-[13px] font-semibold text-muted underline"
        >
          Privacy policy
        </Link>

        <div className="mt-8">
          <SignOutButton />
        </div>
      </main>

      <BottomNav active="settings" podId={navPodId} userId={user.id} />
    </>
  );
}
