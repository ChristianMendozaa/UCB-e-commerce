import { NextRequest, NextResponse } from "next/server"
import { getUpstreamBaseUrl } from "@/lib/server/upstreams"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const IMAGE_SECURITY_HEADERS = {
  "content-security-policy": "default-src 'none'; sandbox",
  "cross-origin-resource-policy": "same-origin",
  "x-content-type-options": "nosniff",
} as const

const SAFE_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])

// Must match IMAGE_VARIANT_WIDTHS in services/images/config.py. Rejecting an
// out-of-list width here (instead of forwarding it) protects the origin from
// CPU amplification and keeps the CDN cache key from being polluted with
// arbitrary widths.
const ALLOWED_VARIANT_WIDTHS = new Set([96, 320, 640])

// Set on every 200/304 image response. The image itself is fetched by
// immutable ID (products/orders always mint a new ID rather than mutating
// one in place), so a year-long cache is honest. All three headers are set
// explicitly rather than relying on a single one being interpreted for both
// the browser and the CDN tier.
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"

export const GET = handler
export const HEAD = handler

async function handler(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const imagesBaseUrl = getUpstreamBaseUrl("images")
  if (!imagesBaseUrl) {
    return proxyErrorResponse(
      req.method,
      503,
      "Servicio de imágenes no configurado.",
    )
  }

  const widthParam = req.nextUrl.searchParams.get("w")
  let width: number | undefined
  if (widthParam !== null) {
    width = Number(widthParam)
    if (!ALLOWED_VARIANT_WIDTHS.has(width)) {
      return proxyErrorResponse(req.method, 400, "Ancho solicitado no permitido.")
    }
  }

  const target = new URL(
    `${imagesBaseUrl}/images/${encodeURIComponent(ctx.params.id)}`,
  )
  if (width !== undefined) target.searchParams.set("w", String(width))

  const requestHeaders = new Headers()
  for (const name of [
    "accept",
    "if-modified-since",
    "if-none-match",
    "range",
  ]) {
    const value = req.headers.get(name)
    if (value) requestHeaders.set(name, value)
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: requestHeaders,
      cache: "no-store",
      redirect: "manual",
    })
    const upstreamContentType =
      upstream.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase()
    if (
      upstream.ok &&
      (!upstreamContentType ||
        !SAFE_IMAGE_CONTENT_TYPES.has(upstreamContentType))
    ) {
      await upstream.body?.cancel()
      return proxyErrorResponse(
        req.method,
        502,
        "El servicio devolvió un formato de imagen no permitido.",
      )
    }

    const responseHeaders = new Headers()
    for (const name of [
      "accept-ranges",
      "content-disposition",
      "content-length",
      "content-range",
      "content-type",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }

    // The images service always emits a strong ETag and an immutable
    // Cache-Control on 200/304 (see routers/images.py). Re-assert the CDN
    // variants of the header explicitly here rather than only forwarding
    // whatever upstream sent, since Vercel's edge honors
    // Vercel-CDN-Cache-Control / CDN-Cache-Control ahead of a plain
    // Cache-Control. Any other status (404, 502, ...) must never be cached —
    // a container cold-start returning a transient error must not stick for
    // a year.
    if (upstream.status === 200 || upstream.status === 304) {
      responseHeaders.set("cache-control", IMMUTABLE_CACHE_CONTROL)
      responseHeaders.set("cdn-cache-control", IMMUTABLE_CACHE_CONTROL)
      responseHeaders.set("vercel-cdn-cache-control", IMMUTABLE_CACHE_CONTROL)
    } else {
      responseHeaders.set("cache-control", "no-store")
    }
    setImageSecurityHeaders(responseHeaders)

    return new NextResponse(req.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch {
    return proxyErrorResponse(
      req.method,
      502,
      "Servicio de imágenes no disponible.",
    )
  }
}

function proxyErrorResponse(method: string, status: number, error: string) {
  const headers = new Headers({ "cache-control": "no-store" })
  setImageSecurityHeaders(headers)
  if (method === "HEAD") {
    return new NextResponse(null, {
      status,
      headers,
    })
  }
  return NextResponse.json({ error }, { status, headers })
}

function setImageSecurityHeaders(headers: Headers) {
  for (const [name, value] of Object.entries(IMAGE_SECURITY_HEADERS)) {
    headers.set(name, value)
  }
}
