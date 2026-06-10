import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAYS = 21; // nudge 3 weeks after the last entry for a best

type Row = {
  id: string;
  user_id: string;
  name: string;
  value: number;
  unit: string | null;
  higher_is_better: boolean;
  created_at: string;
  reminded_at: string | null;
};

function configurePush(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@podfitt.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

// Send one message to a single user's devices; prune dead subscriptions.
async function sendToUser(
  supabase: any,
  userId: string,
  title: string,
  body: string,
  url: string
): Promise<number> {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return 0;
  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { urgency: "high" }
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
  return sent;
}

export async function GET(req: Request) {
  // Only Vercel Cron (or someone holding the secret) may run this.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!configurePush()) {
    return NextResponse.json({ error: "Push not configured" }, { status: 500 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase service credentials missing" },
      { status: 500 }
    );
  }
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  // Pull bests whose entries are old enough to possibly qualify. We still need
  // every entry per (user,name) to know the record and the latest entry, so we
  // fetch by user/name and reason in code.
  const { data: rows, error } = await supabase
    .from("personal_bests")
    .select(
      "id, user_id, name, value, unit, higher_is_better, created_at, reminded_at"
    )
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by user + name; rows already sorted newest-first.
  const groups = new Map<string, Row[]>();
  for (const r of (rows ?? []) as Row[]) {
    const k = `${r.user_id}::${r.name}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }

  // Per user, collect bests where the LATEST entry is >= 21 days old and we
  // haven't nudged on it yet. (A newer entry would mean they beat/re-logged it,
  // and would itself be the latest with reminded_at NULL.)
  type Eligible = { name: string; record: number; unit: string | null };
  const byUser = new Map<string, Eligible[]>();
  const anchorIds: string[] = [];

  for (const list of Array.from(groups.values())) {
    const anchor = list[0]; // newest entry for this best
    if (anchor.reminded_at) continue;
    if (new Date(anchor.created_at) > cutoff) continue;

    // The current record value across all entries for this name.
    let record = anchor.value;
    for (const r of list) {
      if (anchor.higher_is_better) record = Math.max(record, r.value);
      else record = Math.min(record, r.value);
    }

    const arr = byUser.get(anchor.user_id) ?? [];
    arr.push({ name: anchor.name, record, unit: anchor.unit });
    byUser.set(anchor.user_id, arr);
    anchorIds.push(anchor.id);
  }

  let usersNotified = 0;
  let pushesSent = 0;

  for (const [userId, bests] of Array.from(byUser.entries())) {
    let title: string;
    let body: string;
    if (bests.length === 1) {
      const b = bests[0];
      const valueStr = `${b.record}${b.unit ? ` ${b.unit}` : ""}`;
      title = "🏆 Time to beat your best";
      body = `It's been 3 weeks since your “${b.name}” best (${valueStr}). Ready to push for a new high?`;
    } else {
      title = "🏆 Bests waiting to be beaten";
      body = `You've got ${bests.length} personal bests you haven't topped in a while. Ready to push for a new high?`;
    }
    const sent = await sendToUser(supabase, userId, title, body, "/app/you");
    if (sent > 0) usersNotified++;
    pushesSent += sent;
  }

  // Mark every qualifying best as nudged so it won't fire again for this entry.
  if (anchorIds.length) {
    await supabase
      .from("personal_bests")
      .update({ reminded_at: new Date().toISOString() })
      .in("id", anchorIds);
  }

  return NextResponse.json({
    ok: true,
    bestsMarked: anchorIds.length,
    usersNotified,
    pushesSent,
  });
}
