import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/timeago";
import { type ActivityKey } from "@/lib/activities";
import BottomNav from "@/components/BottomNav";
import Feed, { type FeedItem } from "@/components/Feed";

type Kind = "clap" | "fire" | "heart";

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
    .select("pod_id, pods(id, name)")
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
      "id, user_id, activity, note, photo_url, logged_at, profiles(display_name, initials, avatar_color)"
    )
    .eq("pod_id", podId)
    .order("logged_at", { ascending: false })
    .limit(50);

  const ids = (sessions ?? []).map((s: any) => s.id);
  const { data: reactions } = await supabase
    .from("reactions")
    .select("session_id, user_id, kind")
    .in("session_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const now = new Date();
  const items: FeedItem[] = (sessions ?? []).map((s: any) => {
    const prof = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    const counts: Record<Kind, number> = { clap: 0, fire: 0, heart: 0 };
    const mine: Record<Kind, boolean> = {
      clap: false,
      fire: false,
      heart: false,
    };
    (reactions ?? [])
      .filter((r: any) => r.session_id === s.id)
      .forEach((r: any) => {
        const k = r.kind as Kind;
        counts[k] = (counts[k] ?? 0) + 1;
        if (r.user_id === user.id) mine[k] = true;
      });
    return {
      id: s.id,
      authorName: prof?.display_name ?? "Member",
      initials: prof?.initials ?? "?",
      color: prof?.avatar_color ?? "#c8553d",
      activity: (s.activity as ActivityKey) ?? "other",
      note: s.note,
      photoUrl: s.photo_url,
      timeLabel: timeAgo(new Date(s.logged_at), now),
      isMine: s.user_id === user.id,
      counts,
      mine,
    };
  });

  return (
    <>
      <main className="flex-1 overflow-y-auto px-5 pb-28 pt-9">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
          The pod
        </div>
        <h1 className="mb-5 font-serif text-[26px] font-semibold leading-tight text-ink">
          {current.name}
        </h1>
        <Feed items={items} userId={user.id} />
      </main>

      <BottomNav active="pod" podId={podId} userId={user.id} />
    </>
  );
}
