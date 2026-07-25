// lib/image-url.ts
//
// Same width-variant logic as image-loader.ts, exposed as a plain function
// for the handful of admin/orders sites that render a bare <img> instead of
// next/image (they're low-traffic, inside modals, and next/image's layout
// constraints aren't worth fighting there — see CLAUDE.md's layout map).
import { snapVariantWidth } from "@/lib/image-loader"

/**
 * Return a `?w=<width>` variant URL for a proxied product image, snapping up
 * to the nearest allowed width. Blob/data URLs (upload previews) and
 * external URLs (e.g. a Google avatar) pass through unchanged.
 */
export function imageUrl(src: string | undefined | null, width: number): string {
  if (!src) return src ?? ""
  if (!src.startsWith("/api/images/")) return src

  const snapped = snapVariantWidth(width)
  return snapped ? `${src}?w=${snapped}` : src
}
