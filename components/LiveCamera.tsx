"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Live in-app camera for staked-workout verification. No gallery access — the
// photo must be captured here, now. Hands a JPEG File back to the parent on
// "Use photo". If the camera can't run (permission denied / unavailable), it
// reports the error so the log flow can fall back to an unverified save rather
// than hard-blocking the user.
export default function LiveCamera({
  open,
  onClose,
  onCapture,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File, dataUrl: string) => void;
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [shot, setShot] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const mirror = facing === "user";

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (f: "user" | "environment") => {
      setShot(null);
      setReady(false);
      stop();
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
        setReady(true);
      } catch (e: any) {
        stop();
        onError(`${e?.name ?? "CameraError"}: ${e?.message ?? String(e)}`);
      }
    },
    [stop, onError]
  );

  useEffect(() => {
    if (!open) return;
    setFacing("user");
    start("user");
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function flip() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    start(next);
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    if (mirror) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, c.width, c.height);
    setShot(c.toDataURL("image/jpeg", 0.9));
    stop();
  }

  function usePhoto() {
    if (!shot) return;
    const c = document.createElement("canvas");
    const img = new Image();
    img.onload = () => {
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")?.drawImage(img, 0, 0);
      c.toBlob(
        (blob) => {
          if (!blob) return;
          const file = new File([blob], `live-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          onCapture(file, shot);
        },
        "image/jpeg",
        0.9
      );
    };
    img.src = shot;
  }

  function close() {
    stop();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          onClick={close}
          className="text-[15px] font-semibold text-white/80"
        >
          Cancel
        </button>
        <div className="text-[13px] font-medium text-white/70">
          Live photo · proves you showed up
        </div>
        <div className="w-[52px]" />
      </div>

      {/* Viewfinder */}
      <div className="relative mx-auto flex w-full max-w-[480px] flex-1 items-center justify-center overflow-hidden">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt="" className="h-full w-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-contain"
            style={{ transform: mirror ? "scaleX(-1)" : "none" }}
          />
        )}
      </div>

      {/* Controls */}
      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4">
        {shot ? (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => start(facing)}
              className="flex-1 rounded-2xl border border-white/25 py-4 text-[16px] font-semibold text-white active:scale-[0.98]"
            >
              Retake
            </button>
            <button
              onClick={usePhoto}
              className="flex-1 rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white active:scale-[0.98]"
            >
              Use photo
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="w-[64px]" />
            <button
              onClick={capture}
              disabled={!ready}
              aria-label="Capture"
              className="h-[74px] w-[74px] rounded-full border-[5px] border-white bg-white/20 active:scale-95 disabled:opacity-40"
            />
            <button
              onClick={flip}
              className="w-[64px] text-[14px] font-semibold text-white/80"
            >
              Flip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
