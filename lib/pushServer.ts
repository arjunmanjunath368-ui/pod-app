import webpush from "web-push";

// Server-side push, for code that runs without a signed-in sender (WHOOP
// webhooks, scheduled jobs). Returns how many devices accepted the message and
// prunes subscriptions the push service says are gone.

let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@podfitt.com";
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export async function pushToUsers(
  svc: any,
  userIds: string[],
  title: string,
  body: string,
  url = "/app"
): Promise<number> {
  if (!userIds.length || !pushConfigured()) return 0;
  const { data: subs } = await svc
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (!subs || subs.length === 0) return 0;
  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  await Promise.all(
    (subs as any[]).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { urgency: "high" }
        );
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await svc.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    })
  );
  return sent;
}
