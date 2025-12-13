"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useCart } from "@/contexts/cart-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Send, MessageCircle } from "lucide-react"

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<{ sender: "user" | "bot"; text: string }[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const router = useRouter()
  const { updateCartCount } = useCart()

  // Cargar historial del localStorage al iniciar
  useEffect(() => {
    const saved = localStorage.getItem("chat_history")
    if (saved) {
      try {
        setMessages(JSON.parse(saved))
      } catch (e) {
        console.error("Error cargando historial", e)
      }
    }
  }, [])

  // Guardar historial en localStorage cada vez que cambia
  useEffect(() => {
    localStorage.setItem("chat_history", JSON.stringify(messages))

    // Scroll automático
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  const clearChat = () => {
    setMessages([])
    localStorage.removeItem("chat_history")
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userText = input.trim()

    setMessages((prev) => [...prev, { sender: "user", text: userText }])
    setInput("")
    setLoading(true)

    try {
      // Usamos el proxy interno en lugar de llamar directo al puerto 8002
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userText,
          history: messages // Enviamos el historial actual
        }),
        // No es estrictamente necesario credentials: 'include' para same-origin
        // pero asegura que las cookies viajen al proxy
      })

      const data = await res.json()
      const answer = data?.answer || "Lo siento, hubo un problema al responder."

      // Chequear si hay comando de navegación en la respuesta
      let displayText = answer
      try {
        if (answer.includes('{"action": "navigate"')) {
          const match = answer.match(/(\{.*"action":\s*"navigate".*\})/)
          if (match) {
            const cmd = JSON.parse(match[1])
            if (cmd.action === "navigate") {
              router.push(cmd.url)
              displayText = answer.replace(match[0], "").trim() || "Navegando..."
            }
          }
        }
      } catch (e) {
        console.error("Error parseando comando", e)
      }

      setMessages((prev) => [...prev, { sender: "bot", text: displayText }])

      await updateCartCount?.()

    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Error al conectar con el servicio de chat." },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* BOTÓN FLOTANTE */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 h-14 w-14 rounded-full shadow-xl flex items-center justify-center bg-primary text-primary-foreground hover:scale-105 transition"
      >
        <MessageCircle className="h-7 w-7" />
      </Button>

      {isOpen && (
        <div className="fixed bottom-5 right-5 w-80 sm:w-96 z-50 animate-in fade-in slide-in-from-bottom-4">
          <Card className="border shadow-xl bg-background flex flex-col h-[500px]">

            {/* HEADER */}
            <div className="p-3 border-b flex items-center justify-between bg-primary text-primary-foreground">
              <span className="font-bold">Asistente UCB Store</span>
              <div className="flex gap-2">
                <button
                  onClick={clearChat}
                  className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition"
                  title="Borrar historial"
                >
                  Borrar
                </button>
                <button onClick={() => setIsOpen(false)} className="text-sm opacity-80 hover:opacity-100">
                  ✕
                </button>
              </div>
            </div>

            {/* CHAT CONTENT */}
            <div ref={chatRef} className="flex-1 p-3 overflow-y-auto space-y-3 text-sm">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground mt-10">
                  <p>¡Hola! Soy tu asistente virtual.</p>
                  <p className="text-xs mt-2">Pregúntame sobre productos o la universidad.</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[80%] p-2 rounded-lg ${m.sender === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted text-foreground"
                    }`}
                >
                  {m.text}
                </div>
              ))}
              {loading && (
                <div className="bg-muted p-2 rounded-lg w-fit text-xs text-muted-foreground">
                  Escribiendo...
                </div>
              )}
            </div>

            {/* INPUT */}
            <div className="p-3 border-t flex gap-2">
              <Input
                placeholder="Escribe tu mensaje..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="text-sm"
              />
              <Button size="icon" onClick={sendMessage} disabled={loading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
