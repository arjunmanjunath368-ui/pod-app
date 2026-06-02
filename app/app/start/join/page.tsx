"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function JoinPodPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter the invite code.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.rpc("join_pod", { p_code: trimmed });
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
        Join a pod
      </h1>
      <p className="mt-2 text-[13.5px] text-muted">
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

      {error && <p className="mt-4 text-[12.5px] text-terra">{error}</p>}

      <button
        onClick={join}
        disabled={loading}
        className="mt-6 w-full rounded-2xl bg-terra py-4 text-[15.5px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? "Joining…" : "Join pod"}
      </button>
    </div>
  );
}
