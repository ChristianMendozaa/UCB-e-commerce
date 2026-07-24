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
import {
  Send, MessageCircle, X, Trash2,
  User as UserIcon, BrainCircuit, Wrench, FileOutput, ChevronDown, ChevronUp
} from "lucide-react"

interface AuthUserLocal {
  photoURL?: string;
  name?: string;
}

interface AgentTraceStep {
  type: "tool_call" | "tool_result"
  content?: string
  name?: string
  args?: any
  step: number
}

interface Message {
  sender: "user" | "bot"
  text: string
  trace?: AgentTraceStep[]
}

const MAX_QUESTION_LENGTH = 2_000
const MAX_HISTORY_MESSAGES = 20
const MAX_HISTORY_TEXT_LENGTH = 4_000
const MAX_STORED_MESSAGES = 100
const STATIC_CHAT_NAVIGATION_PATHS = new Set([
  "/",
  "/catalog",
  "/careers",
  "/cart",
  "/login",
  "/orders",
])

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
}

function decodePathSegment(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function isSafeProductId(value: string): boolean {
  if (!value || value !== value.trim() || value === "." || value === "..") {
    return false
  }
  if (value.includes("/") || value.includes("\\") || hasControlCharacters(value)) {
    return false
  }
  if (/^__.*__$/.test(value)) return false
  return new TextEncoder().encode(value).byteLength <= 1_500
}

function safeNavigationPath(value: unknown): string | null {
  if (typeof value !== "string" || !value || value !== value.trim()) return null
  if (!value.startsWith("/") || value.startsWith("//")) return null
  if (value.includes("\\") || hasControlCharacters(value)) return null

  let parsed: URL
  try {
    parsed = new URL(value, window.location.origin)
  } catch {
    return null
  }
  if (parsed.origin !== window.location.origin) return null
  if (parsed.search || parsed.hash || parsed.pathname !== value) return null

  if (STATIC_CHAT_NAVIGATION_PATHS.has(value)) return value

  if (value.startsWith("/products/")) {
    const encodedSegment = value.slice("/products/".length)
    if (!encodedSegment || encodedSegment.includes("/")) return null
    const productId = decodePathSegment(encodedSegment)
    if (productId === null || !isSafeProductId(productId)) return null
    return `/products/${encodeURIComponent(productId)}`
  }

  if (value.startsWith("/careers/")) {
    const encodedSegment = value.slice("/careers/".length)
    if (!encodedSegment || encodedSegment.includes("/")) return null
    const career = decodePathSegment(encodedSegment)
    if (
      career === null
      || !career
      || career !== career.trim()
      || career === "."
      || career === ".."
      || career.includes("/")
      || career.includes("\\")
      || hasControlCharacters(career)
      || new TextEncoder().encode(career).byteLength > 200
    ) {
      return null
    }
    return `/careers/${encodeURIComponent(career)}`
  }

  return null
}

function parseStoredMessages(value: string): Message[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is { sender: "user" | "bot"; text: string } => (
        typeof item === "object"
        && item !== null
        && ("sender" in item)
        && (item.sender === "user" || item.sender === "bot")
        && ("text" in item)
        && typeof item.text === "string"
      ))
      .slice(-MAX_STORED_MESSAGES)
      .map((item) => ({
        sender: item.sender,
        text: item.text.slice(0, MAX_HISTORY_TEXT_LENGTH),
      }))
  } catch {
    return []
  }
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [userPhoto, setUserPhoto] = useState<string | null>(null)
  const [expandedTrace, setExpandedTrace] = useState<number | null>(null)

  const chatRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { updateCartCount } = useCart()

  // Cargar historial y usuario
  useEffect(() => {
    // 1. Historial
    const saved = localStorage.getItem("chat_history")
    if (saved) {
      setMessages(parseStoredMessages(saved))
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
    localStorage.setItem(
      "chat_history",
      JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)),
    )
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, isOpen, expandedTrace])

  const clearChat = () => {
    setMessages([])
    setExpandedTrace(null)
    localStorage.removeItem("chat_history")
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userText = input.trim()

    setMessages((prev) => (
      [...prev, { sender: "user", text: userText } as Message]
        .slice(-MAX_STORED_MESSAGES)
    ))
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userText,
          history: messages
            .slice(-MAX_HISTORY_MESSAGES)
            .map(m => ({
              sender: m.sender,
              text: m.text.slice(0, MAX_HISTORY_TEXT_LENGTH),
            })),
          current_page: pathname
        }),
      })

      const data = await res.json()
      const answer = typeof data?.answer === "string"
        ? data.answer
        : "Lo siento, hubo un problema al responder."
      const trace = Array.isArray(data?.trace) ? data.trace : []

      // Manejo de navegación
      let displayText = answer
      try {
        if (answer.includes('{"action": "navigate"')) {
          const match = answer.match(/(\{.*"action":\s*"navigate".*\})/)
          if (match) {
            const cmd = JSON.parse(match[1])
            if (cmd.action === "navigate") {
              const safePath = safeNavigationPath(cmd.url)
              displayText = answer.replace(match[0], "").trim()
              if (safePath) {
                router.push(safePath)
                displayText ||= "Navegando..."
              } else {
                displayText ||= "No pude abrir esa ruta."
              }
            }
          }
        }
      } catch (e) {
        console.error("Error parseando comando", e)
      }

      setMessages((prev) => (
        [...prev, { sender: "bot", text: displayText, trace } as Message]
          .slice(-MAX_STORED_MESSAGES)
      ))
      await updateCartCount?.()

    } catch (e) {
      setMessages((prev) => (
        [...prev, { sender: "bot", text: "Error de conexión." } as Message]
          .slice(-MAX_STORED_MESSAGES)
      ))
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
        <div className="fixed bottom-6 right-6 w-[380px] max-w-[calc(100vw-48px)] z-50 animate-in fade-in slide-in-from-bottom-10 duration-300">
          <Card className="flex flex-col h-[600px] max-h-[80vh] border-0 shadow-2xl rounded-2xl overflow-hidden bg-background/95 backdrop-blur-sm ring-1 ring-black/5">

            {/* Header Profesional */}
            <div className="p-4 bg-gradient-to-r from-[#003366] to-[#004080] text-white flex items-center justify-between shadow-md shrink-0">
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
            <div ref={chatRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50 dark:bg-zinc-900/50 scroll-smooth">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground mt-20 px-8">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="h-8 w-8 text-[#003366] dark:text-blue-400" />
                  </div>
                  <p className="font-medium text-foreground">¡Hola! 👋 Bienvenido a UCB Commerce.</p>
                  <p className="text-xs mt-2 leading-relaxed text-muted-foreground">
                    Soy tu asistente virtual con IA. Puedo ayudarte a:
                  </p>
                  <ul className="text-xs text-left list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                    <li>🔍 <b>Buscar productos</b> ("Busca hoodies de sistemas")</li>
                    <li>💰 <b>Consultar precios</b> ("¿Cuánto cuesta la taza?")</li>
                    <li>🛒 <b>Gestionar tu carrito</b> ("Agrega la mochila")</li>
                  </ul>
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

                  {/* Message Bubble + Trace Container */}
                  <div className={`flex flex-col gap-1 max-w-[85%] ${m.sender === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm w-full ${m.sender === "user"
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

                    {/* Sanitized tool activity (bot only). */}
                    {m.sender === "bot" && m.trace && m.trace.length > 0 && (
                      <div className="w-full">
                        <button
                          onClick={() => setExpandedTrace(expandedTrace === i ? null : i)}
                          className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors px-2 py-1"
                        >
                          <BrainCircuit className="w-3 h-3" />
                          {expandedTrace === i ? "Ocultar actividad" : "Ver actividad"}
                          {expandedTrace === i ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {expandedTrace === i && (
                          <div className="mt-1 ml-1 border-l-2 border-gray-200 dark:border-zinc-700 pl-3 space-y-3 py-2 animate-in slide-in-from-top-2 fade-in duration-200">
                            {m.trace.map((step, idx) => (
                              <div key={idx} className="text-xs space-y-1">
                                {/* TIPO: TOOL CALL */}
                                {step.type === "tool_call" && (
                                  <div className="flex gap-2 text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/20 p-1.5 rounded-md">
                                    <Wrench className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <div className="break-all">
                                      <span className="font-bold">{step.name}</span>
                                      <span className="opacity-70 ml-1">
                                        {JSON.stringify(step.args).slice(0, 100)}
                                        {JSON.stringify(step.args).length > 100 ? "..." : ""}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* TIPO: TOOL RESULT */}
                                {step.type === "tool_result" && (
                                  <div className="flex gap-2 text-green-600 dark:text-green-400 font-mono text-[10px] opacity-80 pl-6">
                                    <FileOutput className="w-3 h-3 shrink-0 mt-0.5" />
                                    <span className="line-clamp-3">
                                      Result: {step.content?.slice(0, 150)}...
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
            <div className="p-3 bg-background border-t shrink-0">
              <div className="relative flex items-center">
                <Input
                  placeholder="Escribe tu consulta..."
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  disabled={loading}
                  maxLength={MAX_QUESTION_LENGTH}
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
