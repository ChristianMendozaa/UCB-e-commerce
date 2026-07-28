const LIMIT = 12
const WINDOW_MS = 60_000
const MAX_CLIENTS = 10_000

type Entry = { count: number; resetAt: number }
const entries = new Map<string, Entry>()

export function consumeChatRateLimit(key: string, now = Date.now()) {
  for (const [candidate, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(candidate)
  }
  const current = entries.get(key)
  if (current && current.resetAt > now && current.count >= LIMIT) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt }
  }
  const next = current && current.resetAt > now
    ? { count: current.count + 1, resetAt: current.resetAt }
    : { count: 1, resetAt: now + WINDOW_MS }
  entries.delete(key)
  if (entries.size >= MAX_CLIENTS) {
    const oldest = entries.keys().next().value
    if (oldest) entries.delete(oldest)
  }
  entries.set(key, next)
  return {
    allowed: true,
    remaining: Math.max(0, LIMIT - next.count),
    resetAt: next.resetAt,
  }
}

export function chatRateLimitHeaders(remaining: number, resetAt: number) {
  return {
    "X-RateLimit-Limit": String(LIMIT),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1_000)),
  }
}
