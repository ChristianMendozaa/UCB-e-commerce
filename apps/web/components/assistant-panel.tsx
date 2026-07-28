"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Bot,
  Check,
  ChevronRight,
  Loader2,
  MessageCircle,
  Send,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react"
import { useAssistant } from "@/contexts/assistant-context"
import { useCart } from "@/contexts/cart-context"
import { useAuth } from "@/lib/auth"
import {
  assistantActionSchema,
  pendingConfirmationSchema,
  renderableSchema,
  type AssistantRenderable,
  type PendingConfirmation,
} from "@/lib/assistant-protocol"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type Message = {
  id: string
  sender: "user" | "bot"
  text: string
  renderables?: AssistantRenderable[]
}

const MAX_HISTORY = 20
const MAX_STORED_MESSAGES = 100
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

function storageKey(userId?: string) {
  return `ucb_assistant_history:${userId || "anonymous"}`
}

function loadMessages(key: string): Message[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "{}")
    if (
      typeof value !== "object"
      || value === null
      || typeof value.savedAt !== "number"
      || Date.now() - value.savedAt > RETENTION_MS
      || !Array.isArray(value.messages)
    ) {
      localStorage.removeItem(key)
      return []
    }
    return value.messages
      .filter((message: unknown): message is Message => (
        typeof message === "object"
        && message !== null
        && "id" in message
        && "sender" in message
        && "text" in message
        && typeof message.id === "string"
        && (message.sender === "user" || message.sender === "bot")
        && typeof message.text === "string"
      ))
      .map((message: Message) => {
        const renderables = Array.isArray(message.renderables)
          ? message.renderables.flatMap((renderable) => {
              const parsed = renderableSchema.safeParse(renderable)
              return parsed.success ? [parsed.data] : []
            })
          : undefined
        return {
          id: message.id,
          sender: message.sender,
          text: message.text.slice(0, 20_000),
          renderables,
        }
      })
      .slice(-MAX_STORED_MESSAGES)
  } catch {
    return []
  }
}

function ProductList({ value }: { value: AssistantRenderable }) {
  const items = Array.isArray(value.data.items) ? value.data.items : []
  if (items.length === 0) return null
  return (
    <div className="mt-2 space-y-2">
      {items.slice(0, 4).map((raw, index) => {
        const item = raw as Record<string, unknown>
        const id = typeof item.id === "string" ? item.id : ""
        return (
          <div key={id || index} className="rounded-xl border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {String(item.name ?? "Producto")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.career ? String(item.career) : "UCB"}
                  {item.category ? ` · ${String(item.category)}` : ""}
                </p>
              </div>
              {typeof item.price === "number" && (
                <Badge variant="secondary">Bs. {item.price}</Badge>
              )}
            </div>
            {id && (
              <Link
                href={`/products/${encodeURIComponent(id)}`}
                className="mt-2 inline-flex items-center text-xs font-medium text-primary"
              >
                Ver producto <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Comparison({ value }: { value: AssistantRenderable }) {
  const items = Array.isArray(value.data.items) ? value.data.items : []
  if (items.length < 2) return null
  return (
    <div className="mt-2 overflow-x-auto rounded-xl border bg-background">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">Producto</th>
            <th className="p-2 text-right">Precio</th>
            <th className="p-2 text-right">Stock</th>
          </tr>
        </thead>
        <tbody>
          {items.map((raw, index) => {
            const item = raw as Record<string, unknown>
            return (
              <tr key={String(item.id ?? index)} className="border-b last:border-0">
                <td className="p-2 font-medium">{String(item.name ?? "Producto")}</td>
                <td className="p-2 text-right">Bs. {String(item.price ?? "—")}</td>
                <td className="p-2 text-right">{String(item.stock ?? "—")}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function GenericSummary({ value }: { value: AssistantRenderable }) {
  const items = Array.isArray(value.data.items) ? value.data.items : []
  if (items.length === 0) return null
  return (
    <div className="mt-2 rounded-xl border bg-background p-3 text-xs">
      {items.slice(0, 5).map((raw, index) => {
        const item = raw as Record<string, unknown>
        return (
          <div key={String(item.id ?? item.product_id ?? index)} className="py-1">
            <span className="font-medium">
              {String(item.name ?? item.id ?? "Elemento")}
            </span>
            {item.quantity ? ` · ${String(item.quantity)} unidad(es)` : ""}
            {item.status ? ` · ${String(item.status)}` : ""}
          </div>
        )
      })}
    </div>
  )
}

function RenderableView({ value }: { value: AssistantRenderable }) {
  if (value.type === "product_list") return <ProductList value={value} />
  if (value.type === "comparison") return <Comparison value={value} />
  return <GenericSummary value={value} />
}

export function AssistantPanel() {
  const { user } = useAuth()
  const { pageContext, executeAction } = useAssistant()
  const { updateCartCount } = useCart()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [activity, setActivity] = useState("")
  const [pending, setPending] = useState<PendingConfirmation | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [preferences, setPreferences] = useState({
    career: "",
    budget_min: "",
    budget_max: "",
    categories: "",
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  const currentStorageKey = useMemo(() => storageKey(user?.id), [user?.id])

  useEffect(() => {
    localStorage.removeItem("chat_history")
    setMessages(loadMessages(currentStorageKey))
    setPending(null)
  }, [currentStorageKey])

  useEffect(() => {
    if (!user) {
      setPreferences({
        career: "",
        budget_min: "",
        budget_max: "",
        categories: "",
      })
      return
    }
    fetch("/api/chat/preferences", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => {
        if (!value) return
        setPreferences({
          career: typeof value.career === "string" ? value.career : "",
          budget_min: typeof value.budget_min === "number"
            ? String(value.budget_min)
            : "",
          budget_max: typeof value.budget_max === "number"
            ? String(value.budget_max)
            : "",
          categories: Array.isArray(value.categories)
            ? value.categories.join(", ")
            : "",
        })
      })
      .catch(() => undefined)
  }, [user])

  useEffect(() => {
    localStorage.setItem(
      currentStorageKey,
      JSON.stringify({
        savedAt: Date.now(),
        messages: messages.slice(-MAX_STORED_MESSAGES),
      }),
    )
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [currentStorageKey, messages, pending, loading])

  async function handleSse(response: Response, botMessageId: string) {
    if (!response.ok || !response.body) throw new Error("Chat no disponible")
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let renderables: AssistantRenderable[] = []

    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const blocks = buffer.split("\n\n")
      buffer = blocks.pop() ?? ""
      for (const block of blocks) {
        const eventLine = block.split("\n").find((line) => line.startsWith("event:"))
        const dataLine = block.split("\n").find((line) => line.startsWith("data:"))
        if (!eventLine || !dataLine) continue
        const event = eventLine.slice("event:".length).trim()
        const data = JSON.parse(dataLine.slice("data:".length).trim())
        if (event === "assistant.delta" && typeof data.delta === "string") {
          setActivity("")
          setMessages((current) => current.map((message) => (
            message.id === botMessageId
              ? { ...message, text: message.text + data.delta }
              : message
          )))
        } else if (
          event === "tool.status"
          && typeof data.message === "string"
        ) {
          setActivity(data.message.slice(0, 160))
        } else if (event === "turn.completed") {
          setActivity("")
        } else if (event === "renderable") {
          const parsed = renderableSchema.safeParse(data)
          if (parsed.success) {
            renderables = [...renderables, parsed.data]
            setMessages((current) => current.map((message) => (
              message.id === botMessageId
                ? { ...message, renderables }
                : message
            )))
          }
        } else if (event === "ui.action") {
          const parsed = assistantActionSchema.safeParse(data)
          if (parsed.success) await executeAction(parsed.data)
        } else if (event === "confirmation.required") {
          const parsed = pendingConfirmationSchema.safeParse(data)
          if (parsed.success) setPending(parsed.data)
        }
      }
      if (done) break
    }
  }

  async function sendMessage(text = input) {
    const userText = text.trim()
    if (!userText || loading) return
    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: "user",
      text: userText,
    }
    const botMessageId = crypto.randomUUID()
    const history = messages.slice(-MAX_HISTORY).map((message) => ({
      sender: message.sender,
      text: message.text.slice(0, 4_000),
    }))
    setMessages((current) => [
      ...current,
      userMessage,
      { id: botMessageId, sender: "bot", text: "" } as Message,
    ].slice(-MAX_STORED_MESSAGES))
    setInput("")
    setLoading(true)
    setActivity("Analizando tu solicitud…")
    try {
      const response = await fetch("/api/chat/turns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userText,
          history,
          page_context: {
            ...pageContext,
            state: {
              ...pageContext.state,
              assistant_preferences: {
                career: preferences.career || null,
                budget_min: preferences.budget_min
                  ? Number(preferences.budget_min)
                  : null,
                budget_max: preferences.budget_max
                  ? Number(preferences.budget_max)
                  : null,
                categories: preferences.categories
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
              },
            },
          },
          receipts: [],
          pending_confirmation_token: pending?.token ?? null,
        }),
      })
      await handleSse(response, botMessageId)
      if (pending && /^(sí|si|confirmo|confirma|sí,\s*confirma|si,\s*confirma|hazlo)[.!]?$/i.test(userText)) {
        setPending(null)
      }
      await updateCartCount()
    } catch {
      setMessages((current) => current.map((message) => (
        message.id === botMessageId
          ? { ...message, text: "No pude conectar con el vendedor virtual." }
          : message
      )))
    } finally {
      setLoading(false)
      setActivity("")
    }
  }

  async function decideConfirmation(decision: "approve" | "reject") {
    if (!pending || confirming) return
    setConfirming(true)
    try {
      const response = await fetch("/api/chat/confirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pending.token, decision }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error ?? "Confirmación inválida")
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "bot",
          text: String(data.answer ?? "Acción procesada."),
        },
      ])
      for (const value of Array.isArray(data.ui_actions) ? data.ui_actions : []) {
        await executeAction(value)
      }
      setPending(null)
      await updateCartCount()
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "bot",
          text: error instanceof Error ? error.message : "No pude confirmar la acción.",
        },
      ])
    } finally {
      setConfirming(false)
    }
  }

  function clearConversation() {
    setMessages([])
    setPending(null)
    localStorage.removeItem(currentStorageKey)
  }

  async function savePreferences() {
    if (!user) return
    try {
      const response = await fetch("/api/chat/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          career: preferences.career.trim() || null,
          budget_min: preferences.budget_min ? Number(preferences.budget_min) : null,
          budget_max: preferences.budget_max ? Number(preferences.budget_max) : null,
          categories: preferences.categories
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      })
      if (!response.ok) throw new Error("No se pudieron guardar las preferencias.")
      setShowPreferences(false)
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "bot",
          text: "Guardé estas preferencias porque lo confirmaste. Puedes borrarlas cuando quieras.",
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "bot",
          text: error instanceof Error
            ? error.message
            : "No se pudieron guardar las preferencias.",
        },
      ])
    }
  }

  async function deletePreferences() {
    if (!user) return
    try {
      const response = await fetch("/api/chat/preferences", { method: "DELETE" })
      if (!response.ok) throw new Error("No se pudieron borrar las preferencias.")
      setPreferences({
        career: "",
        budget_min: "",
        budget_max: "",
        categories: "",
      })
      setShowPreferences(false)
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "bot",
          text: error instanceof Error
            ? error.message
            : "No se pudieron borrar las preferencias.",
        },
      ])
    }
  }

  const suggestionForSurface = pageContext.surface === "catalog"
    ? ["Ayúdame a elegir", "Ordena por menor precio"]
    : pageContext.surface === "product"
      ? ["¿Este producto me conviene?", "Busca alternativas"]
      : pageContext.surface === "cart"
        ? ["Resume mi carrito", "¿Qué me falta para pedir?"]
        : ["Busca productos para mi carrera", "Quiero comprar con un presupuesto"]

  if (pageContext.route === "/admin") return null

  return (
    <>
      {!isOpen && (
        <Button
          aria-label="Abrir vendedor virtual"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#003366] p-0 shadow-2xl hover:bg-[#002244]"
        >
          <MessageCircle className="h-7 w-7" />
        </Button>
      )}
      {isOpen && (
        <aside
          aria-label="Vendedor virtual UCB"
          className="fixed inset-x-3 bottom-3 z-50 flex h-[78vh] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl md:inset-y-4 md:left-auto md:right-4 md:h-auto md:w-[430px]"
        >
          <header className="flex items-center justify-between bg-[#003366] px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/15 p-2">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Vendedor virtual UCB</p>
                <p className="text-xs text-blue-100">
                  Puede guiar y controlar esta página
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => setShowPreferences((value) => !value)}
                aria-label="Preferencias del vendedor"
                title="Preferencias"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={clearConversation}
                aria-label="Limpiar conversación"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar vendedor virtual"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-muted/30 p-4">
            {showPreferences && (
              <div className="rounded-2xl border bg-background p-4">
                <h2 className="font-semibold">Preferencias del vendedor</h2>
                {!user ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Inicia sesión para guardar preferencias entre visitas.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Solo se guardan los datos que escribas y confirmes aquí.
                    </p>
                    <div className="mt-3 space-y-2">
                      <Input
                        placeholder="Carrera"
                        value={preferences.career}
                        onChange={(event) => setPreferences((current) => ({
                          ...current,
                          career: event.target.value,
                        }))}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          min="0"
                          placeholder="Presupuesto mín."
                          value={preferences.budget_min}
                          onChange={(event) => setPreferences((current) => ({
                            ...current,
                            budget_min: event.target.value,
                          }))}
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="Presupuesto máx."
                          value={preferences.budget_max}
                          onChange={(event) => setPreferences((current) => ({
                            ...current,
                            budget_max: event.target.value,
                          }))}
                        />
                      </div>
                      <Input
                        placeholder="Categorías, separadas por coma"
                        value={preferences.categories}
                        onChange={(event) => setPreferences((current) => ({
                          ...current,
                          categories: event.target.value,
                        }))}
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" onClick={deletePreferences}>
                        Borrar
                      </Button>
                      <Button size="sm" onClick={savePreferences}>
                        Guardar con mi permiso
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
            {messages.length === 0 && (
              <div className="mx-auto mt-8 max-w-sm text-center">
                <Sparkles className="mx-auto h-10 w-10 text-primary" />
                <h2 className="mt-3 font-semibold">¿Qué necesitas encontrar?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Puedo entender tu necesidad, comparar productos, ajustar la página y acompañarte hasta el pedido.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {suggestionForSurface.map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      onClick={() => sendMessage(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={message.sender === "user" ? "ml-10" : "mr-6"}
              >
                <div className={`rounded-2xl px-4 py-3 text-sm ${
                  message.sender === "user"
                    ? "bg-[#003366] text-white"
                    : "border bg-background"
                }`}>
                  {message.sender === "bot" ? (
                    message.text ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.text}
                      </ReactMarkdown>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {activity || "Preparando una recomendación…"}
                      </span>
                    )
                  ) : message.text}
                </div>
                {message.renderables?.map((renderable) => (
                  <RenderableView key={renderable.id} value={renderable} />
                ))}
              </div>
            ))}

            {loading && activity && messages.at(-1)?.text && (
              <div className="mr-6 inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {activity}
              </div>
            )}

            {pending && (
              <div className="rounded-2xl border-2 border-primary/30 bg-background p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <ShoppingCart className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">{pending.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pending.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => decideConfirmation("reject")}
                    disabled={confirming}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => decideConfirmation("approve")}
                    disabled={confirming}
                  >
                    {confirming
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Check className="mr-2 h-4 w-4" />}
                    Confirmar
                  </Button>
                </div>
              </div>
            )}
          </div>

          <footer className="border-t bg-background p-3">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 2_000))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Cuéntame qué estás buscando…"
                disabled={loading}
                maxLength={2_000}
                aria-label="Mensaje para el vendedor virtual"
              />
              <Button
                size="icon"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                aria-label="Enviar mensaje"
              >
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Las compras y cambios del carrito siempre requieren tu confirmación.
            </p>
          </footer>
        </aside>
      )}
    </>
  )
}
