import { NextRequest, NextResponse } from "next/server"
import {
  forwardedChatHeaders,
  getOrCreateChatSession,
} from "@/lib/server/chat-session"
import { getUpstreamBaseUrl } from "@/lib/server/upstreams"
import {
  readRequestBodyLimited,
  RequestBodyTooLarge,
} from "@/lib/server/bounded-body"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const MAX_CONFIRMATION_BYTES = 16 * 1024

export async function POST(req: NextRequest) {
  const chatbotBaseUrl = getUpstreamBaseUrl("chatbot")
  if (!chatbotBaseUrl) {
    return NextResponse.json({ error: "Servicio no configurado" }, { status: 503 })
  }
  const { sessionId, isNew } = getOrCreateChatSession(req)
  if (isNew) {
    return NextResponse.json(
      { error: "La sesión de confirmación expiró" },
      { status: 400 },
    )
  }
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
  let body: ArrayBuffer
  try {
    body = await readRequestBodyLimited(req, MAX_CONFIRMATION_BYTES)
  } catch (error) {
    if (!(error instanceof RequestBodyTooLarge)) throw error
    return NextResponse.json(
      { error: "Confirmación demasiado grande" },
      { status: 413 },
    )
  }
  const upstream = await fetch(`${chatbotBaseUrl}/chat/confirmations`, {
    method: "POST",
    headers: forwardedChatHeaders(req, sessionId),
    body,
    cache: "no-store",
  })
  const text = await upstream.text()
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  })
}
