import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/timeago";
import { type ActivityKey } from "@/lib/activities";
import BottomNav from "@/components/BottomNav";
import InviteButton from "@/components/InviteButton";
import LeavePodButton from "@/components/LeavePodButton";
import Feed, { type FeedItem, type FeedComment } from "@/components/Feed";
import RecentPhotos from "@/components/RecentPhotos";

export default async function PodFeed({
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
    .select("pod_id, pods(id, name, invite_code, timezone)")
    .eq("user_id", user.id)
    .neq("status", "left");

  if (!memberships || memberships.length === 0) redirect("/app/start");

  const podsList = memberships
    .map((m: any) => (Array.isArray(m.pods) ? m.pods[0] : m.pods))
    .filter(Boolean);
  const current =
    podsList.find((p: any) => p.id === searchParams.pod) ?? podsList[0];
  const podId = current.id as string;

  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "id, user_id, activity, activities, note, activity_notes, photo_url, logged_at, voided, source, duration_seconds, calories, calories_units, profiles(display_name, initials, avatar_color, avatar_url)"
    )
    .eq("pod_id", podId)
    .order("logged_at", { ascending: false })
    .limit(50);

  const ids = (sessions ?? []).map((s: any) => s.id);
  const noIds = ["00000000-0000-0000-0000-000000000000"];

  const { data: reactions } = await supabase
    .from("reactions")
    .select("session_id, user_id, kind")
    .in("session_id", ids.length ? ids : noIds);

  const { data: comments } = await supabase
    .from("comments")
    .select("id, session_id, user_id, body, created_at")
    .in("session_id", ids.length ? ids : noIds)
    .order("created_at", { ascending: true });

  // Active stake window — staked logs (logged on/after the period start) can be
  // flagged for re-verification by pod-mates.
  const { data: activeStake } = await supabase
    .from("pod_stakes")
    .select("period_start, status")
    .eq("pod_id", podId)
    .eq("status", "active")
    .maybeSingle();
  const stakePeriodStart = activeStake?.period_start
    ? new Date(activeStake.period_start as string)
    : null;

  // Flags on the visible sessions (drives the disputed UI).
  const { data: flagRows } = await supabase
    .from("session_flags")
    .select("session_id, flagger_id")
    .in("session_id", ids.length ? ids : noIds);
  const flagsBySession: Record<string, string[]> = {};
  (flagRows ?? []).forEach((f: any) => {
    (flagsBySession[f.session_id] ??= []).push(f.flagger_id);
  });

  // Profiles for commenters + flaggers
  const flaggerIds = Object.values(flagsBySession).reduce(
    (acc: string[], arr) => acc.concat(arr),
    [] as string[]
  );
  const commenterIds = Array.from(
    new Set(
      (comments ?? []).map((c: any) => c.user_id as string).concat(flaggerIds)
    )
  );
  const cprofMap: Record<string, any> = {};
  if (commenterIds.length) {
    const { data: cprofs } = await supabase
      .from("profiles")
      .select("id, display_name, initials, avatar_color, avatar_url")
      .in("id", commenterIds);
    (cprofs ?? []).forEach((p: any) => (cprofMap[p.id] = p));
  }

  // My profile (for optimistic comment rendering)
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("display_name, initials, avatar_color, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const me = {
    userId: user.id,
    name: myProfile?.display_name ?? "You",
    initials: myProfile?.initials ?? "?",
    color: myProfile?.avatar_color ?? "#c8553d",
    avatarUrl: myProfile?.avatar_url ?? null,
  };

  const now = new Date();
  const items: FeedItem[] = (sessions ?? []).map((s: any) => {
    const prof = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    const counts: Record<string, number> = {};
    const mine: Record<string, boolean> = {};
    (reactions ?? [])
      .filter((r: any) => r.session_id === s.id)
      .forEach((r: any) => {
        counts[r.kind] = (counts[r.kind] ?? 0) + 1;
        if (r.user_id === user.id) mine[r.kind] = true;
      });

    const cmts: FeedComment[] = (comments ?? [])
      .filter((c: any) => c.session_id === s.id)
      .map((c: any) => {
        const p = cprofMap[c.user_id];
        return {
          id: c.id,
          name: p?.display_name ?? "Member",
          initials: p?.initials ?? "?",
          color: p?.avatar_color ?? "#c8553d",
          avatarUrl: p?.avatar_url ?? null,
          body: c.body,
          timeLabel: timeAgo(new Date(c.created_at), now),
          isMine: c.user_id === user.id,
        };
      });

    const sFlaggerIds: string[] = flagsBySession[s.id] ?? [];
    const flaggers = sFlaggerIds.map(
      (id: string) => cprofMap[id]?.display_name ?? "Member"
    );
    const staked =
      !!stakePeriodStart && new Date(s.logged_at) >= stakePeriodStart;

    return {
      id: s.id,
      authorUserId: s.user_id as string,
      authorName: prof?.display_name ?? "Member",
      initials: prof?.initials ?? "?",
      color: prof?.avatar_color ?? "#c8553d",
      avatarUrl: prof?.avatar_url ?? null,
      activity: (s.activity as ActivityKey) ?? "other",
      activities:
        Array.isArray(s.activities) && s.activities.length
          ? (s.activities as string[])
          : [s.activity ?? "other"],
      note: s.note,
      activityNotes: (s as any).activity_notes ?? null,
      photoUrl: s.photo_url,
      timeLabel: timeAgo(new Date(s.logged_at), now),
      // Absolute date too — a relative "3d ago" is useless for tracing progress
      // back through the photo history.
      dateLabel: new Date(s.logged_at).toLocaleString("en-US", {
        timeZone: (current as any)?.timezone ?? "UTC",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      isMine: s.user_id === user.id,
      counts,
      mine,
      comments: cmts,
      staked,
      voided: !!s.voided,
      flagCount: sFlaggerIds.length,
      flaggers,
      iFlagged: sFlaggerIds.includes(user.id),
      source: (s.source === "healthkit" ? "healthkit" : "manual") as
        | "manual"
        | "healthkit",
      durationSeconds: (s.duration_seconds as number | null) ?? null,
      calories: (s.calories as number | null) ?? null,
      caloriesUnits: (s.calories_units as string | null) ?? null,
    };
  });

  return (
    <>
      <main className="px-5 pb-28 pt-9">
        {podsList.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {podsList.map((p: any) => (
              <Link
                key={p.id}
                href={`/app/pod?pod=${p.id}`}
                className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                  p.id === podId
                    ? "border-terra bg-terra/[0.08] text-terra"
                    : "border-line bg-card text-muted"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
              My pods
            </div>
            <h1 className="truncate font-serif text-[26px] font-semibold leading-tight text-ink">
              {current.name}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3 pt-1">
            <InviteButton code={current.invite_code} podName={current.name} />
            <LeavePodButton
              podId={podId}
              userId={user.id}
              podName={current.name}
            />
          </div>
        </div>

        <div className="mt-5">
          <RecentPhotos items={items.filter((it) => it.photoUrl).slice(0, 6)} />
          <Feed items={items} me={me} podId={podId} />
        </div>
      </main>

      <BottomNav active="pod" podId={podId} userId={user.id} />
    </>
  );
}
