import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getUpstreamBaseUrl } from "@/lib/server/upstreams"

const MAX_CHAT_PAYLOAD_BYTES = 96 * 1024
const RATE_LIMIT_REQUESTS = 12
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_PRUNE_INTERVAL_MS = 10_000
const MAX_TRACKED_CLIENTS = 10_000

type ClientWindow = {
    count: number
    resetAt: number
}

const clientWindows = new Map<string, ClientWindow>()
let lastRateLimitPruneAt = 0

class PayloadTooLargeError extends Error { }

function getClientKey(req: NextRequest): string {
    const forwardedFor = (
        req.headers.get("x-vercel-forwarded-for")
        || req.headers.get("x-forwarded-for")
        || req.headers.get("x-real-ip")
        || ""
    ).split(",", 1)[0].trim()

    const candidate = forwardedFor.slice(0, 64)
    return /^[0-9a-f.:]+$/i.test(candidate) ? candidate : "unknown-client"
}

function consumeRateLimit(clientKey: string, now = Date.now()) {
    if (now - lastRateLimitPruneAt >= RATE_LIMIT_PRUNE_INTERVAL_MS) {
        for (const [key, window] of clientWindows) {
            if (window.resetAt <= now) clientWindows.delete(key)
        }
        lastRateLimitPruneAt = now
    }

    const current = clientWindows.get(clientKey)
    if (current && current.resetAt > now && current.count >= RATE_LIMIT_REQUESTS) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: current.resetAt,
        }
    }

    const next = current && current.resetAt > now
        ? { count: current.count + 1, resetAt: current.resetAt }
        : { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS }

    // Refresh insertion order so the map can evict the least-recently seen key.
    clientWindows.delete(clientKey)
    if (clientWindows.size >= MAX_TRACKED_CLIENTS) {
        const oldestKey = clientWindows.keys().next().value
        if (oldestKey !== undefined) clientWindows.delete(oldestKey)
    }
    clientWindows.set(clientKey, next)

    return {
        allowed: true,
        remaining: RATE_LIMIT_REQUESTS - next.count,
        resetAt: next.resetAt,
    }
}

function rateLimitHeaders(remaining: number, resetAt: number) {
    return {
        "X-RateLimit-Limit": String(RATE_LIMIT_REQUESTS),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
    }
}

async function readBoundedJson(req: NextRequest): Promise<unknown> {
    const declaredLength = Number(req.headers.get("content-length"))
    if (Number.isFinite(declaredLength) && declaredLength > MAX_CHAT_PAYLOAD_BYTES) {
        throw new PayloadTooLargeError()
    }

    if (!req.body) throw new SyntaxError("Empty request body")

    const reader = req.body.getReader()
    const decoder = new TextDecoder("utf-8", { fatal: true })
    let totalBytes = 0
    let rawBody = ""

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        totalBytes += value.byteLength
        if (totalBytes > MAX_CHAT_PAYLOAD_BYTES) {
            await reader.cancel()
            throw new PayloadTooLargeError()
        }
        rawBody += decoder.decode(value, { stream: true })
    }

    rawBody += decoder.decode()
    return JSON.parse(rawBody)
}

export async function POST(req: NextRequest) {
    const rateLimit = consumeRateLimit(getClientKey(req))
    const commonHeaders = rateLimitHeaders(
        rateLimit.remaining,
        rateLimit.resetAt,
    )

    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: "Demasiadas solicitudes. Intenta nuevamente en un minuto." },
            {
                status: 429,
                headers: {
                    ...commonHeaders,
                    "Retry-After": String(
                        Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
                    ),
                },
            },
        )
    }

    try {
        const mediaType = req.headers.get("content-type")
            ?.split(";", 1)[0]
            .trim()
            .toLowerCase()
        if (mediaType !== "application/json") {
            return NextResponse.json(
                { error: "Content-Type debe ser application/json" },
                { status: 415, headers: commonHeaders },
            )
        }

        const chatbotBaseUrl = getUpstreamBaseUrl("chatbot")
        if (!chatbotBaseUrl) {
            return NextResponse.json(
                { error: "Servicio de chat no configurado" },
                { status: 503, headers: commonHeaders },
            )
        }
        const body = await readBoundedJson(req)

        // Obtener todas las cookies de la petición entrante
        const cookieStore = cookies()
        const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')

        const res = await fetch(`${chatbotBaseUrl}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cookie": cookieHeader // Reenviar cookies al backend
            },
            body: JSON.stringify(body),
        })

        if (!res.ok) {
            const errorText = await res.text()
            console.error("Chatbot Service Error:", res.status, errorText)
            return NextResponse.json(
                { error: "Error en el servicio de chat" },
                { status: res.status, headers: commonHeaders },
            )
        }

        const data = await res.json()
        return NextResponse.json(data, { headers: commonHeaders })

    } catch (error) {
        if (error instanceof PayloadTooLargeError) {
            return NextResponse.json(
                { error: "Solicitud de chat demasiado grande" },
                { status: 413, headers: commonHeaders },
            )
        }
        if (error instanceof SyntaxError || error instanceof TypeError) {
            return NextResponse.json(
                { error: "El cuerpo debe contener JSON UTF-8 válido" },
                { status: 400, headers: commonHeaders },
            )
        }
        console.error("Proxy Error:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500, headers: commonHeaders },
        )
    }
}
