"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PRESETS = [
  "Honestly, it's the feel-good factor",
  "Lose weight",
  "Build muscle",
  "More stamina",
  "Get leaner",
  "More athletic",
  "Show up more often",
  "Better sleep",
  "Stress relief",
];

const MAX_GOALS = 8;

export default function MyGoals({
  userId,
  initial,
}: {
  userId: string;
  initial: string[];
}) {
  const [goals, setGoals] = useState<string[]>(initial ?? []);
  const [editing, setEditing] = useState((initial ?? []).length === 0);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  async function persist(next: string[]) {
    setGoals(next);
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ personal_goals: next })
      .eq("id", userId);
    setBusy(false);
  }

  function add(raw: string) {
    const v = raw.trim();
    if (!v) return;
    if (goals.some((g) => g.toLowerCase() === v.toLowerCase())) return;
    if (goals.length >= MAX_GOALS) return;
    persist([...goals, v]);
  }

  function remove(g: string) {
    persist(goals.filter((x) => x !== g));
  }

  function save() {
    if (custom.trim()) add(custom);
    setCustom("");
    setEditing(false);
  }

  const available = PRESETS.filter(
    (p) => !goals.some((g) => g.toLowerCase() === p.toLowerCase())
  );

  // ---------- Collapsed view ----------
  if (!editing) {
    return (
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          {goals.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {goals.map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-terra/[0.10] px-3 py-1.5 text-[15px] font-semibold text-terra"
                >
                  {g}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-muted">
              No goals yet — add what you're working toward.
            </p>
          )}
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 text-[13px] font-semibold text-terra"
          >
            {goals.length > 0 ? "Edit" : "Add"}
          </button>
        </div>
      </div>
    );
  }

  // ---------- Editing view ----------
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      {goals.length === 0 ? (
        <p className="text-[15px] text-muted">
          What are you working toward? Add a few — they're just for you, not
          scored.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {goals.map((g) => (
            <span
              key={g}
              className="inline-flex items-center gap-1.5 rounded-full bg-terra/[0.10] py-1.5 pl-3 pr-2 text-[15px] font-semibold text-terra"
            >
              {g}
              <button
                onClick={() => remove(g)}
                disabled={busy}
                aria-label={`Remove ${g}`}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-terra/20 text-[12px] leading-none text-terra"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {goals.length < MAX_GOALS && available.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
            Add a goal
          </div>
          <div className="flex flex-wrap gap-2">
            {available.slice(0, 6).map((p) => (
              <button
                key={p}
                onClick={() => add(p)}
                disabled={busy}
                className="rounded-full border border-line bg-paper-2/60 px-3 py-1.5 text-[13px] font-medium text-ink-soft transition active:scale-95"
              >
                + {p}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  add(custom);
                  setCustom("");
                }
              }}
              placeholder="Something else…"
              maxLength={40}
              className="min-w-0 flex-1 rounded-xl border border-line bg-paper-2/40 px-3 py-2 text-[15px] text-ink outline-none focus:border-terra"
            />
            <button
              onClick={() => {
                add(custom);
                setCustom("");
              }}
              disabled={busy || !custom.trim()}
              className="rounded-xl border border-line bg-paper-2/60 px-4 py-2 text-[15px] font-semibold text-ink-soft transition active:scale-95 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <button
        onClick={save}
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-ink py-3 text-[15px] font-semibold text-paper transition active:scale-[0.99] disabled:opacity-60"
      >
        Save
      </button>
    </div>
  );
}
