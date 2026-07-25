// lib/image-loader.ts
//
// Custom next/image loader that targets the images service's own on-demand
// resize endpoint (GET /api/images/{id}?w=<width>) instead of Next's built-in
// /_next/image optimizer. This gets real srcset/sizes generation without
// needing `sharp` in the web container, without an extra internal hop, and
// without relying on Vercel's image-transformation behavior for a
// `runtime: "container"` service (see next.config.mjs).
//
// Must stay in sync with IMAGE_VARIANT_WIDTHS in services/images/config.py
// and ALLOWED_VARIANT_WIDTHS in apps/web/app/api/images/[id]/route.ts.
const ALLOWED_WIDTHS = [96, 320, 640] as const

/**
 * Snap an arbitrary next/image-requested width up to the nearest allowed
 * variant width. Snapping up (never down) means a `deviceSizes`/`imageSizes`
 * change can never request a width the backend would reject. Anything wider
 * than the largest variant falls back to the original image.
 */
export function snapVariantWidth(width: number): number | null {
  for (const allowed of ALLOWED_WIDTHS) {
    if (width <= allowed) return allowed
  }
  return null
}

export default function imageLoader({
  src,
  width,
}: {
  src: string
  width: number
  quality?: number
}) {
  // Only our own proxied images support ?w=; everything else (the static
  // logo, /placeholder.svg, external avatars) passes through unchanged.
  if (!src.startsWith("/api/images/")) return src

  const snapped = snapVariantWidth(width)
  return snapped ? `${src}?w=${snapped}` : src
}
