import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
  const toUserId: string | undefined = self ? user.id : body.toUserId;
  if (!toUserId) {
    return NextResponse.json({ error: "Missing recipient" }, { status: 400 });
  }

  // Authorize: self always allowed; otherwise must share a pod.
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

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", toUserId);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, note: "no-subscriptions" });
  }

  const payload = JSON.stringify({
    title: body.title || "Pod",
    body:
      body.body ||
      (self ? "Test notification — push is working 🎉" : "Your pod's waiting."),
    url: body.url || "/app",
  });

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
