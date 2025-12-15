"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useCart } from "@/contexts/cart-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Send, MessageCircle, X, Trash2, User as UserIcon } from "lucide-react"

interface AuthUserLocal {
  photoURL?: string;
  name?: string;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<{ sender: "user" | "bot"; text: string }[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [userPhoto, setUserPhoto] = useState<string | null>(null)

  const chatRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { updateCartCount } = useCart()

  // Cargar historial y usuario
  useEffect(() => {
    // 1. Historial
    const saved = localStorage.getItem("chat_history")
    if (saved) {
      try {
        setMessages(JSON.parse(saved))
      } catch (e) {
        console.error("Error cargando historial", e)
      }
    }

    // 2. Usuario (foto)
    const savedUser = localStorage.getItem("authUser")
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser) as AuthUserLocal
        if (u.photoURL) setUserPhoto(u.photoURL)
      } catch { }
    }
  }, [])

  // Guardar historial
  useEffect(() => {
    localStorage.setItem("chat_history", JSON.stringify(messages))
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, isOpen])

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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userText,
          history: messages,
          current_page: pathname
        }),
      })

      const data = await res.json()
      const answer = data?.answer || "Lo siento, hubo un problema al responder."

      // Manejo de navegación
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
      setMessages((prev) => [...prev, { sender: "bot", text: "Error de conexión." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Botón Flotante */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-2xl flex items-center justify-center bg-[#003366] text-white hover:bg-[#002244] hover:scale-110 transition-all duration-300 z-50 animate-in fade-in zoom-in"
        >
          <MessageCircle className="h-8 w-8" />
        </Button>
      )}

      {/* Widget Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] z-50 animate-in fade-in slide-in-from-bottom-10 duration-300">
          <Card className="flex flex-col h-[600px] border-0 shadow-2xl rounded-2xl overflow-hidden bg-background/95 backdrop-blur-sm ring-1 ring-black/5">

            {/* Header Profesional */}
            <div className="p-4 bg-gradient-to-r from-[#003366] to-[#004080] text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 bg-white rounded-full p-1 shadow-sm">
                  <Image
                    src="/ucb-logo.png"
                    alt="Bot"
                    fill
                    className="object-contain p-1"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Asistente UCB</h3>
                  <p className="text-[10px] text-blue-100 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    En línea
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={clearChat}
                  className="p-2 hover:bg-white/10 rounded-full transition text-white/80 hover:text-white"
                  title="Limpiar chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition text-white/80 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div ref={chatRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50 dark:bg-zinc-900/50">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground mt-20 px-8">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="h-8 w-8 text-[#003366] dark:text-blue-400" />
                  </div>
                  <p className="font-medium text-foreground">¡Hola! 👋</p>
                  <p className="text-xs mt-2 leading-relaxed">
                    Soy tu asistente virtual de la UCB. Puedo ayudarte a buscar productos, ver precios o gestionar tu pedido.
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${m.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 mt-1">
                    {m.sender === "bot" ? (
                      <div className="h-8 w-8 relative bg-white rounded-full shadow-sm border p-1">
                        <Image src="/ucb-logo.png" alt="Bot" fill className="object-contain p-0.5" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 border flex items-center justify-center">
                        {userPhoto ? (
                          <img src={userPhoto} alt="User" className="h-full w-full object-cover" />
                        ) : (
                          <UserIcon className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${m.sender === "user"
                      ? "bg-[#003366] text-white rounded-tr-none"
                      : "bg-white dark:bg-zinc-800 border text-foreground rounded-tl-none"
                      }`}
                  >
                    {m.sender === "bot" ? (
                      <div className="markdown prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p>{m.text}</p>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 relative bg-white rounded-full shadow-sm border p-1">
                    <Image src="/ucb-logo.png" alt="Bot" fill className="object-contain p-0.5" />
                  </div>
                  <div className="bg-white dark:bg-zinc-800 border px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-background border-t">
              <div className="relative flex items-center">
                <Input
                  placeholder="Escribe tu consulta..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  disabled={loading}
                  className="pr-12 py-6 rounded-full border-gray-200 dark:border-zinc-700 focus-visible:ring-[#003366] shadow-sm bg-gray-50 dark:bg-zinc-900/50"
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="absolute right-1.5 h-9 w-9 rounded-full bg-[#003366] hover:bg-[#002244] text-white shadow-sm transition-transform hover:scale-105"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-[10px] text-center text-muted-foreground mt-2 opacity-60">
                Potenciado por UCB IA Engine
              </div>
            </div>

          </Card>
        </div>
      )}
    </>
  )
}
