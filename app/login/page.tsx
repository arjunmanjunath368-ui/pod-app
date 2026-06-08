"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { BRAND_NAME, BRAND_MARK } from "@/lib/brand";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [next, setNext] = useState("/app");

  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("next");
    if (n && n.startsWith("/")) setNext(n);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
  }

  async function sendLink() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          // Sign in = existing accounts only; Sign up = create if new.
          shouldCreateUser: mode === "signup",
          emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(
            next
          )}`,
        },
      });
      if (error) {
        // Only call it "not found" when the error actually says so — otherwise
        // surface the real reason (e.g. email delivery / rate limit).
        const looksMissing =
          mode === "signin" &&
          /not allowed|not found|no .*user|sign ?up|does not exist/i.test(
            error.message
          );
        setError(
          looksMissing
            ? "We couldn't find an account for that email."
            : error.message
        );
        return;
      }
      setSent(true);
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Verifying the emailed code completes sign-in INSIDE whatever context the
  // user is in — crucially, the installed PWA, which has its own cookie jar the
  // emailed magic link can't reach.
  async function verify() {
    const token = code.trim();
    if (token.length < 6) return;
    setVerifying(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: "email",
      });
      if (error) {
        setError(
          /expired|invalid|token/i.test(error.message)
            ? "That code's expired or already used — tap Resend for a fresh one."
            : error.message
        );
        return;
      }
      // Full navigation so the middleware picks up the freshly-set cookies.
      window.location.href = next;
    } catch (e: any) {
      setError(e?.message || "Couldn't verify that code. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  // Request a brand-new code without leaving the code screen.
  async function resend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    setResendNote("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: mode === "signup",
          emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(
            next
          )}`,
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      setCode("");
      setResendNote("New code sent — check your email.");
      setCooldown(30);
    } catch (e: any) {
      setError(e?.message || "Couldn't resend. Please try again.");
    } finally {
      setResending(false);
    }
  }

  const isSignup = mode === "signup";

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
            Everyone chases their own goal — let's get each other moving. The
            only thing you compete on is showing up.
          </p>
        </div>

        {!sent ? (
          <div>
            <h2 className="font-serif text-[22px] font-semibold text-ink">
              {isSignup ? "Create your account" : "Sign in to Pod"}
            </h2>
            <p className="mt-1 text-[14px] text-muted">
              {isSignup
                ? "Set up your account to start a pod or join one."
                : "Enter your email and we'll send you a link."}
            </p>

            <label className="mb-2 mt-6 block text-[13px] font-semibold text-muted">
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
              {loading
                ? "Sending…"
                : isSignup
                  ? "Email me a code to sign up"
                  : "Email me a sign-in code"}
            </button>

            <p className="mt-5 text-center text-[13px] leading-relaxed text-muted">
              No passwords —{" "}
              {isSignup
                ? "we'll email you a one-time code to set up your account."
                : "we'll email you a one-time code to sign in."}
            </p>

            <div className="mt-6 border-t border-line pt-5 text-center text-[14px] text-muted">
              {isSignup ? (
                <>
                  Already an existing user?{" "}
                  <button
                    onClick={() => switchMode("signin")}
                    className="font-semibold text-terra"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  New to {BRAND_NAME}?{" "}
                  <button
                    onClick={() => switchMode("signup")}
                    className="font-semibold text-terra"
                  >
                    Create an account today
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-card p-6 shadow-pod">
            <div className="text-center">
              <div className="text-[34px]">📬</div>
              <h2 className="mt-2 font-serif text-[21px] font-semibold text-ink">
                Enter your code
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                We emailed a code to{" "}
                <b className="text-ink">{email}</b>. Enter it here to{" "}
                {isSignup ? "set up your account" : "sign in"} — that keeps you
                in the app.
              </p>
            </div>

            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder="Enter code"
              className="mt-5 w-full rounded-2xl border border-line bg-paper-2/60 px-4 py-4 text-center text-[22px] font-semibold tracking-[0.28em] text-ink outline-none placeholder:text-[16px] placeholder:tracking-normal placeholder:font-normal focus:border-terra"
            />

            {error && (
              <p className="mt-3 text-center text-[13px] text-terra">{error}</p>
            )}
            {resendNote && !error && (
              <p className="mt-3 text-center text-[13px] text-sage">
                {resendNote}
              </p>
            )}

            <button
              onClick={verify}
              disabled={verifying || code.trim().length < 6}
              className="mt-4 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {verifying ? "Verifying…" : isSignup ? "Create my account" : "Sign in"}
            </button>

            <button
              onClick={resend}
              disabled={resending || cooldown > 0}
              className="mt-3 w-full text-center text-[14px] font-semibold text-terra disabled:opacity-50"
            >
              {resending
                ? "Sending…"
                : cooldown > 0
                  ? `Resend code in ${cooldown}s`
                  : "Resend code"}
            </button>

            <p className="mt-4 text-center text-[13px] leading-relaxed text-muted">
              Only the most recent code works — if you tap Resend, use the new
              one.
            </p>
            <button
              onClick={() => {
                setSent(false);
                setEmail("");
                setCode("");
                setError("");
                setResendNote("");
              }}
              className="mt-3 w-full text-center text-[14px] font-semibold text-muted"
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
