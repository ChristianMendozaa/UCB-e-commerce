"use client"

import { useState, useEffect, useRef } from "react"
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

  // Scroll automático al final
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userText = input.trim()

    setMessages((prev) => [...prev, { sender: "user", text: userText }])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("https://chatbot-servive-ucb-commerce.vercel.app/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userText }),
      })

      const data = await res.json()
      const answer = data?.answer || "Lo siento, hubo un problema al responder."

      setMessages((prev) => [...prev, { sender: "bot", text: answer }])
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
              <button onClick={() => setIsOpen(false)} className="text-sm opacity-80 hover:opacity-100">
                ✕
              </button>
            </div>

            {/* CHAT CONTENT */}
            <div ref={chatRef} className="flex-1 p-3 overflow-y-auto space-y-3 text-sm">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[80%] p-2 rounded-lg ${
                    m.sender === "user"
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
