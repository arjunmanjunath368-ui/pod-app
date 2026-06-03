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
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && join()}
        placeholder="A1B2C3"
        maxLength={6}
        className="mt-5 w-full rounded-2xl border border-line bg-card px-4 py-4 text-center font-serif text-[26px] font-semibold tracking-[0.3em] text-ink outline-none focus:border-terra"
      />

      {error && <p className="mt-4 text-[13px] text-terra">{error}</p>}

      <button
        onClick={join}
        disabled={loading}
        className="mt-6 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? "Joining…" : "Join pod"}
      </button>
    </div>
  );
}
