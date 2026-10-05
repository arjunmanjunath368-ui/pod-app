import { createClient as createServiceClient } from "@supabase/supabase-js";
import { decryptJson, encryptJson, fingerprint } from "./whoopCrypto";
import {
  realSleep,
  syncRecentWorkouts,
  whoopConfig,
  type TokenSet,
  type TokenStore,
  type WhoopConfig,
  type WhoopDeps,
} from "./whoop";

// whoop_connections has row-level security on with NO policies, so only the
// service role can touch it — tokens are never readable from the browser.
export function getServiceClient(): any | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function setProfileStatus(
  svc: any,
  userId: string,
  status: "active" | "needs_reconnect" | null,
  connectedAt?: string | null
) {
  const patch: Record<string, any> = { whoop_status: status };
  if (connectedAt !== undefined) patch.whoop_connected_at = connectedAt;
  await svc.from("profiles").update(patch).eq("id", userId);
}

export function supabaseTokenStore(svc: any, secret: string): TokenStore {
  return {
    async load(userId) {
      const { data } = await svc
        .from("whoop_connections")
        .select("whoop_user_id, tokens_enc, expires_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (!data) return null;
      try {
        const t = decryptJson<{ accessToken: string; refreshToken: string }>(
          data.tokens_enc,
          secret
        );
        return {
          userId,
          whoopUserId: Number(data.whoop_user_id),
          accessToken: t.accessToken,
          refreshToken: t.refreshToken,
          expiresAt: new Date(data.expires_at),
        };
      } catch {
        // Unreadable (e.g. the client secret was rotated): surface it so the
        // member sees "reconnect" instead of a silently dead sync.
        await this.markError(
          userId,
          "Stored connection is unreadable — reconnect needed"
        );
        return null;
      }
    },

    async saveIfUnchanged(userId, prevRefreshToken, next) {
      const { data, error } = await svc
        .from("whoop_connections")
        .update({
          tokens_enc: encryptJson(
            { accessToken: next.accessToken, refreshToken: next.refreshToken },
            secret
          ),
          refresh_fp: fingerprint(next.refreshToken),
          expires_at: next.expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("refresh_fp", fingerprint(prevRefreshToken))
        .select("user_id");
      if (error) throw new Error(error.message);
      return Array.isArray(data) && data.length > 0;
    },

    async markError(userId, message) {
      await svc
        .from("whoop_connections")
        .update({ last_error: message })
        .eq("user_id", userId);
      await setProfileStatus(svc, userId, message ? "needs_reconnect" : "active");
    },

    async markSynced(userId) {
      await svc
        .from("whoop_connections")
        .update({ last_synced_at: new Date().toISOString(), last_error: null })
        .eq("user_id", userId);
      await setProfileStatus(svc, userId, "active");
    },
  };
}

export function buildDeps(svc: any, cfg: WhoopConfig): WhoopDeps {
  return {
    cfg,
    store: supabaseTokenStore(svc, cfg.clientSecret),
    fetchFn: fetch,
    sleep: realSleep,
  };
}

// Creates (or replaces, on reconnect) a member's connection. A WHOOP account
// can only be linked to one Pod account — that's the unique whoop_user_id.
export async function saveNewConnection(
  svc: any,
  secret: string,
  args: {
    userId: string;
    whoopUserId: number;
    tokens: TokenSet;
    consentAt: Date;
  }
): Promise<{ ok: boolean; linkedElsewhere: boolean }> {
  const now = new Date().toISOString();
  const { error } = await svc.from("whoop_connections").upsert(
    {
      user_id: args.userId,
      whoop_user_id: args.whoopUserId,
      tokens_enc: encryptJson(
        {
          accessToken: args.tokens.accessToken,
          refreshToken: args.tokens.refreshToken,
        },
        secret
      ),
      refresh_fp: fingerprint(args.tokens.refreshToken),
      expires_at: args.tokens.expiresAt.toISOString(),
      scopes: args.tokens.scope,
      share_consent_at: args.consentAt.toISOString(),
      connected_at: now,
      last_error: null,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (error) {
    return { ok: false, linkedElsewhere: error.code === "23505" };
  }
  await setProfileStatus(svc, args.userId, "active", now);
  return { ok: true, linkedElsewhere: false };
}

export async function findUserByWhoopId(
  svc: any,
  whoopUserId: number
): Promise<string | null> {
  const { data } = await svc
    .from("whoop_connections")
    .select("user_id")
    .eq("whoop_user_id", whoopUserId)
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function removeConnection(svc: any, userId: string) {
  await svc.from("whoop_connections").delete().eq("user_id", userId);
  await setProfileStatus(svc, userId, null, null);
}

// Daily safety net: WHOOP says webhooks can be missed, and for an
// accountability app a missed workout looks like a skipped one. Runs last in
// the cron, inside a time budget, so it can never starve the other jobs.
export async function reconcileAllWhoop(
  svc: any,
  budgetMs: number
): Promise<{ users: number; workouts: number }> {
  const cfg = whoopConfig();
  if (!cfg) return { users: 0, workouts: 0 };
  const deadline = Date.now() + budgetMs;
  const { data } = await svc.from("whoop_connections").select("user_id").limit(50);
  const deps = buildDeps(svc, cfg);
  let users = 0;
  let workouts = 0;
  for (const row of (data ?? []) as any[]) {
    if (Date.now() > deadline) break;
    try {
      const r = await syncRecentWorkouts(deps, svc, row.user_id, 3);
      if (r.ok) {
        users++;
        workouts += r.workouts;
      }
    } catch {
      /* one member's failure must not stop the others */
    }
  }
  return { users, workouts };
}
