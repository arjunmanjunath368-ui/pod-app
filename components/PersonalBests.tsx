"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type PBEntry = {
  id: string;
  name: string;
  value: number;
  unit: string | null;
  higherIsBetter: boolean;
  details: string | null;
  achievedOn: string; // YYYY-MM-DD
};

const UNIT_CHIPS = ["min", "sec", "reps", "lb", "kg", "mi", "km", "m", "%"];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fmtDate(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  if (!y || !m || !d) return s;
  return `${months[m - 1]} ${d}`;
}

function fmtValue(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

type Group = {
  name: string;
  unit: string | null;
  higherIsBetter: boolean;
  record: PBEntry;
  previous: PBEntry | null;
  count: number;
};

export default function PersonalBests({
  userId,
  entries,
  podIds,
  shareStats,
}: {
  userId: string;
  entries: PBEntry[];
  podIds: string[];
  shareStats: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [higher, setHigher] = useState(true);
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [celebrate, setCelebrate] = useState<string | null>(null);

  const groups = useMemo<Group[]>(() => {
    const byKey: Record<string, PBEntry[]> = {};
    for (const e of entries) {
      const k = e.name.trim().toLowerCase();
      (byKey[k] ||= []).push(e);
    }
    const out: Group[] = Object.values(byKey).map((list) => {
      const hib = list[0].higherIsBetter;
      const sorted = [...list].sort((a, b) =>
        hib ? b.value - a.value : a.value - b.value
      );
      const record = sorted[0];
      const previous = sorted.length > 1 ? sorted[1] : null;
      return {
        name: record.name,
        unit: record.unit,
        higherIsBetter: hib,
        record,
        previous,
        count: list.length,
      };
    });
    // Most recently achieved record first.
    out.sort((a, b) => b.record.achievedOn.localeCompare(a.record.achievedOn));
    return out;
  }, [entries]);

  const existingNames = useMemo(
    () => Array.from(new Set(entries.map((e) => e.name))),
    [entries]
  );

  function openFresh() {
    setName("");
    setValue("");
    setUnit("");
    setHigher(true);
    setDetails("");
    setDate(today());
    setError("");
    setOpen(true);
  }

  function openForName(g: Group) {
    setName(g.name);
    setValue("");
    setUnit(g.unit ?? "");
    setHigher(g.higherIsBetter);
    setDetails("");
    setDate(today());
    setError("");
    setOpen(true);
  }

  async function save() {
    const nm = name.trim();
    const v = Number(value);
    if (!nm) {
      setError("Give it a name.");
      return;
    }
    if (!value.trim() || Number.isNaN(v)) {
      setError("Enter a number to track.");
      return;
    }
    setBusy(true);
    setError("");

    // Did this beat the existing record for the same name?
    const prior = entries.filter(
      (e) => e.name.trim().toLowerCase() === nm.toLowerCase()
    );
    let beat = false;
    let firstEver = prior.length === 0;
    if (!firstEver) {
      const best = prior.reduce(
        (acc, e) =>
          higher ? Math.max(acc, e.value) : Math.min(acc, e.value),
        higher ? -Infinity : Infinity
      );
      beat = higher ? v > best : v < best;
    }

    const supabase = createClient();
    const { error: err } = await supabase.from("personal_bests").insert({
      user_id: userId,
      name: nm,
      value: v,
      unit: unit.trim() || null,
      higher_is_better: higher,
      details: details.trim() || null,
      achieved_on: date,
    });
    setBusy(false);
    if (err) {
      setError("Couldn't save that. Try again.");
      return;
    }
    setOpen(false);
    if (firstEver || beat) {
      setCelebrate(
        firstEver
          ? `Logged your first “${nm}” 🌱 Now go beat it.`
          : `🎉 New best for “${nm}”! That's one to be proud of.`
      );
    }
    // Let the pod cheer a genuine new record (name only — never the number).
    // First-ever entries are just a baseline, so we don't broadcast those.
    if (beat && shareStats && podIds.length) {
      supabase
        .from("pod_pr_events")
        .insert(
          podIds.map((pid) => ({ pod_id: pid, user_id: userId, pb_name: nm }))
        )
        .then(() => {});
    }
    router.refresh();
  }

  return (
    <>
      <div className="mt-3 flex flex-col gap-2.5">
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card p-5 text-center">
            <div className="text-[28px]">🏆</div>
            <p className="mt-1.5 font-serif text-[16px] font-semibold text-ink">
              Log your first best
            </p>
            <p className="mx-auto mt-1 max-w-[280px] text-[13px] leading-relaxed text-muted">
              The longest plank, the heaviest lift, that incline walk. Record it
              here and chase it next month.
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <button
              key={g.name}
              onClick={() => openForName(g)}
              className="rounded-2xl border border-line bg-card p-4 text-left transition active:scale-[0.99]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 truncate text-[15px] font-semibold text-ink">
                  {g.name}
                </div>
                <div className="shrink-0 text-[12px] text-muted">
                  {fmtDate(g.record.achievedOn)}
                </div>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-serif text-[28px] font-semibold leading-none text-terra">
                  {fmtValue(g.record.value)}
                </span>
                {g.unit && (
                  <span className="text-[15px] font-medium text-muted">
                    {g.unit}
                  </span>
                )}
              </div>
              {g.record.details && (
                <div className="mt-1 text-[13px] text-muted">
                  {g.record.details}
                </div>
              )}
              <div className="mt-1.5 text-[12px] font-medium text-sage">
                {g.previous
                  ? `Beat your previous ${fmtValue(g.previous.value)}${
                      g.unit ? " " + g.unit : ""
                    } · tap to top it`
                  : "Tap to beat it"}
              </div>
            </button>
          ))
        )}

        <button
          onClick={openFresh}
          className="mt-1 w-full rounded-2xl border border-terra bg-terra/[0.06] py-3 text-[15px] font-semibold text-terra transition active:scale-[0.99]"
        >
          + Log a best
        </button>
      </div>

      {/* Celebration toast */}
      {celebrate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setCelebrate(null)}
        >
          <div className="absolute inset-0 bg-ink/40" />
          <div className="sheet-enter relative w-full max-w-[420px] rounded-t-[28px] bg-paper px-6 pb-9 pt-3 shadow-pod-lg">
            <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line" />
            <div className="py-6 text-center">
              <div className="text-[44px]">🏆</div>
              <p className="mx-auto mt-2 max-w-[300px] font-serif text-[20px] font-semibold leading-snug text-ink">
                {celebrate}
              </p>
              <button
                onClick={() => setCelebrate(null)}
                className="mt-6 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98]"
              >
                Nice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log sheet */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => !busy && setOpen(false)}
          />
          <div className="sheet-enter relative w-full max-w-[420px] rounded-t-[28px] bg-paper px-6 pb-9 pt-3 shadow-pod-lg">
            <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line" />

            <h2 className="font-serif text-[22px] font-semibold text-ink">
              Log a personal best
            </h2>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              Track one number to chase. Add the rest as details — reuse the
              same name next time to beat it.
            </p>

            <div className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                list="pb-names"
                placeholder="Name (e.g. Incline walk, Bench press, 5K)"
                className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted focus:border-terra"
              />
              <datalist id="pb-names">
                {existingNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>

              <div className="flex gap-3">
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  inputMode="decimal"
                  placeholder="Number"
                  className="w-1/2 rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted focus:border-terra"
                />
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Unit"
                  className="w-1/2 rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted focus:border-terra"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {UNIT_CHIPS.map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition active:scale-95 ${
                      unit === u
                        ? "bg-terra text-white"
                        : "bg-card text-ink-soft ring-1 ring-line"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>

              <div className="flex rounded-2xl bg-paper-2 p-1">
                <button
                  onClick={() => setHigher(true)}
                  className={`flex-1 rounded-xl py-2 text-[13px] font-semibold transition ${
                    higher ? "bg-card text-ink shadow-sm" : "text-muted"
                  }`}
                >
                  ↑ Higher is better
                </button>
                <button
                  onClick={() => setHigher(false)}
                  className={`flex-1 rounded-xl py-2 text-[13px] font-semibold transition ${
                    !higher ? "bg-card text-ink shadow-sm" : "text-muted"
                  }`}
                >
                  ↓ Lower is better
                </button>
              </div>

              <input
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Details (optional) — e.g. 25lb, 8% incline, 2.6mph"
                className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted focus:border-terra"
              />

              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="peer w-full rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none focus:border-terra"
                />
              </div>
            </div>

            {error && <p className="mt-3 text-[13px] text-terra">{error}</p>}

            <button
              onClick={save}
              disabled={busy}
              className="mt-5 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save best"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
