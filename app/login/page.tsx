"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { BRAND_NAME, BRAND_MARK } from "@/lib/brand";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [next, setNext] = useState("/app");

  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("next");
    if (n && n.startsWith("/")) setNext(n);
  }, []);

  async function sendLink() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(
          next
        )}`,
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="phone">
      <div className="flex flex-1 flex-col justify-center px-7 py-12">
        <div className="mb-8 rounded-[28px] bg-ink p-7 text-paper shadow-pod-lg">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-sage-soft">
            {BRAND_MARK} {BRAND_NAME}
          </div>
          <h1 className="mt-2 font-serif text-[30px] font-semibold leading-[1.1]">
            Fitness with
            <br />
            your people.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-sage-soft">
            Everyone in your pod chases their own goal. You only compete on one
            thing — who shows up.
          </p>
        </div>

        {!sent ? (
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-muted">
              Email
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
              placeholder="you@email.com"
              className="w-full rounded-2xl border border-line bg-card px-4 py-4 text-[16px] text-ink outline-none focus:border-terra"
            />
            {error && <p className="mt-3 text-[13px] text-terra">{error}</p>}
            <button
              onClick={sendLink}
              disabled={loading}
              className="mt-4 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send me a magic link"}
            </button>
            <p className="mt-5 text-center text-[13px] leading-relaxed text-muted">
              No passwords. We email you a link that signs you straight in.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-card p-6 text-center shadow-pod">
            <div className="text-[34px]">📬</div>
            <h2 className="mt-2 font-serif text-[21px] font-semibold text-ink">
              Check your email
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              We sent a sign-in link to <b className="text-ink">{email}</b>. Tap
              it on this device to get into your pod.
            </p>
            <button
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="mt-5 text-[15px] font-semibold text-terra"
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
