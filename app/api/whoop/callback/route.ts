import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCode,
  fetchWhoopUserId,
  syncRecentWorkouts,
  whoopConfig,
} from "@/lib/whoop";
import { buildDeps, getServiceClient, saveNewConnection } from "@/lib/whoopStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  // Every exit clears the one-shot OAuth cookie and returns to Settings with a
  // short flag the panel turns into a message.
  const done = (flag: string) => {
    const r = NextResponse.redirect(
      new URL(`/app/settings?whoop=${flag}`, url.origin)
    );
    r.cookies.set("whoop_oauth", "", { maxAge: 0, path: "/api/whoop" });
    return r;
  };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url.origin));

  const cfg = whoopConfig();
  const svc = getServiceClient();
  if (!cfg || !svc) return done("unavailable");

  if (url.searchParams.get("error")) return done("denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const parts = (cookies().get("whoop_oauth")?.value ?? "").split(".");
  const cookieState = parts[0];
  const cookieUser = parts[1];
  const consentMs = Number(parts[2]);
  const age = Date.now() - consentMs;
  if (
    !code ||
    !state ||
    !cookieState ||
    state !== cookieState ||
    cookieUser !== user.id ||
    !(age >= 0 && age < 15 * 60 * 1000)
  ) {
    return done("error");
  }

  try {
    const tokens = await exchangeCode(
      cfg,
      code,
      `${url.origin}/api/whoop/callback`
    );
    // Without a refresh token we couldn't stay connected past an hour; and if
    // WHOOP reports scopes, workouts must be among them.
    if (!tokens.refreshToken) return done("error");
    if (tokens.scope && tokens.scope.split(" ").indexOf("read:workout") === -1) {
      return done("error");
    }

    const whoopUserId = await fetchWhoopUserId(tokens.accessToken);
    if (!whoopUserId) return done("error");

    const saved = await saveNewConnection(svc, cfg.clientSecret, {
      userId: user.id,
      whoopUserId,
      tokens,
      consentAt: new Date(consentMs),
    });
    if (saved.linkedElsewhere) return done("linked");
    if (!saved.ok) return done("error");

    // Pull the last week so a member who connects mid-week is credited
    // right away. Best-effort: the daily reconcile will catch up if it fails.
    try {
      await syncRecentWorkouts(buildDeps(svc, cfg), svc, user.id, 7);
    } catch {
      /* non-fatal */
    }
    return done("connected");
  } catch {
    return done("error");
  }
}
