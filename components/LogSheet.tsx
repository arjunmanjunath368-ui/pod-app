"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITIES, type ActivityKey } from "@/lib/activities";

async function compressToJpeg(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1200;
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
      canvas.toBlob(
        (b) => resolve(b ?? file),
        "image/jpeg",
        0.8
      )
    );
  } catch {
    return file; // fallback: upload original (e.g. unsupported decode)
  }
}

export default function LogSheet({
  open,
  onClose,
  podId,
  userId,
  defaultActivity,
}: {
  open: boolean;
  onClose: () => void;
  podId: string;
  userId: string;
  defaultActivity?: ActivityKey;
}) {
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityKey>(
    defaultActivity ?? "strength"
  );
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!open) return null;

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearPhoto() {
    setPhoto(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  async function logIt() {
    setSaving(true);
    setError("");
    const supabase = createClient();

    let photoUrl: string | null = null;
    if (photo) {
      const blob = await compressToJpeg(photo);
      const path = `${podId}/${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("session-photos")
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (upErr) {
        setSaving(false);
        setError("Photo upload failed: " + upErr.message);
        return;
      }
      photoUrl = supabase.storage.from("session-photos").getPublicUrl(path)
        .data.publicUrl;
    }

    const { error } = await supabase.from("sessions").insert({
      pod_id: podId,
      user_id: userId,
      activity,
      note: note.trim() || null,
      photo_url: photoUrl,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      setDone(false);
      setNote("");
      clearPhoto();
      onClose();
      router.refresh();
    }, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={() => !saving && onClose()}
      />
      <div className="sheet-enter relative w-full max-w-[420px] rounded-t-[28px] bg-paper px-6 pb-9 pt-3 shadow-pod-lg">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line" />

        {done ? (
          <div className="py-8 text-center">
            <div className="text-[40px]">✅</div>
            <p className="mt-2 font-serif text-[22px] font-semibold text-ink">
              Logged. Nice.
            </p>
            <p className="mt-1 text-[15px] text-muted">
              Your pod sees you showed up.
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-[22px] font-semibold text-ink">
              Log a session
            </h2>
            <p className="mt-1 text-[15px] text-muted">
              What did you do? This counts toward your week.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {ACTIVITIES.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setActivity(a.key)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition ${
                    activity === a.key
                      ? "border-terra bg-terra/[0.06]"
                      : "border-line bg-card"
                  }`}
                >
                  <span className="text-[22px]">{a.emoji}</span>
                  <span className="text-[13px] font-semibold text-ink">
                    {a.label}
                  </span>
                </button>
              ))}
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional) — how'd it go?"
              rows={2}
              maxLength={140}
              className="mt-4 w-full resize-none rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none focus:border-terra"
            />

            {preview ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-card p-2.5">
                <img
                  src={preview}
                  alt=""
                  className="h-14 w-14 rounded-xl object-cover"
                />
                <span className="flex-1 text-[15px] text-muted">
                  Photo attached
                </span>
                <button
                  onClick={clearPhoto}
                  className="rounded-full bg-paper-2 px-3 py-1.5 text-[13px] font-semibold text-muted"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-card py-3 text-[15px] font-semibold text-ink-soft">
                <span className="text-[16px]">📷</span> Add a photo (optional)
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={pickPhoto}
                />
              </label>
            )}

            {error && <p className="mt-3 text-[13px] text-terra">{error}</p>}

            <button
              onClick={logIt}
              disabled={saving}
              className="mt-4 w-full rounded-2xl bg-terra py-4 text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? "Logging…" : "Log it"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
