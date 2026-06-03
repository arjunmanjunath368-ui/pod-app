"use client";

import { useEffect, useState } from "react";
import { BRAND_NAME, BRAND_MARK } from "@/lib/brand";

export default function CodeActions({
  code,
  podName,
}: {
  code: string;
  podName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  function buildMessage() {
    const appUrl =
      typeof window !== "undefined" ? window.location.origin : "";
    return (
      `Join my pod "${podName}" on ${BRAND_NAME} ${BRAND_MARK}\n` +
      `Open ${appUrl} and sign in, then enter invite code ${code}.`
    );
  }

  async function copy() {
    const message = buildMessage();
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = message;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function share() {
    try {
      await navigator.share({ title: "Join my pod", text: buildMessage() });
    } catch {
      // user cancelled or share unavailable — no-op
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={copy}
        className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-paper transition active:scale-95"
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
      {canShare && (
        <button
          onClick={share}
          className="flex items-center gap-1.5 rounded-full bg-terra px-3 py-1.5 text-[12px] font-semibold text-white transition active:scale-95"
        >
          Share
        </button>
      )}
    </div>
  );
}
