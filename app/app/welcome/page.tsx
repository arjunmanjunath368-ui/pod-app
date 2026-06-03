"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND_NAME, BRAND_MARK } from "@/lib/brand";

const PALETTE = ["#c8553d", "#7a9471", "#d9a441", "#4e8d7c", "#2f4a37"];

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

function colorFrom(name: string) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return PALETTE[sum % PALETTE.length];
}

export default function WelcomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [current, setCurrent] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [pod, setPod] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFrom(params.get("from"));
    setPod(params.get("pod"));
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const emailLocal = (user.email ?? "").split("@")[0];
      const dn = data?.display_name ?? "";
      if (dn && dn !== emailLocal && dn !== "New member") setCurrent(dn);
    })();
  }, []);

  async function save() {
    const display = (name.trim() || current).trim();
    if (display.length < 1) {
      setError("Pick something to be called.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: display,
        initials: initialsFrom(display),
        avatar_color: colorFrom(display),
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    const dest =
      from === "settings" ? `/app/settings${pod ? `?pod=${pod}` : ""}` : "/app";
    router.push(dest);
    router.refresh();
  }

  const editing = current.length > 0;

  return (
    <div className="flex flex-1 flex-col justify-center px-7 py-12">
      <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
        {BRAND_MARK} {BRAND_NAME}
      </div>
      <h1 className="mt-2 font-serif text-[28px] font-semibold leading-tight text-ink">
        {editing ? (
          <>Update your name</>
        ) : (
          <>
            What should your
            <br />
            pod call you?
          </>
        )}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        This is how you'll show up to the rest of your pod. Your real name, a
        nickname, whatever feels right — you can change it anytime.
      </p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder={current || "e.g. Arjun, AJ, Coach K"}
        maxLength={24}
        autoFocus
        className="mt-6 w-full rounded-2xl border border-line bg-card px-4 py-4 text-[16px] text-ink outline-none placeholder:text-muted/60 focus:border-terra"
      />
      {editing && (
        <p className="mt-2 text-[13px] text-muted">
          Leave it blank to keep "{current}".
        </p>
      )}

      {error && <p className="mt-3 text-[13px] text-terra">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="mt-5 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {saving ? "Saving…" : editing ? "Save name" : "That's me"}
      </button>
    </div>
  );
}
