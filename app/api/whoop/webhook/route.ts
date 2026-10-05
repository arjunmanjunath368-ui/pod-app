import { NextResponse } from "next/server";
import {
  deleteWorkoutForUser,
  upsertWorkoutForUser,
  verifyWebhookSignature,
  whoopCall,
  whoopConfig,
} from "@/lib/whoop";
import { buildDeps, findUserByWhoopId, getServiceClient } from "@/lib/whoopStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ok = (extra: Record<string, any> = {}) =>
  NextResponse.json({ ok: true, ...extra });

// WHOOP calls this when a workout is created, edited or deleted. It sends only
// the workout's id, so we fetch the workout itself. WHOOP retries any non-2xx
// five times over about an hour, so: 2xx for anything we deliberately ignore
// (so it stops retrying), 5xx only for failures worth retrying. Every write is
// idempotent, so a repeat delivery is harmless.
export async function POST(req: Request) {
  const cfg = whoopConfig();
  const svc = getServiceClient();
  if (!cfg || !svc) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  // The signature covers the exact bytes WHOOP sent, so read the raw text.
  const raw = await req.text();
  const valid = verifyWebhookSignature(
    raw,
    req.headers.get("x-whoop-signature-timestamp"),
    req.headers.get("x-whoop-signature"),
    cfg.clientSecret
  );
  if (!valid) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let evt: any;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const type = String(evt?.type ?? "");
  const workoutId = String(evt?.id ?? "");
  const whoopUserId = Number(evt?.user_id);

  // Sleep and recovery events also arrive here; Pod uses neither.
  if (
    (type !== "workout.updated" && type !== "workout.deleted") ||
    !workoutId ||
    !isFinite(whoopUserId)
  ) {
    return ok({ ignored: true });
  }

  try {
    const userId = await findUserByWhoopId(svc, whoopUserId);
    if (!userId) return ok({ ignored: "unknown member" });

    if (type === "workout.deleted") {
      await deleteWorkoutForUser(svc, userId, workoutId);
      return ok();
    }

    const r = await whoopCall(
      buildDeps(svc, cfg),
      userId,
      "GET",
      `/v2/activity/workout/${encodeURIComponent(workoutId)}`
    );
    // No usable connection: nothing to do now; the daily reconcile or the
    // member reconnecting will recover it.
    if (!r) return ok({ ignored: "no connection" });
    if (r.status === 404) {
      await deleteWorkoutForUser(svc, userId, workoutId);
      return ok();
    }
    if (r.status !== 200) {
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }
    await upsertWorkoutForUser(svc, userId, r.json);
    return ok();
  } catch {
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
