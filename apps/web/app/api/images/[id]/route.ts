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

  const target = new URL(
    `${imagesBaseUrl}/images/${encodeURIComponent(ctx.params.id)}`,
  )
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
      "cache-control",
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
