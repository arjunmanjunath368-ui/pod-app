import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Votes needed to uphold a flag = a strict majority of the *other* members
// (everyone in the pod except the logger). 4-person pod -> 3 others -> 2 needed;
// 6-person -> 5 others -> 3; 3-person -> 2 others -> both. 2-person pods
// (others <= 1) can never auto-void — they need the logger to concede.
function majorityThreshold(others: number): number {
  return Math.floor(others / 2) + 1;
}

export async function POST(req: Request) {
  const server = createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}) as any);
  const action = body.action as string;
  const sessionId = body.sessionId as string;
  if (!sessionId || !["flag", "unflag", "concede"].includes(action)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 500 });
  }
  const svc = createServiceClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: sess } = await svc
    .from("sessions")
    .select("id, pod_id, user_id")
    .eq("id", sessionId)
    .single();
  if (!sess) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const loggerId = sess.user_id as string;
  const podId = sess.pod_id as string;

  // Caller must be an active member of the pod.
  const { data: mems } = await svc
    .from("pod_members")
    .select("user_id, status")
    .eq("pod_id", podId)
    .neq("status", "left");
  const memberIds = (mems ?? []).map((m: any) => m.user_id as string);
  if (!memberIds.includes(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // The logger concedes their own log -> voided.
  if (action === "concede") {
    if (user.id !== loggerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await svc.from("sessions").update({ voided: true }).eq("id", sessionId);
    return NextResponse.json({ ok: true, voided: true, conceded: true });
  }

  // Flag / unflag — only members other than the logger.
  if (user.id === loggerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (action === "flag") {
    await svc.from("session_flags").upsert(
      { session_id: sessionId, pod_id: podId, flagger_id: user.id },
      { onConflict: "session_id,flagger_id" }
    );
  } else {
    await svc
      .from("session_flags")
      .delete()
      .eq("session_id", sessionId)
      .eq("flagger_id", user.id);
  }

  // Recompute active flaggers among current members (excluding the logger).
  const { data: flags } = await svc
    .from("session_flags")
    .select("flagger_id")
    .eq("session_id", sessionId);
  const activeFlaggers = (flags ?? [])
    .map((f: any) => f.flagger_id as string)
    .filter((id: string) => id !== loggerId && memberIds.includes(id));
  const others = memberIds.filter((id) => id !== loggerId).length;
  const upheld =
    others >= 2 && activeFlaggers.length >= majorityThreshold(others);

  await svc.from("sessions").update({ voided: upheld }).eq("id", sessionId);

  return NextResponse.json({
    ok: true,
    voided: upheld,
    flagCount: activeFlaggers.length,
    disputed: activeFlaggers.length > 0,
  });
}
