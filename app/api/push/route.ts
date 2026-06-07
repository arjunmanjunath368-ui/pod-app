import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function configure(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@podfitt.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

export async function POST(req: Request) {
  if (!configure()) {
    return NextResponse.json({ error: "Push not configured" }, { status: 500 });
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}) as any);
  const self = !!body.self;
  const podId: string | undefined = body.podId;

  let recipientIds: string[] = [];
  let title = body.title || "Pod";
  let message = body.body || "Your pod's waiting.";
  const url = body.url || "/app";

  if (self) {
    recipientIds = [user.id];
    message = body.body || "Test notification — push is working 🎉";
  } else if (podId) {
    // Broadcast to active pod-mates (everyone in the pod except the sender).
    const { data: members } = await supabase
      .from("pod_members")
      .select("user_id, status")
      .eq("pod_id", podId)
      .eq("status", "active");
    const ids = (members ?? []).map((m: any) => m.user_id);
    if (!ids.includes(user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    recipientIds = ids.filter((id: string) => id !== user.id);

    // Compose the message server-side with the sender's name.
    const { data: me } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const name = me?.display_name || "Someone in your pod";
    const label = body.activityLabel ? ` ${body.activityLabel}` : " a workout";
    message =
      body.body ||
      pick([
        `${name} just logged${label} — your move.`,
        `${name} showed up today. Your turn to make it count.`,
        `${name} got${label} in. The pod's rolling — hop in?`,
        `${name} just put in the work 💪 You in?`,
        `${name} checked in. A quick one keeps you in the game.`,
        `${name} trained today — even five honest minutes counts.`,
        `${name} logged${label}. Don't leave 'em out there solo.`,
        `${name} showed up. Future-you will thank you.`,
      ]);
  } else {
    const toUserId: string | undefined = body.toUserId;
    if (!toUserId) {
      return NextResponse.json({ error: "Missing recipient" }, { status: 400 });
    }
    if (toUserId !== user.id) {
      const { data: mine } = await supabase
        .from("pod_members")
        .select("pod_id")
        .eq("user_id", user.id);
      const { data: theirs } = await supabase
        .from("pod_members")
        .select("pod_id")
        .eq("user_id", toUserId);
      const mineSet = new Set((mine ?? []).map((r: any) => r.pod_id));
      const shared = (theirs ?? []).some((r: any) => mineSet.has(r.pod_id));
      if (!shared) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    recipientIds = [toUserId];
    if (body.kind === "nudge") {
      const from = body.fromName || "Someone in your pod";
      message = pick([
        `${from} nudged you 👋 Your pod's waiting.`,
        `${from} is rooting for you — time to show up?`,
        `${from} gave you a nudge. A small one today counts.`,
        `${from} says it's your turn.`,
        `${from} noticed you've been quiet — get one in?`,
      ]);
    }
  }

  if (recipientIds.length === 0) {
    return NextResponse.json({ sent: 0, note: "no-recipients" });
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", recipientIds);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, note: "no-subscriptions" });
  }

  const payload = JSON.stringify({ title, body: message, url });

  let sent = 0;
  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
        }
      }
    })
  );

  return NextResponse.json({ sent });
}
