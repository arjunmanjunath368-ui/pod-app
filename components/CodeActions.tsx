"use client";

import { useEffect, useState } from "react";

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

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
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
    const text = `Join my Pod "${podName}" — open the app and enter invite code ${code}.`;
    try {
      await navigator.share({ title: "Join my Pod", text });
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
