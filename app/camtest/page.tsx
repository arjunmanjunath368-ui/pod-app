"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// TEMPORARY diagnostic page. Confirms the live in-app camera works inside the
// installed Pod PWA, with correct orientation and a clean exit, before we wire
// it into the real log flow. Safe to delete once verified.
export default function CamTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [status, setStatus] = useState("Not started");
  const [error, setError] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [used, setUsed] = useState(false);
  const [diag, setDiag] = useState<Record<string, string>>({});

  const mirror = facing === "user";

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setDiag({
      "Installed app (standalone)": standalone
        ? "yes ✅"
        : "NO ⚠️ — open from the Pod app on your home screen",
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
    setUsed(false);
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
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Mirror the saved frame for the front camera so the photo matches the
    // selfie preview (otherwise it looks "flipped").
    if (mirror) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, c.width, c.height);
    setShot(c.toDataURL("image/jpeg", 0.9));
  }

  function usePhoto() {
    stopCamera();
    setUsed(true);
    setStatus("Photo used ✅ — camera stopped");
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Pod camera test</h1>
        <Link
          href="/app"
          onClick={stopCamera}
          style={{ color: "#e8b9ac", fontSize: 15, fontWeight: 600 }}
        >
          ← Back to Pod
        </Link>
      </div>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
        Temporary — checks the live camera + orientation. Use “← Back to Pod” to
        exit (no more killing the app).
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

      {used ? (
        <div
          style={{
            background: "rgba(122,148,113,0.18)",
            border: "1px solid #7a9471",
            borderRadius: 16,
            padding: 20,
            textAlign: "center",
            fontSize: 15,
            lineHeight: 1.6,
          }}
        >
          ✅ This is exactly what a verified log photo would save. Capture works
          end-to-end. Tell me if the orientation looks right, then I’ll wire this
          into the log flow.
          <div style={{ marginTop: 14 }}>
            <button onClick={() => start(facing)} style={btn("#2f4a37")}>
              Test again
            </button>
          </div>
        </div>
      ) : (
        <>
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
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: mirror ? "scaleX(-1)" : "none",
                }}
              />
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {!shot && (
              <>
                <button onClick={() => start(facing)} style={btn("#c8553d")}>
                  Start camera
                </button>
                <button onClick={flip} style={btn("#2f4a37")}>
                  Flip (front/back)
                </button>
                <button onClick={capture} style={btn("#2f4a37")}>
                  Capture
                </button>
                <button onClick={stopCamera} style={btn("#2f4a37")}>
                  Stop camera
                </button>
              </>
            )}
            {shot && (
              <>
                <button onClick={usePhoto} style={btn("#c8553d")}>
                  Use photo
                </button>
                <button onClick={() => start(facing)} style={btn("#2f4a37")}>
                  Retake
                </button>
              </>
            )}
          </div>
        </>
      )}

      <p style={{ fontSize: 13, opacity: 0.7, marginTop: 18, lineHeight: 1.6 }}>
        Check: front camera should look like a mirror (not flipped), and the
        captured photo should match the preview. Then tap <b>Use photo</b>.
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
