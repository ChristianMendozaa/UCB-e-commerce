import { randomBytes, randomUUID } from "crypto"
import type { NextRequest } from "next/server"

export const CHAT_SESSION_COOKIE = "ucb_chat_session"
export const CHAT_SESSION_MAX_AGE = 7 * 24 * 60 * 60

export function getOrCreateChatSession(req: NextRequest) {
  const existing = req.cookies.get(CHAT_SESSION_COOKIE)?.value ?? ""
  if (/^[A-Za-z0-9_-]{32,128}$/.test(existing)) {
    return { sessionId: existing, isNew: false }
  }
  return {
    sessionId: randomBytes(32).toString("base64url"),
    isNew: true,
  }
}

export function forwardedChatHeaders(req: NextRequest, sessionId: string) {
  const headers = new Headers(req.headers)
  headers.delete("host")
  headers.delete("content-length")
  const cookies = (req.headers.get("cookie") ?? "")
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(
      (cookie) => (
        cookie
        && !cookie.startsWith(`${CHAT_SESSION_COOKIE}=`)
      ),
    )
  const sessionCookie = `${CHAT_SESSION_COOKIE}=${sessionId}`
  headers.set(
    "cookie",
    [...cookies, sessionCookie].join("; "),
  )
  headers.set("cache-control", "no-store")
  if (!headers.get("x-request-id")) {
    headers.set("x-request-id", randomUUID())
  }
  return headers
}
