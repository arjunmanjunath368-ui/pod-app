"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = { userId: string; name: string };

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
  currentWeekStart,
  activeView,
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
  currentWeekStart: string;
  activeView?: {
    stakeAmount: number;
    periodWeeks: number;
    displayWeek: number;
    daysLeft: number;
    startedLabel: string;
    standings: { name: string; net: number; hasGoal: boolean }[];
    lastSettlement: {
      periodLabel: string;
      rows: { name: string; net: number }[];
    } | null;
  } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(5);
  const [weeks, setWeeks] = useState(2);
  const [showForm, setShowForm] = useState(false);

  const supabase = () => createClient();

  async function checkAndActivate(pid: string) {
    const sb = supabase();
    const { data: mems } = await sb
      .from("pod_members")
      .select("user_id")
      .eq("pod_id", podId)
      .eq("status", "active");
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
          period_start: currentWeekStart,
          updated_at: new Date().toISOString(),
        })
        .eq("pod_id", podId);
    }
  }

  async function propose() {
    setBusy(true);
    const sb = supabase();
    const pid = crypto.randomUUID();
    await sb.from("pod_stakes").upsert(
      {
        pod_id: podId,
        status: "proposed",
        proposal_id: pid,
        proposed_by: userId,
        prop_amount: amount,
        prop_weeks: weeks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "pod_id" }
    );
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
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 rounded-full bg-terra px-4 py-2 text-[14px] font-semibold text-white transition active:scale-95"
            >
              Propose stakes
            </button>
          </>
        ) : (
          <>
            <div className="text-[15px] font-semibold text-ink">
              Propose stakes
            </div>

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
                />
                <span className="text-[13px] text-muted">per week (max $20)</span>
              </div>
            </div>

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
                />
                <span className="text-[13px] text-muted">1–6 weeks</span>
              </div>
            </div>

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
    );
  }

  // ---- PROPOSED ----
  if (status === "proposed") {
    const myConsent = consentMap[userId];
    const iProposed = proposedById === userId;
    return (
      <Card>
        <div className="text-[15px] font-semibold text-ink">
          {iProposed ? "Your proposal" : `${proposedByName} proposed stakes`}
        </div>
        <p className="mt-1 text-[14px] text-muted">
          <span className="font-semibold text-ink-soft">${propAmount}</span> per
          week ·{" "}
          <span className="font-semibold text-ink-soft">{propWeeks} weeks</span>{" "}
          per settlement. Everyone must agree.
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
  const fmtNet = (n: number) => `${n > 0 ? "+" : ""}${n}`;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sage/15 px-3 py-1 text-[12px] font-semibold text-sage">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" />
            Stakes active
          </div>
          {activeView && (
            <div className="text-[12px] font-semibold text-muted">
              Week {activeView.displayWeek} of {activeView.periodWeeks}
            </div>
          )}
        </div>
        <div className="mt-3 text-[15px] font-semibold text-ink">
          ${stakeAmount} / week · {periodWeeks}-week settlement
        </div>
        {activeView && (
          <p className="mt-1 text-[14px] text-muted">
            Settles in {activeView.daysLeft}{" "}
            {activeView.daysLeft === 1 ? "day" : "days"}.
          </p>
        )}
      </Card>

      {activeView && activeView.standings.length > 0 && (
        <Card>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            Standings so far
          </div>
          <p className="mt-1 text-[12px] text-muted">
            Week {activeView.displayWeek} of {activeView.periodWeeks} · started{" "}
            {activeView.startedLabel} · {activeView.daysLeft}{" "}
            {activeView.daysLeft === 1 ? "day" : "days"} left
          </p>
          <div className="mt-3 space-y-2">
            {activeView.standings.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-[15px]"
              >
                <span className="text-ink">{s.name}</span>
                {s.hasGoal ? (
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
            Running total this period — not final until settlement.
          </p>
        </Card>
      )}

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
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
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
}: {
  value: number;
  set: (v: number) => void;
  step: number;
  prefix?: string;
  suffix?: string;
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
        {prefix}
        {value}
        {suffix}
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
