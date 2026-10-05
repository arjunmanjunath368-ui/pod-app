import { createHmac, timingSafeEqual } from "crypto";
import { workoutToSessionFields, type WhoopWorkoutLike } from "./whoopMap";

// All endpoints and formats below were checked against WHOOP's developer docs
// (OAuth 2.0, Webhooks, Workout API v2) rather than assumed.
export const WHOOP_API = "https://api.prod.whoop.com/developer";
export const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
// offline = refresh token; read:workout = the workouts; read:profile is only
// used to learn the member's WHOOP user id (webhooks identify people by it).
// We never store their name or email.
export const WHOOP_SCOPES = "offline read:workout read:profile";

export type WhoopConfig = { clientId: string; clientSecret: string };

export function whoopConfig(): WhoopConfig | null {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function buildAuthorizeUrl(
  cfg: WhoopConfig,
  redirectUri: string,
  state: string
): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    scope: WHOOP_SCOPES,
    state,
  });
  return `${WHOOP_AUTH_URL}?${p.toString()}`;
}

// base64(HMAC-SHA256(timestamp + rawBody, clientSecret)) per WHOOP's docs. The
// raw body must be exactly what arrived — re-serialising parsed JSON would
// change it and break the match.
export function verifyWebhookSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string
): boolean {
  if (!timestamp || !signature) return false;
  const expected = createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---------- Tokens ----------

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
};

function authError(status: number, code: string): Error {
  const e: any = new Error(`WHOOP token request failed (${status} ${code})`);
  e.whoopAuth = true;
  e.status = status;
  e.code = code;
  return e;
}

// 400/401 from the token endpoint = WHOOP rejected the credential (revoked,
// already rotated, expired). Anything else (network, 5xx) is transient.
function isRejected(e: any): boolean {
  return !!e && e.whoopAuth === true && (e.status === 400 || e.status === 401);
}

async function tokenRequest(
  params: Record<string, string>,
  fetchFn: typeof fetch
): Promise<TokenSet> {
  const res = await fetchFn(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok || !json || !json.access_token) {
    throw authError(res.status, String(json?.error ?? "token_error"));
  }
  return {
    accessToken: String(json.access_token),
    refreshToken: String(json.refresh_token ?? ""),
    expiresAt: new Date(Date.now() + (Number(json.expires_in) || 3600) * 1000),
    scope: String(json.scope ?? ""),
  };
}

export function exchangeCode(
  cfg: WhoopConfig,
  code: string,
  redirectUri: string,
  fetchFn: typeof fetch = fetch
): Promise<TokenSet> {
  return tokenRequest(
    {
      grant_type: "authorization_code",
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirectUri,
    },
    fetchFn
  );
}

export function refreshTokens(
  cfg: WhoopConfig,
  refreshToken: string,
  fetchFn: typeof fetch = fetch
): Promise<TokenSet> {
  return tokenRequest(
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: "offline",
    },
    fetchFn
  );
}

export type StoredConn = {
  userId: string;
  whoopUserId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

export interface TokenStore {
  load(userId: string): Promise<StoredConn | null>;
  // Writes only if the stored refresh token is still `prevRefreshToken`.
  // Returns whether it wrote.
  saveIfUnchanged(
    userId: string,
    prevRefreshToken: string,
    next: { accessToken: string; refreshToken: string; expiresAt: Date }
  ): Promise<boolean>;
  markError(userId: string, message: string | null): Promise<void>;
  markSynced(userId: string): Promise<void>;
}

export type WhoopDeps = {
  cfg: WhoopConfig;
  store: TokenStore;
  fetchFn: typeof fetch;
  sleep: (ms: number) => Promise<void>;
};

export const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// Refresh, and persist the rotated pair. WHOOP invalidates the old refresh
// token the moment it's used, and when two requests refresh at once only the
// first wins. So a rejection is NOT proof the member disconnected — the winner
// may simply not have saved yet. Look again before declaring the link dead.
async function refreshAndSave(
  deps: WhoopDeps,
  conn: StoredConn
): Promise<string | null> {
  const { cfg, store, fetchFn, sleep } = deps;
  try {
    const t = await refreshTokens(cfg, conn.refreshToken, fetchFn);
    const wrote = await store.saveIfUnchanged(conn.userId, conn.refreshToken, t);
    if (wrote) {
      await store.markError(conn.userId, null);
      return t.accessToken;
    }
    const fresh = await store.load(conn.userId);
    return fresh ? fresh.accessToken : null;
  } catch (e) {
    if (!isRejected(e)) throw e; // transient: caller should retry later
    for (let i = 0; i < 3; i++) {
      await sleep(400);
      const fresh = await store.load(conn.userId);
      if (fresh && fresh.refreshToken !== conn.refreshToken) {
        return fresh.accessToken;
      }
    }
    await store.markError(
      conn.userId,
      "WHOOP no longer accepts this connection — reconnect needed"
    );
    return null;
  }
}

async function getAccessToken(
  deps: WhoopDeps,
  userId: string
): Promise<string | null> {
  const conn = await deps.store.load(userId);
  if (!conn) return null;
  if (conn.expiresAt.getTime() - Date.now() > 60 * 1000) return conn.accessToken;
  return refreshAndSave(deps, conn);
}

export type ApiResult = { status: number; json: any };

async function callOnce(
  deps: WhoopDeps,
  token: string,
  method: string,
  path: string
): Promise<ApiResult> {
  const res = await deps.fetchFn(`${WHOOP_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty body, e.g. 204 */
  }
  return { status: res.status, json };
}

// One authenticated call. A 401 usually means a concurrent refresh already
// replaced the token we were holding, so reload once (or refresh) and retry.
// Returns null when the member has no usable connection.
export async function whoopCall(
  deps: WhoopDeps,
  userId: string,
  method: string,
  path: string
): Promise<ApiResult | null> {
  let token = await getAccessToken(deps, userId);
  if (!token) return null;
  let r = await callOnce(deps, token, method, path);
  if (r.status === 401) {
    const conn = await deps.store.load(userId);
    if (!conn) return null;
    token =
      conn.accessToken !== token
        ? conn.accessToken
        : await refreshAndSave(deps, conn);
    if (!token) return null;
    r = await callOnce(deps, token, method, path);
  }
  return r;
}

// ---------- Workouts -> Pod sessions ----------

export type SessionRow = {
  pod_id: string;
  user_id: string;
  activity: string;
  activities: string[];
  photo_url: null;
  logged_at: string;
  verified: false;
  source: "whoop";
  external_id: string;
  duration_seconds: number;
  calories: null;
  calories_units: null;
};

// Invariants worth keeping:
//  - verified is ALWAYS false: wearable data is never proof for stakes, and
//    WHOOP's terms are wary of anything wager-adjacent.
//  - `voided` is deliberately absent so a re-sent workout can't undo a void.
//  - calories stay null: WHOOP's own calculations aren't stored.
export function buildSessionRows(
  userId: string,
  podIds: string[],
  w: WhoopWorkoutLike
): SessionRow[] {
  const f = workoutToSessionFields(w);
  if (!f) return [];
  return podIds.map((podId) => ({
    pod_id: podId,
    user_id: userId,
    activity: f.activity,
    activities: [f.activity],
    photo_url: null,
    logged_at: f.loggedAt.toISOString(),
    verified: false,
    source: "whoop",
    external_id: f.externalId,
    duration_seconds: f.durationSeconds,
    calories: null,
    calories_units: null,
  }));
}

export async function upsertWorkoutForUser(
  svc: any,
  userId: string,
  w: WhoopWorkoutLike
): Promise<number> {
  if (!workoutToSessionFields(w)) return 0;
  const { data: mems } = await svc
    .from("pod_members")
    .select("pod_id")
    .eq("user_id", userId)
    .eq("status", "active");
  const podIds: string[] = (mems ?? []).map((m: any) => m.pod_id as string);
  if (podIds.length === 0) return 0;
  const rows = buildSessionRows(userId, podIds, w);
  // Default upsert = update on conflict, so WHOOP finishing its scoring (or
  // the member editing the workout) refreshes the row instead of freezing the
  // first version.
  const { error } = await svc
    .from("sessions")
    .upsert(rows, { onConflict: "pod_id,user_id,external_id" });
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function deleteWorkoutForUser(
  svc: any,
  userId: string,
  workoutId: string
): Promise<void> {
  const { error } = await svc
    .from("sessions")
    .delete()
    .eq("user_id", userId)
    .eq("source", "whoop")
    .eq("external_id", `whoop:${workoutId}`);
  if (error) throw new Error(error.message);
}

// Pulls the member's recent workouts and upserts them. Used right after
// connecting, and by the daily reconcile (WHOOP itself says webhooks can be
// missed and shouldn't be the only source of truth).
export async function syncRecentWorkouts(
  deps: WhoopDeps,
  svc: any,
  userId: string,
  days: number
): Promise<{ ok: boolean; workouts: number }> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  let next: string | null = null;
  let workouts = 0;
  for (let page = 0; page < 4; page++) {
    const path: string =
      `/v2/activity/workout?limit=25&start=${encodeURIComponent(since)}` +
      (next ? `&nextToken=${encodeURIComponent(next)}` : "");
    const r = await whoopCall(deps, userId, "GET", path);
    if (!r || r.status !== 200) return { ok: false, workouts };
    const records: any[] = Array.isArray(r.json?.records) ? r.json.records : [];
    for (const w of records) {
      if (await upsertWorkoutForUser(svc, userId, w)) workouts++;
    }
    next = r.json?.next_token ?? r.json?.nextToken ?? null;
    if (!next || records.length === 0) break;
  }
  await deps.store.markSynced(userId);
  return { ok: true, workouts };
}

// Learns the member's WHOOP user id (webhooks identify people by it). Used once,
// at connect time, before the connection exists in the store.
export async function fetchWhoopUserId(
  accessToken: string,
  fetchFn: typeof fetch = fetch
): Promise<number | null> {
  const res = await fetchFn(`${WHOOP_API}/v2/user/profile/basic`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) return null;
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  const id = Number(json?.user_id);
  return isFinite(id) && id > 0 ? id : null;
}
