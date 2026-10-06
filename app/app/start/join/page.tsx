"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function JoinPodPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [back, setBack] = useState("/app");
  // Set when the pod has a photo rule: the person must agree before joining.
  const [rule, setRule] = useState<{ name: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const f = params.get("from");
    setBack(
      f === "you" ? "/app/you" : f === "start" ? "/app/start" : "/app"
    );
    const c = params.get("code");
    if (c) setCode(c.toUpperCase());
  }, []);

  async function join() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter the invite code.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();

    // If the pod requires a live photo with every workout, say so BEFORE joining
    // and wait for an explicit "I agree". (If the preview can't run, fall
    // through to a normal join — the rule is also shown inside the pod.)
    if (!rule) {
      const { data: prev, error: prevErr } = await supabase.rpc(
        "pod_join_preview",
        { p_code: trimmed }
      );
      const row: any = Array.isArray(prev) ? prev[0] : prev;
      if (!prevErr && row?.proof_mode === "photo") {
        setRule({ name: row.pod_name ?? "This pod" });
        setLoading(false);
        return;
      }
    }

    const { data, error } = await supabase.rpc("join_pod", { p_code: trimmed });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    let podId = typeof data === "string" ? data : null;
    if (!podId) {
      const { data: pod } = await supabase
        .from("pods")
        .select("id")
        .eq("invite_code", trimmed)
        .maybeSingle();
      podId = pod?.id ?? null;
    }
    setLoading(false);
    router.push(podId ? `/app/goal?pod=${podId}&onboarding=1` : "/app");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col px-7 py-10">
      <Link href={back} className="text-[15px] font-semibold text-muted">
        ← Back
      </Link>

      <h1 className="mt-6 font-serif text-[26px] font-semibold text-ink">
        Join a pod
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        Paste the 6-character code whoever started the pod shared with you.
      </p>

      <input
        value={code}
        onChange={(e) => {
          setCode(e.target.value.toUpperCase());
          setRule(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && join()}
        placeholder="A1B2C3"
        maxLength={6}
        className="mt-5 w-full rounded-2xl border border-line bg-card px-4 py-4 text-center font-serif text-[26px] font-semibold tracking-[0.3em] text-ink outline-none focus:border-terra"
      />

      {rule && (
        <div className="mt-5 rounded-2xl border border-terra/40 bg-terra/[0.06] p-4">
          <div className="text-[15px] font-semibold text-ink">
            📸 {rule.name} requires a live photo
          </div>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
            Every workout you log in this pod needs a photo taken in the app —
            no camera roll. Joining means you agree to that.
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-[13px] text-terra">{error}</p>}

      <button
        onClick={join}
        disabled={loading}
        className="mt-6 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? "Joining…" : rule ? "I agree — join pod" : "Join pod"}
      </button>
      {rule && (
        <button
          onClick={() => setRule(null)}
          className="mt-3 w-full py-2 text-[14px] font-semibold text-muted"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
