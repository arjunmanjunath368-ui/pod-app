import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admin";
import { parseGoal } from "@/lib/goals";
import {
  computePodHealth,
  summarize,
  type PHMember,
  type PHSession,
  type PodHealth,
} from "@/lib/podHealth";

export const dynamic = "force-dynamic";

const PAGE = 1000;

// Supabase silently caps a single query at 1,000 rows. A truncated session list
// would quietly corrupt every metric on this page, so always page through.
async function fetchAll(
  build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>
): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    for (const r of rows) out.push(r);
    if (rows.length < PAGE) break;
  }
  return out;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0);

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { min?: string };
}) {
  const server = createClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user) redirect("/login");
  // Not an admin (or ADMIN_EMAILS unset): behave as if the page doesn't exist.
  if (!isAdminEmail(user.email)) notFound();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return (
      <main className="px-5 pt-9">
        <p className="text-[15px] text-ink-soft">
          Service credentials are missing, so this page can't load data.
        </p>
      </main>
    );
  }
  const svc = createServiceClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const minSize = searchParams.min === "3" ? 3 : 1;

  let list: PodHealth[] = [];
  // Pods whose running stake is a meal tab rather than cash (for the 🍽️ tag).
  const mealPodIds: Record<string, boolean> = {};
  let loadError = "";
  try {
    const [pods, memberRows, sessionRows, stakeRows] = await Promise.all([
      fetchAll((f, t) =>
        svc.from("pods").select("id, name, timezone, week_starts_on").range(f, t)
      ),
      fetchAll((f, t) =>
        svc
          .from("pod_members")
          .select(
            "pod_id, user_id, status, joined_at, goal_activity, goal_target_per_week, goal_mode, goal_activities, goal_splits"
          )
          .range(f, t)
      ),
      fetchAll((f, t) =>
        svc
          .from("sessions")
          .select("pod_id, user_id, logged_at, activity, activities")
          .order("logged_at", { ascending: true })
          .order("id", { ascending: true })
          .range(f, t)
      ),
      fetchAll((f, t) =>
        svc.from("pod_stakes").select("*").eq("status", "active").range(f, t)
      ),
    ]);

    // Display names, fetched in chunks to keep the request URL short.
    const userIds: string[] = [];
    const seen: Record<string, boolean> = {};
    for (const m of memberRows) {
      if (!seen[m.user_id]) {
        seen[m.user_id] = true;
        userIds.push(m.user_id);
      }
    }
    const nameOf: Record<string, string> = {};
    for (let i = 0; i < userIds.length; i += 150) {
      const { data } = await svc
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds.slice(i, i + 150));
      for (const p of (data ?? []) as any[]) nameOf[p.id] = p.display_name ?? "Member";
    }

    const membersByPod: Record<string, PHMember[]> = {};
    for (const m of memberRows) {
      (membersByPod[m.pod_id] ??= []).push({
        userId: m.user_id,
        name: nameOf[m.user_id] ?? "Member",
        status: m.status ?? "active",
        joinedAt: m.joined_at ? new Date(m.joined_at) : null,
        goal: parseGoal(m),
      });
    }
    const sessionsByPod: Record<string, PHSession[]> = {};
    for (const s of sessionRows) {
      (sessionsByPod[s.pod_id] ??= []).push({
        userId: s.user_id,
        loggedAt: new Date(s.logged_at),
        activity: s.activity ?? null,
        activities: s.activities ?? null,
      });
    }
    const stakedPods: Record<string, boolean> = {};
    for (const r of stakeRows) {
      stakedPods[r.pod_id] = true;
      if (r.kind === "meal") mealPodIds[r.pod_id] = true;
    }

    // Which pods require a live photo. Its own query so a missing migration
    // can't take the whole page down.
    const proofPods: Record<string, boolean> = {};
    try {
      const proofRows = await fetchAll((f, t) =>
        svc.from("pods").select("id, proof_mode").range(f, t)
      );
      for (const r of proofRows) if (r.proof_mode === "photo") proofPods[r.id] = true;
    } catch {
      /* column not there yet: treat every pod as having no photo rule */
    }

    const now = new Date();
    for (const p of pods) {
      const members = membersByPod[p.id] ?? [];
      const present = members.filter((m) => m.status !== "left").length;
      if (present < minSize) continue;
      list.push(
        computePodHealth(
          {
            podId: p.id,
            name: p.name ?? "Pod",
            tz: p.timezone ?? "UTC",
            weekStartsOn: p.week_starts_on ?? 1,
            members,
            sessions: sessionsByPod[p.id] ?? [],
            staked: !!stakedPods[p.id],
            proof: !!proofPods[p.id],
          },
          now
        )
      );
    }
    // Newest pods first — those are the ones being watched.
    list.sort(
      (a, b) =>
        (b.startDate ? b.startDate.getTime() : 0) -
        (a.startDate ? a.startDate.getTime() : 0)
    );
  } catch (e: any) {
    loadError = e?.message ?? "Unknown error";
  }

  const sum = summarize(list);
  const wk8 = sum.survival.find((s) => s.week === 8) ?? null;
  const maxOf = sum.survival.reduce((m, s) => Math.max(m, s.of), 0);
  const actJudged = sum.activation.activated + sum.activation.failed;

  // Photo-proof pods vs the rest — the comparison the rule was added to allow.
  const withProof = list.filter((p) => p.proof);
  const withoutProof = list.filter((p) => !p.proof);
  const compare = withProof.length > 0 && withoutProof.length > 0;
  const at = (s: ReturnType<typeof summarize>, w: number) => {
    const pt = s.survival.find((x) => x.week === w);
    return pt ? `${pt.alive}/${pt.of}` : "—";
  };
  const proofSum = summarize(withProof);
  const noProofSum = summarize(withoutProof);

  const pill = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
      active ? "bg-ink text-paper" : "border border-line bg-card text-muted"
    }`;

  return (
    <main className="px-5 pb-16 pt-9">
      <Link href="/app/settings" className="text-[14px] font-semibold text-muted">
        ‹ Settings
      </Link>
      <h1 className="mt-3 font-serif text-[28px] font-semibold leading-tight text-ink">
        Pod health
      </h1>
      <p className="mt-1 text-[14px] text-muted">
        Private. Counts goal hits the same way the app does.
      </p>

      <div className="mt-4 flex gap-1.5">
        <Link href="/app/admin" className={pill(minSize === 1)}>
          All pods
        </Link>
        <Link href="/app/admin?min=3" className={pill(minSize === 3)}>
          3+ members
        </Link>
      </div>

      {loadError && (
        <div className="mt-4 rounded-2xl border border-terra/40 bg-terra/[0.06] p-4 text-[14px] text-ink-soft">
          Couldn't load data: {loadError}
        </div>
      )}

      {/* Headline tiles */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-ink px-4 py-3.5 text-paper">
          <div className="font-serif text-[30px] font-semibold leading-none">
            {wk8 ? `${pct(wk8.alive, wk8.of)}%` : "—"}
          </div>
          <div className="mt-1.5 text-[12px] font-medium text-sage-soft">
            week-8 pod survival
            {wk8 ? ` · ${wk8.alive}/${wk8.of}` : ""}
          </div>
        </div>
        <div className="rounded-2xl bg-ink px-4 py-3.5 text-paper">
          <div className="font-serif text-[30px] font-semibold leading-none">
            {sum.pods}
          </div>
          <div className="mt-1.5 text-[12px] font-medium text-sage-soft">
            pods · {sum.members} members
          </div>
        </div>
        <div className="rounded-2xl bg-ink px-4 py-3.5 text-paper">
          <div className="font-serif text-[30px] font-semibold leading-none">
            {actJudged > 0 ? `${pct(sum.activation.activated, actJudged)}%` : "—"}
          </div>
          <div className="mt-1.5 text-[12px] font-medium text-sage-soft">
            pods activated
            {actJudged > 0 ? ` · ${sum.activation.activated}/${actJudged}` : ""}
            {sum.activation.pending > 0 ? ` (+${sum.activation.pending} pending)` : ""}
          </div>
        </div>
        <div className="rounded-2xl bg-ink px-4 py-3.5 text-paper">
          <div className="font-serif text-[30px] font-semibold leading-none">
            {sum.comeback.rate === null ? "—" : `${Math.round(100 * sum.comeback.rate)}%`}
          </div>
          <div className="mt-1.5 text-[12px] font-medium text-sage-soft">
            comeback within 14d
            {sum.comeback.resolved > 0
              ? ` · ${sum.comeback.backWithin14}/${sum.comeback.resolved}`
              : ""}
          </div>
        </div>
      </div>
      <div className="mt-2.5 rounded-2xl border border-line bg-card px-4 py-3 text-[14px] text-ink-soft">
        Hero-dependent pods:{" "}
        <span className="font-semibold text-ink">
          {sum.hero.fragile} of {sum.hero.measured}
        </span>{" "}
        measured
        {sum.comeback.pending > 0
          ? ` · ${sum.comeback.pending} lapse${sum.comeback.pending === 1 ? "" : "s"} still pending`
          : ""}
      </div>

      {/* Survival curve */}
      <div className="mt-2.5 rounded-2xl border border-line bg-card p-4">
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
          Pod survival by week
        </div>
        {sum.survival.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">
            No pod has completed a full week yet.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {sum.survival.map((s) => (
              <div key={s.week}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-ink-soft">Week {s.week}</span>
                  <span className="text-muted">
                    {s.alive} of {s.of} · {pct(s.alive, s.of)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-paper-2">
                  <div
                    className="h-full rounded-full bg-sage"
                    style={{ width: `${Math.max(pct(s.alive, s.of), 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {maxOf > 0 && maxOf < 8 && (
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            Fewer than 8 pods in any week. Treat these percentages as anecdotes,
            not a trend.
          </p>
        )}
      </div>

      {compare && (
        <div className="mt-2.5 rounded-2xl border border-line bg-card p-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
            Photo proof vs. none (pods alive)
          </div>
          {[
            { label: "📸 Photo proof", n: withProof.length, s: proofSum },
            { label: "No photo rule", n: withoutProof.length, s: noProofSum },
          ].map((g) => (
            <div
              key={g.label}
              className="mt-2.5 flex items-baseline justify-between gap-3 text-[14px]"
            >
              <span className="font-medium text-ink-soft">
                {g.label} · {g.n} pod{g.n === 1 ? "" : "s"}
              </span>
              <span className="text-muted">
                W2 {at(g.s, 2)} · W4 {at(g.s, 4)} · W8 {at(g.s, 8)}
              </span>
            </div>
          ))}
          <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
            Small groups: read this as a hint, not a result.
          </p>
        </div>
      )}

      {/* Per-pod cards */}
      <div className="mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
        Pods
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        {list.length === 0 && !loadError && (
          <p className="text-[14px] text-muted">No pods match this filter.</p>
        )}
        {list.map((p) => {
          const started = p.startDate
            ? p.startDate.toLocaleDateString("en-US", {
                timeZone: p.tz,
                month: "short",
                day: "numeric",
              })
            : "—";
          return (
            <div key={p.podId} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[16px] font-semibold text-ink">
                    {p.name}
                    {p.staked ? (mealPodIds[p.podId] ? " 🍽️" : " 💰") : ""}
                    {p.proof ? " 📸" : ""}
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted">
                    Started {started} · {p.weeks.length} week
                    {p.weeks.length === 1 ? "" : "s"} scored
                    {p.lastLogDaysAgo !== null
                      ? ` · last log ${p.lastLogDaysAgo === 0 ? "today" : `${p.lastLogDaysAgo}d ago`}`
                      : " · no logs"}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[13px] text-ink-soft">
                  <div className="font-semibold">
                    {p.counts.active + p.counts.paused} member
                    {p.counts.active + p.counts.paused === 1 ? "" : "s"}
                  </div>
                  {(p.counts.paused > 0 || p.counts.left > 0) && (
                    <div className="text-[12px] text-muted">
                      {p.counts.paused > 0 ? `${p.counts.paused} paused` : ""}
                      {p.counts.paused > 0 && p.counts.left > 0 ? " · " : ""}
                      {p.counts.left > 0 ? `${p.counts.left} left` : ""}
                    </div>
                  )}
                </div>
              </div>

              {(p.weeks.length > 0 || p.currentWeek) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.weeks.map((w) => (
                    <div
                      key={w.index}
                      className={`rounded-lg px-2 py-1 text-center ${
                        w.alive === null
                          ? "bg-paper-2 text-muted"
                          : w.alive
                            ? "bg-sage/[0.22] text-ink"
                            : "bg-terra/[0.14] text-terra"
                      }`}
                    >
                      <div className="text-[10px] font-semibold uppercase leading-none opacity-70">
                        W{w.index}
                      </div>
                      <div className="mt-0.5 text-[13px] font-semibold leading-none">
                        {w.hit}/{w.eligible}
                      </div>
                    </div>
                  ))}
                  {p.currentWeek && (
                    <div className="rounded-lg border border-dashed border-line px-2 py-1 text-center text-muted">
                      <div className="text-[10px] font-semibold uppercase leading-none">
                        W{p.currentWeek.index} now
                      </div>
                      <div className="mt-0.5 text-[13px] font-semibold leading-none">
                        {p.currentWeek.hit}/{p.currentWeek.eligible}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 space-y-1 text-[13px] leading-relaxed text-ink-soft">
                <div>
                  <span className="font-semibold text-ink">Activation:</span>{" "}
                  {p.activation.podActivated === true
                    ? "all members set a goal and logged in week 1"
                    : p.activation.podActivated === false
                      ? `${p.activation.failed} member${p.activation.failed === 1 ? "" : "s"} never got going in week 1`
                      : "still pending"}
                </div>
                <div>
                  <span className="font-semibold text-ink">Lapses:</span>{" "}
                  {p.lapses.total === 0
                    ? "none yet"
                    : `${p.lapses.total} · back within 14d ${p.lapses.backWithin14}, back late ${p.lapses.backLate}, still out ${p.lapses.stillOut}, pending ${p.lapses.pending}`}
                </div>
                <div>
                  <span className="font-semibold text-ink">Hero:</span>{" "}
                  {p.hero === null ? (
                    "not enough logs in the last 28 days"
                  ) : p.hero.fragile ? (
                    <span className="font-semibold text-terra">
                      ⚠ {p.hero.name} did {p.hero.top} of {p.hero.total} logs (
                      {Math.round(100 * p.hero.share)}%)
                    </span>
                  ) : (
                    `spread out — top is ${p.hero.name} at ${p.hero.top} of ${p.hero.total} (${Math.round(100 * p.hero.share)}%)`
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Definitions */}
      <div className="mt-5 rounded-2xl border border-line bg-card p-4 text-[12px] leading-relaxed text-muted">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.14em]">
          How these are counted
        </div>
        <p>
          <span className="font-semibold text-ink-soft">Week 1</span> is the first
          full week after a pod's first member joined. A pod is{" "}
          <span className="font-semibold text-ink-soft">alive</span> in a week when
          at least half of its members hit their own goal. Members with no goal,
          or who joined later, aren't counted for that week; members who left
          still are, since leaving is churn.
        </p>
        <p className="mt-1.5">
          A <span className="font-semibold text-ink-soft">lapse</span> is 5+ days
          between logs. A comeback means they logged again within 14 days of the
          lapse starting. Paused members aren't counted as lapsed.{" "}
          <span className="font-semibold text-ink-soft">Activated</span> means a
          goal set and a first log within 7 days of joining.{" "}
          <span className="font-semibold text-ink-soft">Hero</span> is the top
          member's share of the last 28 days of logs; flagged above 50%, or 70%
          in a pair.
        </p>
        <p className="mt-1.5">
          Goals use each member's current goal; earlier goal changes aren't
          stored. Auto-synced Apple Health workouts count, as they do in the app.
        </p>
      </div>
    </main>
  );
}
