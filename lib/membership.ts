import { dayKeyInTz } from "./days";
import { weekStartUtc } from "./week";

// Which of a member's pods a synced or logged activity belongs to.
//
//  - Only pods they had already joined when the activity happened. Connecting
//    WHOOP pulls in the last week of workouts, and a workout from before you
//    joined a pod is not something that pod saw you do.
//  - Active pods, plus pods Pod paused automatically after 7 quiet days. Any new
//    activity brings an auto-paused member straight back (resumeAutoPaused).

export type SyncTarget = {
  podId: string;
  joinedAt: number; // ms
  autoPaused: boolean;
};

export async function syncTargets(svc: any, userId: string): Promise<SyncTarget[]> {
  let rows: any[] | null = null;
  const full = await svc
    .from("pod_members")
    .select("pod_id, joined_at, status, auto_paused_at")
    .eq("user_id", userId)
    .in("status", ["active", "paused"]);
  if (!full.error) {
    rows = full.data;
  } else {
    // Before the auto-pause migration: active pods only, as before.
    const basic = await svc
      .from("pod_members")
      .select("pod_id, joined_at, status")
      .eq("user_id", userId)
      .eq("status", "active");
    rows = basic.data;
  }
  return ((rows ?? []) as any[])
    .filter((m) => m.status === "active" || !!m.auto_paused_at)
    .map((m) => ({
      podId: m.pod_id as string,
      joinedAt: m.joined_at ? new Date(m.joined_at).getTime() : 0,
      autoPaused: m.status === "paused" && !!m.auto_paused_at,
    }));
}

// Pods this activity belongs to: joined at or before it started.
export function podsForActivity(targets: SyncTarget[], startedAt: Date): SyncTarget[] {
  const t = startedAt.getTime();
  // A minute of slack so a workout started in the same minute as joining counts.
  return targets.filter((p) => p.joinedAt <= t + 60 * 1000);
}

// Bring auto-paused memberships back. Pods with stakes running pick the member
// up from next week, matching a manual resume.
export async function resumeAutoPaused(svc: any, userId: string, podIds: string[]) {
  if (!podIds.length) return;
  const { data: pods } = await svc
    .from("pods")
    .select("id, timezone, week_starts_on")
    .in("id", podIds);
  const { data: stakes } = await svc
    .from("pod_stakes")
    .select("pod_id")
    .in("pod_id", podIds)
    .eq("status", "active");
  const staked = new Set(((stakes ?? []) as any[]).map((s) => s.pod_id));
  for (const p of (pods ?? []) as any[]) {
    let stakedFrom: string | null = null;
    if (staked.has(p.id)) {
      const tz = p.timezone ?? "UTC";
      const ws = weekStartUtc(tz, p.week_starts_on ?? 1);
      stakedFrom = dayKeyInTz(new Date(ws.getTime() + 7 * 86400000), tz);
    }
    await svc
      .from("pod_members")
      .update({ status: "active", auto_paused_at: null, pause_until: null, staked_from: stakedFrom })
      .eq("pod_id", p.id)
      .eq("user_id", userId)
      .not("auto_paused_at", "is", null);
  }
}
