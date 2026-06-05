"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITIES, type ActivityKey } from "@/lib/activities";

async function compressToJpeg(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1600;
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
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.8)
    );
  } catch {
    return file;
  }
}

export default function SessionEditSheet({
  session,
  podId,
  userId,
  onClose,
  onSaved,
}: {
  session: { id: string; activities: string[]; note: string | null; photoUrl: string | null };
  podId: string;
  userId: string;
  onClose: () => void;
  onSaved: (fields: {
    activities: string[];
    note: string | null;
    photoUrl: string | null;
  }) => void;
}) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityKey[]>(
    (session.activities as ActivityKey[]) ?? []
  );
  const [note, setNote] = useState(session.note ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(session.photoUrl);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(key: ActivityKey) {
    setActivities((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setNewFile(f);
    setNewPreview(URL.createObjectURL(f));
    setRemovePhoto(false);
    e.target.value = "";
  }

  function clearPhoto() {
    if (newPreview) URL.revokeObjectURL(newPreview);
    setNewFile(null);
    setNewPreview(null);
    if (photoUrl) setRemovePhoto(true);
    setPhotoUrl(null);
  }

  async function save() {
    if (activities.length === 0) {
      setError("Pick at least one activity.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();

    let finalPhoto: string | null = photoUrl;
    if (newFile) {
      const blob = await compressToJpeg(newFile);
      const path = `${podId}/${userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("session-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) {
        setSaving(false);
        setError("Photo upload failed: " + upErr.message);
        return;
      }
      finalPhoto = supabase.storage.from("session-photos").getPublicUrl(path)
        .data.publicUrl;
    } else if (removePhoto) {
      finalPhoto = null;
    }

    const cleanNote = note.trim() || null;
    const { error: updErr } = await supabase
      .from("sessions")
      .update({
        activity: activities[0],
        activities,
        note: cleanNote,
        photo_url: finalPhoto,
      })
      .eq("id", session.id);

    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    onSaved({ activities, note: cleanNote, photoUrl: finalPhoto });
    router.refresh();
    onClose();
  }

  const shownPhoto = newPreview ?? photoUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="sheet-enter relative w-full max-w-[420px] rounded-t-[28px] bg-paper px-6 pb-8 pt-3 shadow-pod-lg">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-paper-2 text-ink-soft active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>

        <h2 className="font-serif text-[20px] font-semibold text-ink">
          Edit your log
        </h2>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {ACTIVITIES.map((a) => {
            const on = activities.includes(a.key);
            return (
              <button
                key={a.key}
                onClick={() => toggle(a.key)}
                aria-pressed={on}
                className={`relative flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition ${
                  on ? "border-terra bg-terra/[0.06]" : "border-line bg-card"
                }`}
              >
                {on && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-terra text-[10px] font-bold text-white">
                    ✓
                  </span>
                )}
                <span className="text-[22px]">{a.emoji}</span>
                <span className="text-[13px] font-semibold text-ink">
                  {a.label}
                </span>
              </button>
            );
          })}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          rows={2}
          className="mt-4 w-full resize-none rounded-2xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none placeholder:text-muted"
        />

        <div className="mt-4">
          {shownPhoto ? (
            <div className="relative">
              <img
                src={shownPhoto}
                alt=""
                className="w-full rounded-xl object-cover"
                style={{ maxHeight: "240px" }}
              />
              <div className="mt-2 flex gap-2">
                <label className="cursor-pointer rounded-full border border-line bg-card px-4 py-1.5 text-[13px] font-semibold text-ink-soft">
                  Replace
                  <input type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
                </label>
                <button
                  onClick={clearPhoto}
                  className="rounded-full border border-line bg-card px-4 py-1.5 text-[13px] font-semibold text-terra"
                >
                  Remove photo
                </button>
              </div>
            </div>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-[14px] font-semibold text-ink-soft">
              Add a photo
              <input type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
            </label>
          )}
        </div>

        {error && <p className="mt-3 text-[13px] text-terra">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-2xl border border-line bg-card py-3.5 text-[15px] font-semibold text-ink-soft disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || activities.length === 0}
            className="flex-1 rounded-2xl bg-terra py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
