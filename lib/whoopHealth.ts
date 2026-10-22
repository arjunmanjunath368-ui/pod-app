import { whoopCall, type WhoopDeps } from "./whoop";
import { assessRecovery, type RecoveryCheck } from "./restDay";

// Today's WHOOP recovery and sleep, for the member's own Home screen.
//
// Read live when Home loads and never stored. Pod shows these numbers only to
// the member they belong to; pod-mates only ever see "rest day". Needs the
// member's opt-in (Recovery & sleep in Settings), which grants read:recovery
// and read:sleep.

export type RecoveryZone = "red" | "yellow" | "green";

export type WhoopHealth = {
  recovery: { score: number; zone: RecoveryZone } | null;
  recoveryCheck: RecoveryCheck | null;
  sleep: { performance: number } | null;
  // Connected before sleep was added: reconnecting grants it.
  sleepNeedsReconnect: boolean;
  needsReconnect: boolean;
};

export function recoveryZone(score: number): RecoveryZone {
  if (score <= 33) return "red";
  if (score <= 66) return "yellow";
  return "green";
}

// The latest scored main sleep (not a nap) that ended in the last ~20 hours.
export function pickSleep(records: any[], now: Date = new Date()): { performance: number } | null {
  for (const r of records ?? []) {
    if (!r || r.nap === true || r.score_state !== "SCORED" || !r.score) continue;
    const end = new Date(r.end ?? r.updated_at ?? "");
    if (isNaN(end.getTime())) continue;
    const ageH = (now.getTime() - end.getTime()) / 3600000;
    if (ageH < -1 || ageH > 20) continue;
    const raw =
      r.score.sleep_performance_percentage ?? r.score.sleep_performance ?? null;
    const perf = Number(raw);
    if (raw === null || !isFinite(perf)) continue;
    return { performance: Math.round(Math.max(0, Math.min(100, perf))) };
  }
  return null;
}

export function pickRecovery(record: any, now: Date = new Date()) {
  const check = assessRecovery(record, now);
  if (check !== "red" && check !== "not_red") return { check, recovery: null };
  const score = Math.round(Number(record.score.recovery_score));
  return { check, recovery: { score, zone: recoveryZone(score) } };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]).catch(() => null);
}

export async function loadWhoopHealth(
  deps: WhoopDeps,
  userId: string,
  scopes: string,
  timeoutMs = 2500
): Promise<WhoopHealth> {
  const has = (s: string) => !scopes || scopes.split(" ").indexOf(s) !== -1;
  const out: WhoopHealth = {
    recovery: null,
    recoveryCheck: null,
    sleep: null,
    sleepNeedsReconnect: !has("read:sleep"),
    needsReconnect: false,
  };
  const now = new Date();

  const [rec, slp] = await Promise.all([
    has("read:recovery")
      ? withTimeout(whoopCall(deps, userId, "GET", "/v2/recovery?limit=1"), timeoutMs)
      : Promise.resolve(null),
    has("read:sleep")
      ? withTimeout(whoopCall(deps, userId, "GET", "/v2/activity/sleep?limit=3"), timeoutMs)
      : Promise.resolve(null),
  ]);

  if (rec && (rec.status === 401 || rec.status === 403)) out.needsReconnect = true;
  if (rec && rec.status === 200) {
    const latest = Array.isArray(rec.json?.records) ? rec.json.records[0] : null;
    const r = pickRecovery(latest, now);
    out.recoveryCheck = r.check;
    out.recovery = r.recovery;
  }
  if (slp && slp.status === 200) {
    out.sleep = pickSleep(Array.isArray(slp.json?.records) ? slp.json.records : [], now);
  }
  return out;
}
