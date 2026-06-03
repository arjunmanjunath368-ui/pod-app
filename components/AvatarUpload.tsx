"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

async function compressToJpeg(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 512;
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
}: {
  userId: string;
  hasPhoto: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const blob = await compressToJpeg(f);
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
    router.refresh();
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-[14px] font-semibold text-ink-soft transition active:scale-95">
        {busy ? "Uploading…" : hasPhoto ? "Change photo" : "Add a photo"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={pick}
          disabled={busy}
        />
      </label>
      {error && <p className="mt-2 text-[13px] text-terra">{error}</p>}
    </div>
  );
}
