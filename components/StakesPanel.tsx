"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MEAL_UNITS, normalizeUnit, unitEmoji, unitPhrase } from "@/lib/meals";

type Member = { userId: string; name: string; paused?: boolean };

export default function StakesPanel({
  podId,
  userId,
  isActiveMember,
  activeMembers,
  consentMap,
  status,
  proposalId,
  proposedById,
  proposedByName,
  propAmount,
  propWeeks,
  stakeAmount,
  periodWeeks,
  periodStart,
  firstPeriodStart,
  activeView,
  pendingAction,
  pendingWeeks,
  pendingProposalId,
  pendingById,
  pendingByName,
  offLastSettlement,
  kind,
  unit,
  propKind,
  propUnit,
  hasKindColumn,
}: {
  podId: string;
  userId: string;
  isActiveMember: boolean;
  activeMembers: Member[];
  consentMap: Record<string, boolean | null>;
  status: string;
  proposalId: string | null;
  proposedById: string | null;
  proposedByName: string;
  propAmount: number | null;
  propWeeks: number | null;
  stakeAmount: number | null;
  periodWeeks: number | null;
  periodStart: string | null;
  firstPeriodStart: string;
  activeView?: {
    stakeAmount: number;
    periodWeeks: number;
    displayWeek: number;
    daysLeft: number;
    startedLabel: string;
    startLabel: string;
    notStartedYet: boolean;
    standings: { name: string; net: number; hasGoal: boolean; paused: boolean }[];
    // Present only for a meal tab: locked-in meals per member instead of $ nets.
    meal?: {
      unit: string;
      rows: {
        name: string;
        locked: number;
        atRisk: boolean;
        hasGoal: boolean;
        paused: boolean;
      }[];
    } | null;
    lastSettlement: {
      periodLabel: string;
      rows: { name: string; net: number; owes?: number }[];
      unit?: string | null;
    } | null;
  } | null;
  pendingAction: string | null;
  pendingWeeks: number | null;
  pendingProposalId: string | null;
  pendingById: string | null;
  pendingByName: string;
  offLastSettlement: {
    periodLabel: string;
    rows: { name: string; net: number; owes?: number }[];
    unit?: string | null;
  } | null;
  // What the running (or last) period puts on the line: cash or a meal.
  kind: "money" | "meal";
  unit: string | null;
  // The kind of the proposal currently awaiting votes.
  propKind: "money" | "meal";
  propUnit: string | null;
  // True once the meal migration has been run, so cash proposals can keep
  // writing exactly what they always did when it hasn't.
  hasKindColumn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(5);
  const [weeks, setWeeks] = useState(2);
  const [showForm, setShowForm] = useState(false);
  const [manageMode, setManageMode] = useState<null | "reschedule" | "settle">(
    null
  );
  const [rescheduleWeeks, setRescheduleWeeks] = useState(2);
  // The proposal form: cash (default) or a meal.
  const [formKind, setFormKind] = useState<"money" | "meal">("money");
  const [formUnit, setFormUnit] = useState("dinner");
  const [formError, setFormError] = useState("");

  const supabase = () => createClient();
  const fmtNet = (n: number) => `${n > 0 ? "+" : ""}${n}`;

  async function checkAndActivate(pid: string) {
    const sb = supabase();
    const { data: mems } = await sb
      .from("pod_members")
      .select("user_id")
      .eq("pod_id", podId)
      .neq("status", "left");
    const n = (mems ?? []).length;
    const { data: cons } = await sb
      .from("stake_consents")
      .select("user_id, agreed")
      .eq("pod_id", podId)
      .eq("proposal_id", pid);
    const declined = (cons ?? []).some((c: any) => c.agreed === false);
    const agreedCount = (cons ?? []).filter((c: any) => c.agreed === true).length;
    if (declined) {
      await sb
        .from("pod_stakes")
        .update({ status: "off", updated_at: new Date().toISOString() })
        .eq("pod_id", podId);
      return;
    }
    if (n > 0 && agreedCount >= n) {
      await sb
        .from("pod_stakes")
        .update({
          status: "active",
          stake_amount: propAmount ?? amount,
          period_weeks: propWeeks ?? weeks,
          period_start: firstPeriodStart,
          // Only sent when the migration is in place (or this is a meal), so a
          // cash stake activates exactly as it always has.
          ...(hasKindColumn || propKind === "meal"
            ? {
                kind: propKind,
                unit_label: propKind === "meal" ? normalizeUnit(propUnit) : null,
              }
            : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("pod_id", podId);
    }
  }

  async function propose() {
    setBusy(true);
    const sb = supabase();
    const pid = crypto.randomUUID();
    const { error: propErr } = await sb.from("pod_stakes").upsert(
      {
        pod_id: podId,
        status: "proposed",
        proposal_id: pid,
        proposed_by: userId,
        prop_amount: formKind === "meal" ? 1 : amount,
        prop_weeks: weeks,
        // Same rule as activation: cash proposals don't send the new fields
        // unless the migration is already in place.
        ...(formKind === "meal" || hasKindColumn
          ? {
              prop_kind: formKind,
              prop_unit: formKind === "meal" ? formUnit : null,
            }
          : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "pod_id" }
    );
    if (propErr && formKind === "meal") {
      setFormError(
        "Couldn't send that — the meal option may not be set up yet. (" +
          propErr.message +
          ")"
      );
      setBusy(false);
      return;
    }
    await sb.from("stake_consents").upsert(
      {
        pod_id: podId,
        user_id: userId,
        proposal_id: pid,
        agreed: true,
        responded_at: new Date().toISOString(),
      },
      { onConflict: "pod_id,user_id" }
    );
    await checkAndActivate(pid); // activates immediately if you're the only member
    setBusy(false);
    setShowForm(false);
    router.refresh();
  }

  async function respond(agreed: boolean) {
    if (!proposalId) return;
    setBusy(true);
    const sb = supabase();
    await sb.from("stake_consents").upsert(
      {
        pod_id: podId,
        user_id: userId,
        proposal_id: proposalId,
        agreed,
        responded_at: new Date().toISOString(),
      },
      { onConflict: "pod_id,user_id" }
    );
    if (!agreed) {
      await sb
        .from("pod_stakes")
        .update({ status: "off", updated_at: new Date().toISOString() })
        .eq("pod_id", podId);
    } else {
      await checkAndActivate(proposalId);
    }
    setBusy(false);
    router.refresh();
  }

  async function cancelProposal() {
    setBusy(true);
    await supabase()
      .from("pod_stakes")
      .update({ status: "off", updated_at: new Date().toISOString() })
      .eq("pod_id", podId);
    setBusy(false);
    router.refresh();
  }

  // ---- Stage 9: extend / settle proposals (consent-gated). The client only
  // records the proposal + the proposer's own yes; the server applies it once
  // everyone agrees. ----
  async function proposePending(
    action: "reschedule" | "settle",
    weeksValue?: number
  ) {
    setBusy(true);
    const sb = supabase();
    const pid = crypto.randomUUID();
    await sb
      .from("pod_stakes")
      .update({
        pending_action: action,
        pending_proposal_id: pid,
        pending_by: userId,
        pending_weeks: action === "reschedule" ? weeksValue ?? null : null,
        updated_at: new Date().toISOString(),
      })
      .eq("pod_id", podId);
    await sb.from("stake_consents").upsert(
      {
        pod_id: podId,
        user_id: userId,
        proposal_id: pid,
        agreed: true,
        responded_at: new Date().toISOString(),
      },
      { onConflict: "pod_id,user_id" }
    );
    setBusy(false);
    setManageMode(null);
    router.refresh();
  }

  async function respondPending(agreed: boolean) {
    if (!pendingProposalId) return;
    setBusy(true);
    const sb = supabase();
    await sb.from("stake_consents").upsert(
      {
        pod_id: podId,
        user_id: userId,
        proposal_id: pendingProposalId,
        agreed,
        responded_at: new Date().toISOString(),
      },
      { onConflict: "pod_id,user_id" }
    );
    if (!agreed) {
      await sb
        .from("pod_stakes")
        .update({
          pending_action: null,
          pending_proposal_id: null,
          pending_by: null,
          pending_weeks: null,
          updated_at: new Date().toISOString(),
        })
        .eq("pod_id", podId);
    }
    setBusy(false);
    router.refresh();
  }

  async function cancelPending() {
    setBusy(true);
    await supabase()
      .from("pod_stakes")
      .update({
        pending_action: null,
        pending_proposal_id: null,
        pending_by: null,
        pending_weeks: null,
        updated_at: new Date().toISOString(),
      })
      .eq("pod_id", podId);
    setBusy(false);
    router.refresh();
  }

  // ---- OFF ----
  if (status === "off") {
    if (!isActiveMember) {
      return (
        <Card>
          <p className="text-[14px] text-muted">
            Stakes are off for this pod.
          </p>
        </Card>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        <Card>
        {!showForm ? (
          <>
            <div className="text-[15px] font-semibold text-ink">
              Stakes are off
            </div>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              Propose a weekly stake. Everyone in the pod has to agree before it
              turns on.
            </p>
            {activeMembers.length < 2 ? (
              <p className="mt-3 rounded-xl border border-line bg-paper-2/50 px-3 py-2.5 text-[13px] leading-relaxed text-muted">
                Stakes need at least one teammate — add someone to your pod first.
                A bet with yourself isn't much of a bet.
              </p>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 rounded-full bg-terra px-4 py-2 text-[14px] font-semibold text-white transition active:scale-95"
              >
                Propose stakes
              </button>
            )}
          </>
        ) : (
          <>
            <div className="text-[15px] font-semibold text-ink">
              Propose stakes
            </div>

            <div className="mt-4">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                What's on the line
              </div>
              <div className="mt-2 flex gap-2">
                {(["money", "meal"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setFormKind(k);
                      setFormError("");
                    }}
                    className={`flex-1 rounded-2xl border px-3 py-2.5 text-[14px] font-semibold transition active:scale-95 ${
                      formKind === k
                        ? "border-terra bg-terra/[0.06] text-ink"
                        : "border-line bg-card text-ink-soft"
                    }`}
                  >
                    {k === "money" ? "💰 Cash" : "🍽️ A meal"}
                  </button>
                ))}
              </div>
            </div>

            {formKind === "money" ? (
              <div className="mt-4">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                  Weekly stake
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <Stepper
                    value={amount}
                    set={(v) => setAmount(Math.max(1, Math.min(20, v)))}
                    step={1}
                    prefix="$"
                    animated
                  />
                  <span className="text-[13px] text-muted">per week (max $20)</span>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                  What's the treat?
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MEAL_UNITS.map((u) => (
                    <button
                      key={u.key}
                      onClick={() => setFormUnit(u.key)}
                      className={`rounded-full border px-3.5 py-2 text-[14px] font-semibold transition active:scale-95 ${
                        formUnit === u.key
                          ? "border-terra bg-terra/[0.06] text-ink"
                          : "border-line bg-card text-ink-soft"
                      }`}
                    >
                      {u.emoji} {u.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  Miss a week's goal and you owe the pod{" "}
                  {unitPhrase(formUnit, 1)}. Nothing is paid in the app — you
                  settle by actually treating them.
                </p>
              </div>
            )}

            <div className="mt-4">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                Settlement period
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Stepper
                  value={weeks}
                  set={(v) => setWeeks(Math.max(1, Math.min(6, v)))}
                  step={1}
                  suffix={weeks === 1 ? " wk" : " wks"}
                  animated
                />
                <span className="text-[13px] text-muted">1–6 weeks</span>
              </div>
            </div>

            {formError && (
              <p className="mt-4 text-[13px] leading-relaxed text-terra">
                {formError}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                disabled={busy}
                className="flex-1 rounded-2xl border border-line bg-card py-3 text-[14px] font-semibold text-ink-soft disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={propose}
                disabled={busy}
                className="flex-1 rounded-2xl bg-terra py-3 text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send proposal"}
              </button>
            </div>
          </>
        )}
        </Card>

        {offLastSettlement && (
          <Card>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
              Settled up · {offLastSettlement.periodLabel}
            </div>
            <div className="mt-3 space-y-2">
              {offLastSettlement.rows.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-[15px]"
                >
                  <span className="text-ink">{s.name}</span>
                  <SettleValue s={s} unit={offLastSettlement.unit} fmtNet={fmtNet} />
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-muted">
              How the last period landed. Settle up between yourselves however you
              agreed.
            </p>
          </Card>
        )}
      </div>
    );
  }
  if (status === "proposed") {
    const myConsent = consentMap[userId];
    const iProposed = proposedById === userId;
    return (
      <Card>
        <div className="text-[15px] font-semibold text-ink">
          {iProposed
            ? "Your proposal"
            : propKind === "meal"
              ? `${proposedByName} proposed a meal tab`
              : `${proposedByName} proposed stakes`}
        </div>
        {propKind === "meal" ? (
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            Miss a week's goal and you owe the pod{" "}
            <span className="font-semibold text-ink-soft">
              {unitPhrase(propUnit, 1)}
            </span>{" "}
            · settled every{" "}
            <span className="font-semibold text-ink-soft">{propWeeks} weeks</span>.
            Nothing is paid in the app. Everyone must agree.
          </p>
        ) : (
          <p className="mt-1 text-[14px] text-muted">
            <span className="font-semibold text-ink-soft">${propAmount}</span> per
            week ·{" "}
            <span className="font-semibold text-ink-soft">{propWeeks} weeks</span>{" "}
            per settlement. Everyone must agree.
          </p>
        )}

        <div className="mt-4 space-y-2">
          {activeMembers.map((m) => {
            const c = consentMap[m.userId];
            return (
              <div
                key={m.userId}
                className="flex items-center justify-between text-[14px]"
              >
                <span className="text-ink">
                  {m.name}
                  {m.userId === userId ? " (you)" : ""}
                  {m.paused ? (
                    <span className="ml-1.5 text-[12px] text-muted">· paused</span>
                  ) : null}
                </span>
                <span
                  className={
                    c === true
                      ? "font-semibold text-sage"
                      : c === false
                        ? "font-semibold text-terra"
                        : "text-muted"
                  }
                >
                  {c === true ? "Agreed ✓" : c === false ? "Declined" : "Waiting…"}
                </span>
              </div>
            );
          })}
        </div>

        {isActiveMember && myConsent == null && (
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => respond(false)}
              disabled={busy}
              className="flex-1 rounded-2xl border border-line bg-card py-3 text-[14px] font-semibold text-ink-soft disabled:opacity-60"
            >
              Decline
            </button>
            <button
              onClick={() => respond(true)}
              disabled={busy}
              className="flex-1 rounded-2xl bg-terra py-3 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? "…" : "I'm in"}
            </button>
          </div>
        )}

        {isActiveMember && myConsent === true && (
          <p className="mt-4 text-[13px] text-muted">
            You're in. Waiting on the rest of the pod.
          </p>
        )}

        {iProposed && (
          <button
            onClick={cancelProposal}
            disabled={busy}
            className="mt-4 text-[13px] font-semibold text-muted underline"
          >
            Cancel proposal
          </button>
        )}
      </Card>
    );
  }

  // ---- ACTIVE ----
  const pendingMine = pendingById === userId;
  const myPendingConsent = consentMap[userId];
  const pendingWho = pendingMine ? "You" : pendingByName;
  const pendingTitle =
    pendingAction === "settle"
      ? `${pendingWho} proposed settling up & ending`
      : pendingWeeks != null &&
          periodWeeks != null &&
          pendingWeeks < periodWeeks
        ? `${pendingWho} proposed wrapping up after week ${pendingWeeks}`
        : `${pendingWho} proposed extending to ${pendingWeeks} weeks`;
  // A meal tab shows locked-in meals instead of $ nets.
  const mealView = kind === "meal" ? activeView?.meal ?? null : null;
  const curTotalWeeks = periodWeeks ?? 2;
  const curWeekNum = activeView?.displayWeek ?? 1;
  const minReschedule = curWeekNum; // earliest scheduled end = close of the current week
  const maxReschedule = Math.max(curTotalWeeks, curWeekNum) + 4;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sage/15 px-3 py-1 text-[12px] font-semibold text-sage">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" />
            {kind === "meal" ? "Meal tab active" : "Stakes active"}
          </div>
          {activeView && !activeView.notStartedYet && (
            <div className="text-[12px] font-semibold text-muted">
              Week {activeView.displayWeek} of {activeView.periodWeeks}
            </div>
          )}
        </div>
        <div className="mt-3 text-[15px] font-semibold text-ink">
          {kind === "meal"
            ? `${unitEmoji(unit)} Miss a week, owe the pod ${unitPhrase(unit, 1)}`
            : `$${stakeAmount} / week`}{" "}
          · {periodWeeks}-week settlement
        </div>
        {activeView &&
          (activeView.notStartedYet ? (
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              Kicks off {activeView.startLabel} — that's when Week 1 begins.
              Nothing's on the line until then, so ease in: get your routine
              going and break in those sneakers you've been meaning to use.
            </p>
          ) : (
            <p className="mt-1 text-[14px] text-muted">
              Settles in {activeView.daysLeft}{" "}
              {activeView.daysLeft === 1 ? "day" : "days"}.
            </p>
          ))}
      </Card>

      {pendingAction ? (
        <Card>
          <div className="text-[15px] font-semibold text-ink">
            {pendingTitle}
          </div>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">
            {pendingAction === "settle"
              ? "Settles the completed weeks now and turns stakes off. Everyone in the pod has to agree."
              : `Moves the finish line to a ${pendingWeeks}-week period (currently ${periodWeeks}). Everyone in the pod has to agree.`}
          </p>
          <div className="mt-4 space-y-2">
            {activeMembers.map((m) => {
              const c = consentMap[m.userId];
              return (
                <div
                  key={m.userId}
                  className="flex items-center justify-between text-[14px]"
                >
                  <span className="text-ink">
                    {m.name}
                    {m.userId === userId ? " (you)" : ""}
                    {m.paused ? (
                      <span className="ml-1.5 text-[12px] text-muted">
                        · paused
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={
                      c === true
                        ? "font-semibold text-sage"
                        : c === false
                          ? "font-semibold text-terra"
                          : "text-muted"
                    }
                  >
                    {c === true
                      ? "Agreed ✓"
                      : c === false
                        ? "Declined"
                        : "Waiting…"}
                  </span>
                </div>
              );
            })}
          </div>
          {isActiveMember && myPendingConsent == null && (
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => respondPending(false)}
                disabled={busy}
                className="flex-1 rounded-2xl border border-line bg-card py-3 text-[14px] font-semibold text-ink-soft disabled:opacity-60"
              >
                Decline
              </button>
              <button
                onClick={() => respondPending(true)}
                disabled={busy}
                className="flex-1 rounded-2xl bg-terra py-3 text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {busy ? "…" : "I'm in"}
              </button>
            </div>
          )}
          {isActiveMember && myPendingConsent === true && (
            <p className="mt-4 text-[13px] text-muted">
              You're in. Waiting on the rest of the pod.
            </p>
          )}
          {pendingMine && (
            <button
              onClick={cancelPending}
              disabled={busy}
              className="mt-4 text-[13px] font-semibold text-muted underline"
            >
              Cancel
            </button>
          )}
        </Card>
      ) : (
        isActiveMember && (
          <Card>
            {manageMode === null && (
              <>
                <div className="text-[15px] font-semibold text-ink">
                  Manage stakes
                </div>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">
                  Change of plans? Move the finish line — earlier or later — or
                  settle up and end now. Each needs the whole pod to agree.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      setRescheduleWeeks(curTotalWeeks);
                      setManageMode("reschedule");
                    }}
                    className="rounded-full border border-line bg-card px-4 py-2 text-[14px] font-semibold text-ink-soft active:scale-95"
                  >
                    Move the finish line
                  </button>
                  <button
                    onClick={() => setManageMode("settle")}
                    className="rounded-full border border-line bg-card px-4 py-2 text-[14px] font-semibold text-ink-soft active:scale-95"
                  >
                    Settle up & end now
                  </button>
                </div>
              </>
            )}
            {manageMode === "reschedule" && (
              <>
                <div className="text-[15px] font-semibold text-ink">
                  Move the finish line
                </div>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">
                  Set the new length of the period. Lower it to settle sooner,
                  raise it to extend — the earliest you can land is the end of the
                  current week.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Stepper
                    value={rescheduleWeeks}
                    set={(v) =>
                      setRescheduleWeeks(
                        Math.max(minReschedule, Math.min(maxReschedule, v))
                      )
                    }
                    step={1}
                    suffix={rescheduleWeeks === 1 ? " wk" : " wks"}
                  />
                  <span className="text-[13px] text-muted">
                    currently {curTotalWeeks} {curTotalWeeks === 1 ? "wk" : "wks"}
                  </span>
                </div>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setManageMode(null)}
                    disabled={busy}
                    className="flex-1 rounded-2xl border border-line bg-card py-3 text-[14px] font-semibold text-ink-soft disabled:opacity-60"
                  >
                    Back
                  </button>
                  <button
                    onClick={() =>
                      proposePending("reschedule", rescheduleWeeks)
                    }
                    disabled={busy || rescheduleWeeks === curTotalWeeks}
                    className="flex-1 rounded-2xl bg-terra py-3 text-[14px] font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Sending…" : "Propose change"}
                  </button>
                </div>
              </>
            )}
            {manageMode === "settle" && (
              <>
                <div className="text-[15px] font-semibold text-ink">
                  Settle up & end now
                </div>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">
                  Settles the completed weeks at where they stand and turns stakes
                  off immediately. The current unfinished week is voided — no one
                  forfeits a week that didn't finish.
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setManageMode(null)}
                    disabled={busy}
                    className="flex-1 rounded-2xl border border-line bg-card py-3 text-[14px] font-semibold text-ink-soft disabled:opacity-60"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => proposePending("settle")}
                    disabled={busy}
                    className="flex-1 rounded-2xl bg-terra py-3 text-[14px] font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Sending…" : "Propose settle"}
                  </button>
                </div>
              </>
            )}
          </Card>
        )
      )}

      {activeView && activeView.standings.length > 0 && (mealView ? (
        <Card>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            Tab so far
          </div>
          <p className="mt-1 text-[12px] text-muted">
            {activeView.notStartedYet
              ? `Starts ${activeView.startLabel} · ${activeView.periodWeeks}-week period`
              : `Week ${activeView.displayWeek} of ${activeView.periodWeeks} · started ${activeView.startedLabel} · ${activeView.daysLeft} ${activeView.daysLeft === 1 ? "day" : "days"} left`}
          </p>
          <div className="mt-3 space-y-2">
            {mealView.rows.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-[15px]"
              >
                <span className="text-ink">{r.name}</span>
                {r.paused ? (
                  <span className="text-[13px] text-muted">⏸ Paused</span>
                ) : !r.hasGoal ? (
                  <span className="text-[13px] text-muted">No goal set</span>
                ) : r.locked > 0 ? (
                  <span className="font-semibold text-terra">
                    owes {unitPhrase(mealView.unit, r.locked)}
                    {r.atRisk ? " · at risk this week" : ""}
                  </span>
                ) : r.atRisk ? (
                  <span className="text-[13px] font-semibold text-terra">
                    at risk this week
                  </span>
                ) : (
                  <span className="text-[13px] text-muted">all clear</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-muted">
            {activeView.notStartedYet
              ? `Scoring starts ${activeView.startLabel} — nothing on the line yet.`
              : "Meals locked in from finished weeks — not final until settlement."}
          </p>
        </Card>
      ) : (
        <Card>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            Standings so far
          </div>
          <p className="mt-1 text-[12px] text-muted">
            {activeView.notStartedYet
              ? `Starts ${activeView.startLabel} · ${activeView.periodWeeks}-week period`
              : `Week ${activeView.displayWeek} of ${activeView.periodWeeks} · started ${activeView.startedLabel} · ${activeView.daysLeft} ${activeView.daysLeft === 1 ? "day" : "days"} left`}
          </p>
          <div className="mt-3 space-y-2">
            {activeView.standings.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-[15px]"
              >
                <span className="text-ink">{s.name}</span>
                {s.paused ? (
                  <span className="text-[13px] text-muted">⏸ Paused</span>
                ) : s.hasGoal ? (
                  <span
                    className={`font-semibold ${
                      s.net > 0
                        ? "text-sage"
                        : s.net < 0
                          ? "text-terra"
                          : "text-muted"
                    }`}
                  >
                    {fmtNet(s.net)}
                  </span>
                ) : (
                  <span className="text-[13px] text-muted">No goal set</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-muted">
            {activeView.notStartedYet
              ? `Scoring starts ${activeView.startLabel} — nothing on the line yet.`
              : "Running total this period — not final until settlement."}
          </p>
        </Card>
      ))}

      {activeView?.lastSettlement && (
        <Card>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            Last settled · {activeView.lastSettlement.periodLabel}
          </div>
          <div className="mt-3 space-y-2">
            {activeView.lastSettlement.rows.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-[15px]"
              >
                <span className="text-ink">{s.name}</span>
                <SettleValue
                  s={s}
                  unit={activeView?.lastSettlement?.unit}
                  fmtNet={fmtNet}
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// One settlement row's value: "+$5 / -$5" for cash, "owes 2 dinners" for a meal tab.
function SettleValue({
  s,
  unit,
  fmtNet,
}: {
  s: { net: number; owes?: number };
  unit?: string | null;
  fmtNet: (n: number) => string;
}) {
  if (s.owes !== undefined) {
    return s.owes > 0 ? (
      <span className="font-semibold text-terra">
        owes {unitPhrase(unit, s.owes)}
      </span>
    ) : (
      <span className="text-[13px] text-muted">all clear</span>
    );
  }
  return (
    <span
      className={`font-semibold ${
        s.net > 0 ? "text-sage" : s.net < 0 ? "text-terra" : "text-muted"
      }`}
    >
      {fmtNet(s.net)}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">{children}</div>
  );
}

function Stepper({
  value,
  set,
  step,
  prefix,
  suffix,
  animated,
}: {
  value: number;
  set: (v: number) => void;
  step: number;
  prefix?: string;
  suffix?: string;
  animated?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-line bg-paper-2/40 px-2 py-1">
      <button
        onClick={() => set(value - step)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-[18px] font-semibold text-ink-soft active:scale-95"
      >
        −
      </button>
      <span className="min-w-[52px] text-center text-[16px] font-semibold text-ink">
        {animated ? (
          <RollingNumber value={value} prefix={prefix} suffix={suffix} />
        ) : (
          <>
            {prefix}
            {value}
            {suffix}
          </>
        )}
      </span>
      <button
        onClick={() => set(value + step)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-[18px] font-semibold text-ink-soft active:scale-95"
      >
        +
      </button>
    </div>
  );
}

// Gentle roll-into-place: when the value changes, the new number eases into
// position — rising up on an increment, settling down on a decrement. No reels,
// no flash; just a soft settle. Uses the Web Animations API, so no extra deps.
function RollingNumber({
  value,
  prefix = "",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || prev.current === value) return;
    const up = value > prev.current;
    prev.current = value;
    el.animate(
      [
        { transform: `translateY(${up ? "0.5em" : "-0.5em"})`, opacity: 0 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      { duration: 240, easing: "cubic-bezier(.22,.7,.25,1)" }
    );
  }, [value]);
  return (
    <span ref={ref} className="inline-block tabular-nums">
      {prefix}
      {value}
      {suffix}
    </span>
  );
}
