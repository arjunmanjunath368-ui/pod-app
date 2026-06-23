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
