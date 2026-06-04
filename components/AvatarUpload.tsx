"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Cropper from "react-easy-crop";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

type Area = { x: number; y: number; width: number; height: number };

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (e) => reject(e));
    image.src = url;
  });
}

async function getCroppedBlob(src: string, area: Area): Promise<Blob | null> {
  const image = await createImage(src);
  const size = Math.min(512, Math.round(area.width));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85)
  );
}

async function compressOriginal(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1024;
    let { width, height } = bitmap;
    if (width >= height && width > maxDim) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else if (height > maxDim) {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85)
    );
  } catch {
    return file;
  }
}

export default function AvatarUpload({
  userId,
  hasPhoto,
  avatarUrl,
  sourceUrl,
  displayName,
  initials,
  color,
}: {
  userId: string;
  hasPhoto: boolean;
  avatarUrl: string | null;
  sourceUrl: string | null;
  displayName: string;
  initials: string;
  color: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [origFile, setOrigFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onCropComplete = useCallback((_a: Area, areaPx: Area) => {
    setAreaPixels(areaPx);
  }, []);

  function resetControls() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setError("");
  }

  function pickNew() {
    fileRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    resetControls();
    setIsNew(true);
    setOrigFile(f);
    const reader = new FileReader();
    reader.onload = () => setSrc(reader.result as string);
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  async function editExisting() {
    const u = sourceUrl || avatarUrl;
    if (!u) return;
    resetControls();
    setIsNew(false);
    setOrigFile(null);
    try {
      const res = await fetch(u);
      const blob = await res.blob();
      setSrc(URL.createObjectURL(blob));
    } catch {
      setError("Couldn't load your photo. Use Change photo instead.");
      setSrc(avatarUrl); // fall back so the editor still opens
    }
  }

  function close() {
    if (src && src.startsWith("blob:")) URL.revokeObjectURL(src);
    setSrc(null);
    setError("");
  }

  async function save() {
    if (!src || !areaPixels) return;
    setBusy(true);
    setError("");
    const blob = await getCroppedBlob(src, areaPixels);
    if (!blob) {
      setBusy(false);
      setError("Couldn't process that image. Try another.");
      return;
    }
    const supabase = createClient();
    const cropPath = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(cropPath, blob, { contentType: "image/jpeg", upsert: false });
    if (upErr) {
      setBusy(false);
      setError("Upload failed: " + upErr.message);
      return;
    }
    const newAvatarUrl = supabase.storage.from("avatars").getPublicUrl(cropPath)
      .data.publicUrl;

    const updates: { avatar_url: string; avatar_source_url?: string } = {
      avatar_url: newAvatarUrl,
    };
    if (isNew && origFile) {
      const srcBlob = await compressOriginal(origFile);
      const srcPath = `${userId}/src-${crypto.randomUUID()}.jpg`;
      const { error: srcErr } = await supabase.storage
        .from("avatars")
        .upload(srcPath, srcBlob, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (!srcErr) {
        updates.avatar_source_url = supabase.storage
          .from("avatars")
          .getPublicUrl(srcPath).data.publicUrl;
      }
    }

    const { error: updErr } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);
    setBusy(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    close();
    router.refresh();
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />

      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Avatar url={avatarUrl} initials={initials} color={color} size={56} />
          <button
            onClick={hasPhoto ? editExisting : pickNew}
            aria-label={hasPhoto ? "Edit photo" : "Add a photo"}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-paper bg-terra text-white shadow-pod transition active:scale-95"
          >
            {hasPhoto ? (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
          </button>
        </div>
        <h1 className="min-w-0 font-serif text-[24px] font-semibold leading-tight text-ink">
          {displayName}
        </h1>
      </div>

      {src && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-ink/50" onClick={close} />
          <div className="sheet-enter relative w-full max-w-[420px] rounded-t-[28px] bg-paper px-6 pb-8 pt-3 shadow-pod-lg">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
            <button
              onClick={close}
              aria-label="Close"
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-paper-2 text-ink-soft transition active:scale-95"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>

            <h2 className="font-serif text-[20px] font-semibold text-ink">
              Frame your photo
            </h2>
            <p className="mt-1 text-[14px] text-muted">
              Drag to move, pinch or use the slider to zoom.
            </p>

            <div className="relative mt-4 h-64 w-full overflow-hidden rounded-2xl bg-ink">
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="mt-4">
              <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">
                Zoom
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-terra"
              />
            </div>

            {error && <p className="mt-3 text-[13px] text-terra">{error}</p>}

            <div className="mt-5 flex gap-3">
              <button
                onClick={pickNew}
                disabled={busy}
                className="flex-1 rounded-2xl border border-line bg-card py-3.5 text-[15px] font-semibold text-ink-soft transition active:scale-[0.98] disabled:opacity-60"
              >
                Change photo
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 rounded-2xl bg-terra py-3.5 text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
