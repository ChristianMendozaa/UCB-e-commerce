import { NextRequest, NextResponse } from "next/server"
import { getUpstreamBaseUrl } from "@/lib/server/upstreams"
import {
  readRequestBodyLimited,
  RequestBodyTooLarge,
} from "@/lib/server/bounded-body"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const MAX_PREFERENCES_BYTES = 8 * 1024

export const GET = handler
export const PATCH = handler
export const DELETE = handler

async function handler(req: NextRequest) {
  const productsBaseUrl = getUpstreamBaseUrl("products")
  if (!productsBaseUrl) {
    return NextResponse.json({ error: "Servicio no configurado" }, { status: 503 })
  }
  const headers = new Headers(req.headers)
  headers.delete("host")
  headers.delete("content-length")
  let body: ArrayBuffer | undefined
  if (req.method === "PATCH") {
    const mediaType = req.headers.get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase()
    if (mediaType !== "application/json") {
      return NextResponse.json(
        { error: "Content-Type debe ser application/json" },
        { status: 415 },
      )
    }
    try {
      body = await readRequestBodyLimited(req, MAX_PREFERENCES_BYTES)
    } catch (error) {
      if (!(error instanceof RequestBodyTooLarge)) throw error
      return NextResponse.json(
        { error: "Preferencias demasiado grandes" },
        { status: 413 },
      )
    }
  }
  const upstream = await fetch(
    `${productsBaseUrl}/api/assistant/preferences`,
    {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    },
  )
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  })
}
