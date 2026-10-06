"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const SIZES = [
  { label: "Duo", value: 2, hint: "Just the two of you" },
  { label: "Up to 4", value: 4, hint: "Small circle" },
  { label: "Up to 8", value: 8, hint: "Bigger crew" },
];

export default function CreatePodPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [max, setMax] = useState(4);
  // "Live photo with every workout" — a rule the pod is created with, and which
  // joiners see before they join. Off by default; it can't be changed later.
  const [proof, setProof] = useState(false);
  // Set if the pod was created but the photo rule couldn't be saved, so the
  // creator is told instead of silently ending up with a pod that lacks it.
  const [partial, setPartial] = useState<{ podId: string | null; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [back, setBack] = useState("/app");

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("from");
    setBack(
      f === "you" ? "/app/you" : f === "start" ? "/app/start" : "/app"
    );
  }, []);

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
    const { data, error } = await supabase.rpc("create_pod", {
      p_name: trimmed,
      p_max: max,
      p_tz: tz,
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    let podId = typeof data === "string" ? data : null;
    if (!podId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: mem } = await supabase
          .from("pod_members")
          .select("pod_id")
          .eq("user_id", user.id)
          .order("joined_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        podId = mem?.pod_id ?? null;
      }
    }
    if (proof && !podId) {
      // Created, but we couldn't tell which pod — don't silently drop the rule.
      setLoading(false);
      setPartial({ podId: null, message: "couldn't find the new pod" });
      return;
    }
    if (proof && podId) {
      const { error: proofErr } = await supabase.rpc("set_pod_proof_mode", {
        p_pod_id: podId,
        p_mode: "photo",
      });
      if (proofErr) {
        setLoading(false);
        setPartial({ podId, message: proofErr.message });
        return;
      }
    }
    setLoading(false);
    router.push(podId ? `/app/goal?pod=${podId}&onboarding=1` : "/app");
    router.refresh();
  }

  function continueWithoutRule() {
    if (!partial) return;
    router.push(
      partial.podId ? `/app/goal?pod=${partial.podId}&onboarding=1` : "/app"
    );
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col px-7 py-10">
      <Link href={back} className="text-[15px] font-semibold text-muted">
        ← Back
      </Link>

      <h1 className="mt-6 font-serif text-[26px] font-semibold text-ink">
        Name your pod
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        Something your circle will recognize — "The Sharma Pod", "Morning
        Crew", whatever fits.
      </p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="The Sharma Pod"
        maxLength={40}
        className="mt-5 w-full rounded-2xl border border-line bg-card px-4 py-4 text-[16px] text-ink outline-none focus:border-terra"
      />

      <div className="mt-7 text-[13px] font-semibold uppercase tracking-wide text-muted">
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
              <div className="text-[16px] font-semibold text-ink">
                {s.label}
              </div>
              <div className="text-[13px] text-muted">{s.hint}</div>
            </div>
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[15px] text-white ${
                max === s.value ? "bg-terra" : "bg-line"
              }`}
            >
              {max === s.value ? "✓" : ""}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-7 text-[13px] font-semibold uppercase tracking-wide text-muted">
        Rules
      </div>
      <button
        onClick={() => setProof(!proof)}
        disabled={!!partial}
        className={`mt-3 flex w-full items-start justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition ${
          proof ? "border-terra bg-terra/[0.06]" : "border-line bg-card"
        }`}
      >
        <div>
          <div className="text-[16px] font-semibold text-ink">
            📸 Require a live photo
          </div>
          <div className="mt-0.5 text-[13px] leading-relaxed text-muted">
            Every workout needs a photo taken in the app — no camera roll.
            Anyone joining sees this first, and it can&apos;t be changed later.
          </div>
          <div className="mt-1 text-[12px] text-muted">
            More accountability, a bit more effort per log. Off by default.
          </div>
        </div>
        <div
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[15px] text-white ${
            proof ? "bg-terra" : "bg-line"
          }`}
        >
          {proof ? "✓" : ""}
        </div>
      </button>

      {error && <p className="mt-4 text-[13px] text-terra">{error}</p>}

      {partial ? (
        <div className="mt-5 rounded-2xl border border-terra/40 bg-terra/[0.06] p-4">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            Your pod was created, but the photo rule didn&apos;t save (
            {partial.message}). You can continue without it.
          </p>
          <button
            onClick={continueWithoutRule}
            className="mt-3 w-full rounded-2xl bg-ink py-3.5 text-[15px] font-semibold text-paper active:scale-[0.98]"
          >
            Continue
          </button>
        </div>
      ) : (
        <button
          onClick={create}
          disabled={loading}
          className="mt-7 w-full rounded-2xl bg-ink py-4 text-[16px] font-semibold text-paper transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create pod"}
        </button>
      )}
    </div>
  );
}
