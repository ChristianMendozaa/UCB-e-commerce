import { NextRequest, NextResponse } from "next/server"
import {
  CHAT_SESSION_COOKIE,
  CHAT_SESSION_MAX_AGE,
  forwardedChatHeaders,
  getOrCreateChatSession,
} from "@/lib/server/chat-session"
import { getUpstreamBaseUrl } from "@/lib/server/upstreams"
import {
  chatRateLimitHeaders,
  consumeChatRateLimit,
} from "@/lib/server/chat-rate-limit"
import {
  readRequestBodyLimited,
  RequestBodyTooLarge,
} from "@/lib/server/bounded-body"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_CHAT_PAYLOAD_BYTES = 96 * 1024

export async function POST(req: NextRequest) {
  const chatbotBaseUrl = getUpstreamBaseUrl("chatbot")
  if (!chatbotBaseUrl) {
    return NextResponse.json(
      { error: "Servicio de chat no configurado" },
      { status: 503 },
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
    body = await readRequestBodyLimited(req, MAX_CHAT_PAYLOAD_BYTES)
  } catch (error) {
    if (!(error instanceof RequestBodyTooLarge)) throw error
    return NextResponse.json(
      { error: "Solicitud de chat demasiado grande" },
      { status: 413 },
    )
  }
  const { sessionId, isNew } = getOrCreateChatSession(req)
  const rateLimit = consumeChatRateLimit(sessionId)
  const rateHeaders = chatRateLimitHeaders(
    rateLimit.remaining,
    rateLimit.resetAt,
  )
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta nuevamente en un minuto." },
      {
        status: 429,
        headers: {
          ...rateHeaders,
          "Retry-After": String(
            Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1_000)),
          ),
        },
      },
    )
  }
  const upstream = await fetch(`${chatbotBaseUrl}/chat/turns`, {
    method: "POST",
    headers: forwardedChatHeaders(req, sessionId),
    body,
    cache: "no-store",
  })
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "Error en el servicio de chat" },
      { status: upstream.status || 502 },
    )
  }

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      ...rateHeaders,
    },
  })
  if (isNew) {
    response.cookies.set(CHAT_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      maxAge: CHAT_SESSION_MAX_AGE,
      path: "/",
    })
  }
  return response
}
