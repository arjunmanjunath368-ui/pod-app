"use client";

import { useEffect, useRef, useState } from "react";

// TEMPORARY diagnostic page. Confirms the live in-app camera (getUserMedia)
// actually works inside the installed Pod PWA before we build photo
// verification for real. Safe to delete once verified.
export default function CamTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [status, setStatus] = useState("Not started");
  const [error, setError] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [diag, setDiag] = useState<Record<string, string>>({});

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setDiag({
      "Installed app (standalone)": standalone
        ? "yes ✅"
        : "NO ⚠️ — open this from the Pod app on your home screen",
      "Camera API":
        typeof navigator.mediaDevices?.getUserMedia === "function"
          ? "available ✅"
          : "MISSING ❌",
      "Secure (https)": window.isSecureContext ? "yes ✅" : "NO ❌",
    });
    return () => stopCamera();
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function start(f: "user" | "environment") {
    setError("");
    setShot(null);
    setStatus("Starting…");
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: f },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const s = stream.getVideoTracks()[0]?.getSettings();
      setStatus(
        `Live ✅  ${s?.width ?? "?"}×${s?.height ?? "?"} · ${s?.facingMode ?? f}`
      );
    } catch (e: any) {
      setStatus("Failed ❌");
      setError(`${e?.name ?? "Error"}: ${e?.message ?? String(e)}`);
    }
  }

  function flip() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    start(next);
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setError("No live frame yet — tap Start camera first.");
      return;
    }
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    setShot(c.toDataURL("image/jpeg", 0.9));
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0f1a12",
        color: "#f4f0e6",
        padding: "20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        Pod camera test
      </h1>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
        Temporary — checks the live camera works in the installed app.
      </p>

      <div
        style={{
          background: "rgba(255,255,255,0.06)",
          borderRadius: 14,
          padding: 12,
          fontSize: 13,
          lineHeight: 1.7,
          marginBottom: 16,
        }}
      >
        {Object.entries(diag).map(([k, v]) => (
          <div key={k}>
            <strong>{k}:</strong> {v}
          </div>
        ))}
        <div>
          <strong>Status:</strong> {status}
        </div>
        {error && (
          <div style={{ color: "#ff9b86", marginTop: 6 }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "3 / 4",
          background: "#000",
          borderRadius: 16,
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shot}
            alt="captured"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => start(facing)} style={btn("#c8553d")}>
          Start camera
        </button>
        <button onClick={flip} style={btn("#2f4a37")}>
          Flip (front/back)
        </button>
        <button onClick={capture} style={btn("#2f4a37")}>
          Capture
        </button>
        {shot && (
          <button onClick={() => start(facing)} style={btn("#2f4a37")}>
            Retake
          </button>
        )}
      </div>

      <p style={{ fontSize: 13, opacity: 0.7, marginTop: 18, lineHeight: 1.6 }}>
        Success = tapping <b>Start camera</b> shows a live feed, <b>Flip</b>{" "}
        switches front/back, and <b>Capture</b> freezes a photo. Tell me what you
        see (and any red error text).
      </p>
    </main>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: "#f4f0e6",
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: 600,
  };
}
