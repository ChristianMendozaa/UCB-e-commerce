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
const MAX_RECEIPT_BYTES = 8 * 1024

export async function POST(req: NextRequest) {
  const chatbotBaseUrl = getUpstreamBaseUrl("chatbot")
  if (!chatbotBaseUrl) {
    return NextResponse.json({ accepted: false }, { status: 503 })
  }
  const mediaType = req.headers.get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase()
  if (mediaType !== "application/json") {
    return NextResponse.json({ accepted: false }, { status: 415 })
  }
  let body: ArrayBuffer
  try {
    body = await readRequestBodyLimited(req, MAX_RECEIPT_BYTES)
  } catch (error) {
    if (!(error instanceof RequestBodyTooLarge)) throw error
    return NextResponse.json({ accepted: false }, { status: 413 })
  }
  const { sessionId } = getOrCreateChatSession(req)
  const upstream = await fetch(`${chatbotBaseUrl}/chat/actions/receipt`, {
    method: "POST",
    headers: forwardedChatHeaders(req, sessionId),
    body,
    cache: "no-store",
  })
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  })
}
