"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const SIZES = [
  { label: "Couple", value: 2, hint: "Just the two of you" },
  { label: "Up to 4", value: 4, hint: "Small circle" },
  { label: "Up to 8", value: 8, hint: "Bigger crew" },
];

export default function CreatePodPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [max, setMax] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give your pod a name.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const tz =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
    const { error } = await supabase.rpc("create_pod", {
      p_name: trimmed,
      p_max: max,
      p_tz: tz,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col px-7 py-10">
      <Link href="/app/start" className="text-[13px] font-semibold text-muted">
        ← Back
      </Link>

      <h1 className="mt-6 font-serif text-[26px] font-semibold text-ink">
        Name your pod
      </h1>
      <p className="mt-2 text-[13.5px] text-muted">
        Something your circle will recognize — "The Sharma Pod", "Morning
        Crew", whatever fits.
      </p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="The Sharma Pod"
        maxLength={40}
        className="mt-5 w-full rounded-2xl border border-line bg-card px-4 py-4 text-[15px] text-ink outline-none focus:border-terra"
      />

      <div className="mt-7 text-[12.5px] font-semibold uppercase tracking-wide text-muted">
        Pod size
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {SIZES.map((s) => (
          <button
            key={s.value}
            onClick={() => setMax(s.value)}
            className={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition ${
              max === s.value
                ? "border-terra bg-terra/[0.06]"
                : "border-line bg-card"
            }`}
          >
            <div>
              <div className="text-[15px] font-semibold text-ink">
                {s.label}
              </div>
              <div className="text-[12px] text-muted">{s.hint}</div>
            </div>
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[13px] text-white ${
                max === s.value ? "bg-terra" : "bg-line"
              }`}
            >
              {max === s.value ? "✓" : ""}
            </div>
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-[12.5px] text-terra">{error}</p>}

      <button
        onClick={create}
        disabled={loading}
        className="mt-7 w-full rounded-2xl bg-ink py-4 text-[15.5px] font-semibold text-paper transition active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create pod"}
      </button>
    </div>
  );
}
