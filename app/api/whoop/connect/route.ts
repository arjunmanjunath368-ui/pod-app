import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { buildAuthorizeUrl, whoopConfig } from "@/lib/whoop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Starts the connection. WHOOP's API terms forbid exposing a member's WHOOP
// data to other users without their explicit opt-in, and Pod shows synced
// workouts to a member's pod-mates — so this refuses to start unless the
// member ticked the consent box (the UI passes consent=1 only then).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (flag: string) =>
    NextResponse.redirect(new URL(`/app/settings?whoop=${flag}`, url.origin));

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url.origin));

  const cfg = whoopConfig();
  if (!cfg) return back("unavailable");
  if (url.searchParams.get("consent") !== "1") return back("consent");

  // CSRF guard: a random state, held in an httpOnly cookie, must come back
  // unchanged. The cookie also records who started this and when they
  // consented, which the callback stores.
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(
    buildAuthorizeUrl(cfg, `${url.origin}/api/whoop/callback`, state)
  );
  res.cookies.set("whoop_oauth", `${state}.${user.id}.${Date.now()}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/whoop",
    maxAge: 600,
  });
  return res;
}
