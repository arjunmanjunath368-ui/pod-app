// Image helpers for keeping photo-heavy views light.
//
// Supabase image transformations (server-side resize) require a Pro plan. While
// off, we serve the original file — lazy-loading still keeps the page light
// because off-screen images never download. Flip IMAGE_TRANSFORM to true once
// you're on Supabase Pro to also shrink the bytes per image (full-res still
// opens on tap). Nothing breaks either way.
export const IMAGE_TRANSFORM = false;

export function thumb(url: string | null | undefined, width: number): string | undefined {
  if (!url) return undefined;
  if (!IMAGE_TRANSFORM) return url;
  // Public object URL -> render/image URL with a width + quality cap.
  const transformed = url.replace("/object/public/", "/render/image/public/");
  const sep = transformed.includes("?") ? "&" : "?";
  return `${transformed}${sep}width=${width}&quality=70`;
}

// Downscale + JPEG-compress a photo before upload (caps the long edge at 1200px).
// Falls back to the original file if the browser can't decode it.
export async function compressToJpeg(file: File): Promise<Blob> {
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
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.8)
    );
  } catch {
    return file;
  }
}
