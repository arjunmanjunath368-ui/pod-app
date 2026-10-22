import { dayKeyInTz } from "./days";

// "Someone in your pod just showed up" — split by who still has to move today.
//
// Pod-mates who haven't been active today get the nudge that matters: it's
// your turn. Those who already showed up get a lighter "you're both in" note.
// Works with either a signed-in client (manual logs) or the service client
// (WHOOP syncs).

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function yourTurnMessage(name: string, label: string): string {
  return pick([
    `${name} just logged ${label}. Your turn to make it count 💪`,
    `${name} showed up today with ${label}. Your move 🔥`,
    `${name} got ${label} in. One activity from you keeps the pod on track.`,
  ]);
}

export function alsoInMessage(name: string, label: string): string {
  return pick([
    `${name} showed up too with ${label}. The pod's moving 🙌`,
    `${name} logged ${label}. You're both in today 🔥`,
  ]);
}

export type PodPingPlan = {
  podName: string;
  notYet: string[]; // recipients not active today
  already: string[]; // recipients already active today
  actorName: string;
};

export async function planPodPing(
  client: any,
  podId: string,
  actorId: string,
  now: Date = new Date()
): Promise<PodPingPlan | null> {
  const { data: pod } = await client
    .from("pods")
    .select("name, timezone")
    .eq("id", podId)
    .maybeSingle();
  const tz = pod?.timezone ?? "America/Chicago";
  const { data: members } = await client
    .from("pod_members")
    .select("user_id")
    .eq("pod_id", podId)
    .eq("status", "active");
  const ids: string[] = ((members ?? []) as any[]).map((m) => m.user_id);
  const recipients = ids.filter((id) => id !== actorId);
  if (!recipients.length) return null;

  const since = new Date(now.getTime() - 30 * 3600000).toISOString();
  const { data: recent } = await client
    .from("sessions")
    .select("user_id, logged_at")
    .eq("pod_id", podId)
    .in("user_id", recipients)
    .gte("logged_at", since);
  const todayKey = dayKeyInTz(now, tz);
  const activeToday = new Set(
    ((recent ?? []) as any[])
      .filter((s) => dayKeyInTz(new Date(s.logged_at), tz) === todayKey)
      .map((s) => s.user_id as string)
  );

  const { data: prof } = await client
    .from("profiles")
    .select("display_name")
    .eq("id", actorId)
    .maybeSingle();

  return {
    podName: pod?.name ?? "your pod",
    notYet: recipients.filter((id) => !activeToday.has(id)),
    already: recipients.filter((id) => activeToday.has(id)),
    actorName: (prof?.display_name ?? "Someone in your pod").split(/\s+/)[0],
  };
}
