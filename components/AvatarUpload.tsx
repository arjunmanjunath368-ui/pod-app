"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Cropper from "react-easy-crop";
import { createClient } from "@/lib/supabase/client";

type Area = { x: number; y: number; width: number; height: number };

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (e) => reject(e));
    image.src = url;
  });
}

function rad(deg: number) {
  return (deg * Math.PI) / 180;
}

function rotatedSize(w: number, h: number, rotation: number) {
  const r = rad(rotation);
  return {
    width: Math.abs(Math.cos(r) * w) + Math.abs(Math.sin(r) * h),
    height: Math.abs(Math.sin(r) * w) + Math.abs(Math.cos(r) * h),
  };
}

// Render the cropped + rotated region into a square JPEG (max 512px).
async function getCroppedBlob(
  imageSrc: string,
  crop: Area,
  rotation: number
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const { width: bw, height: bh } = rotatedSize(
    image.width,
    image.height,
    rotation
  );
  canvas.width = bw;
  canvas.height = bh;
  ctx.translate(bw / 2, bh / 2);
  ctx.rotate(rad(rotation));
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const data = ctx.getImageData(crop.x, crop.y, crop.width, crop.height);

  const tmp = document.createElement("canvas");
  tmp.width = crop.width;
  tmp.height = crop.height;
  tmp.getContext("2d")?.putImageData(data, 0, 0);

  const size = Math.min(512, Math.round(crop.width));
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  out
    .getContext("2d")
    ?.drawImage(tmp, 0, 0, crop.width, crop.height, 0, 0, size, size);

  return new Promise((resolve) =>
    out.toBlob((b) => resolve(b), "image/jpeg", 0.85)
  );
}

export default function AvatarUpload({
  userId,
  hasPhoto,
}: {
  userId: string;
  hasPhoto: boolean;
}) {
  const router = useRouter();
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onCropComplete = useCallback((_a: Area, areaPx: Area) => {
    setAreaPixels(areaPx);
  }, []);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    const reader = new FileReader();
    reader.onload = () => setSrc(reader.result as string);
    reader.readAsDataURL(f);
    e.target.value = ""; // allow re-picking the same file later
  }

  function cancel() {
    setSrc(null);
    setError("");
  }

  async function save() {
    if (!src || !areaPixels) return;
    setBusy(true);
    setError("");
    const blob = await getCroppedBlob(src, areaPixels, rotation);
    if (!blob) {
      setBusy(false);
      setError("Couldn't process that image. Try another.");
      return;
    }
    const supabase = createClient();
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (upErr) {
      setBusy(false);
      setError("Upload failed: " + upErr.message);
      return;
    }
    const publicUrl = supabase.storage.from("avatars").getPublicUrl(path)
      .data.publicUrl;
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);
    setBusy(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setSrc(null);
    router.refresh();
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-[14px] font-semibold text-ink-soft transition active:scale-95">
        {hasPhoto ? "Change photo" : "Add a photo"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={pick}
        />
      </label>

      {src && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-ink/50" onClick={cancel} />
          <div className="sheet-enter relative w-full max-w-[420px] rounded-t-[28px] bg-paper px-6 pb-8 pt-3 shadow-pod-lg">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
            <h2 className="font-serif text-[20px] font-semibold text-ink">
              Frame your photo
            </h2>
            <p className="mt-1 text-[14px] text-muted">
              Drag to move, and use the sliders to zoom and rotate.
            </p>

            <div className="relative mt-4 h-64 w-full overflow-hidden rounded-2xl bg-ink">
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="mt-4 space-y-3">
              <div>
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
              <div>
                <div className="mb-1 flex items-center justify-between text-[12px] font-semibold uppercase tracking-wide text-muted">
                  <span>Rotate</span>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="rounded-full bg-paper-2 px-2.5 py-0.5 text-[12px] font-semibold text-ink-soft"
                  >
                    +90°
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full accent-terra"
                />
              </div>
            </div>

            {error && <p className="mt-3 text-[13px] text-terra">{error}</p>}

            <div className="mt-5 flex gap-3">
              <button
                onClick={cancel}
                disabled={busy}
                className="flex-1 rounded-2xl border border-line bg-card py-3.5 text-[15px] font-semibold text-ink-soft transition active:scale-[0.98] disabled:opacity-60"
              >
                Cancel
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
