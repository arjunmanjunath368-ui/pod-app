import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { whoopCall, whoopConfig } from "@/lib/whoop";
import { buildDeps, getServiceClient, removeConnection } from "@/lib/whoopStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A member must always be able to switch this off. Order matters: revoke at
// WHOOP first (that also stops their webhooks), then delete our copy of the
// tokens. Local deletion happens even if WHOOP's revoke call fails — the
// member can also revoke from inside the WHOOP app.
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  let removeWorkouts = false;
  try {
    const body = await req.json();
    removeWorkouts = !!body?.removeWorkouts;
  } catch {
    /* no body: keep the logs */
  }

  const cfg = whoopConfig();
  if (cfg) {
    try {
      await whoopCall(buildDeps(svc, cfg), user.id, "DELETE", "/v2/user/access");
    } catch {
      /* best-effort */
    }
  }

  await removeConnection(svc, user.id);

  if (removeWorkouts) {
    await svc
      .from("sessions")
      .delete()
      .eq("user_id", user.id)
      .eq("source", "whoop");
  }
  return NextResponse.json({ ok: true, removedWorkouts: removeWorkouts });
}
