"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITIES, type ActivityKey } from "@/lib/activities";

export default function LogSheet({
  open,
  onClose,
  podId,
  userId,
  defaultActivity,
}: {
  open: boolean;
  onClose: () => void;
  podId: string;
  userId: string;
  defaultActivity?: ActivityKey;
}) {
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityKey>(
    defaultActivity ?? "strength"
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!open) return null;

  async function logIt() {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.from("sessions").insert({
      pod_id: podId,
      user_id: userId,
      activity,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      setDone(false);
      setNote("");
      onClose();
      router.refresh();
    }, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={() => !saving && onClose()}
      />
      <div className="sheet-enter relative w-full max-w-[420px] rounded-t-[28px] bg-paper px-6 pb-9 pt-3 shadow-pod-lg">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line" />

        {done ? (
          <div className="py-8 text-center">
            <div className="text-[40px]">✅</div>
            <p className="mt-2 font-serif text-[22px] font-semibold text-ink">
              Logged. Nice.
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Your pod sees you showed up.
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-[22px] font-semibold text-ink">
              Log a session
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              What did you do? This counts toward your week.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {ACTIVITIES.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setActivity(a.key)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition ${
                    activity === a.key
                      ? "border-terra bg-terra/[0.06]"
                      : "border-line bg-card"
                  }`}
                >
                  <span className="text-[22px]">{a.emoji}</span>
                  <span className="text-[12px] font-semibold text-ink">
                    {a.label}
                  </span>
                </button>
              ))}
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional) — how'd it go?"
              rows={2}
              maxLength={140}
              className="mt-4 w-full resize-none rounded-2xl border border-line bg-card px-4 py-3 text-[14px] text-ink outline-none focus:border-terra"
            />

            {error && <p className="mt-3 text-[12.5px] text-terra">{error}</p>}

            <button
              onClick={logIt}
              disabled={saving}
              className="mt-4 w-full rounded-2xl bg-terra py-4 text-[15.5px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? "Logging…" : "Log it"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
