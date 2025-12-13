import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const CHATBOT_URL = process.env.NEXT_PUBLIC_CHATBOT_API_URL || "http://localhost:8002"

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        // Obtener todas las cookies de la petición entrante
        const cookieStore = cookies()
        const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')

        console.log("Proxying chat request to:", `${CHATBOT_URL}/chat`)

        const res = await fetch(`${CHATBOT_URL}/chat`, {
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
            return NextResponse.json({ error: "Error en el servicio de chat" }, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data)

    } catch (error) {
        console.error("Proxy Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
