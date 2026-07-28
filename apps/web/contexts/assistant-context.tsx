"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  assistantActionSchema,
  type AssistantAction,
  type AssistantActionReceipt,
  type AssistantPageContext,
  type AssistantSurface,
} from "@/lib/assistant-protocol"
import { safeAssistantNavigationPath } from "@/lib/assistant-navigation"

type PageController = {
  surface: AssistantSurface
  capabilities: string[]
  state: Record<string, unknown>
  handleAction: (action: AssistantAction) => Promise<void> | void
}

type AssistantContextValue = {
  pageContext: AssistantPageContext
  executeAction: (value: unknown) => Promise<AssistantActionReceipt>
  registerController: (controller: PageController) => () => void
}

const AssistantContext = createContext<AssistantContextValue | null>(null)

function surfaceForPath(pathname: string): AssistantSurface {
  if (pathname === "/") return "home"
  if (pathname === "/catalog") return "catalog"
  if (pathname.startsWith("/products/")) return "product"
  if (pathname === "/cart") return "cart"
  if (pathname === "/orders") return "orders"
  if (pathname === "/careers") return "careers"
  if (pathname.startsWith("/careers/")) return "career"
  if (pathname === "/login") return "login"
  return "unknown"
}

async function reportReceipt(receipt: AssistantActionReceipt) {
  try {
    await fetch("/api/chat/actions/receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receipt }),
      keepalive: true,
    })
  } catch {
    // A receipt is observability, never a reason to roll back a safe UI effect.
  }
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const controllerRef = useRef<PageController | null>(null)
  const [controllerSnapshot, setControllerSnapshot] = useState<PageController | null>(null)
  const [revision, setRevision] = useState(0)

  const registerController = useCallback((controller: PageController) => {
    controllerRef.current = controller
    setControllerSnapshot(controller)
    setRevision((current) => current + 1)
    try {
      const deferredRaw = sessionStorage.getItem("ucb_assistant_deferred_action")
      if (deferredRaw) {
        const deferred = assistantActionSchema.safeParse(JSON.parse(deferredRaw))
        if (
          deferred.success
          && controller.capabilities.includes(deferred.data.type)
        ) {
          sessionStorage.removeItem("ucb_assistant_deferred_action")
          Promise.resolve(controller.handleAction(deferred.data)).catch(() => undefined)
        }
      }
    } catch {
      sessionStorage.removeItem("ucb_assistant_deferred_action")
    }
    return () => {
      if (controllerRef.current === controller) {
        controllerRef.current = null
        setControllerSnapshot(null)
      }
    }
  }, [])

  useEffect(() => {
    setRevision((current) => current + 1)
  }, [pathname])

  const pageContext = useMemo<AssistantPageContext>(() => ({
    route: pathname,
    surface: controllerSnapshot?.surface ?? surfaceForPath(pathname),
    revision,
    capabilities: controllerSnapshot?.capabilities ?? ["navigate"],
    state: controllerSnapshot?.state ?? {},
  }), [pathname, revision, controllerSnapshot])

  const executeAction = useCallback(async (value: unknown) => {
    const parsed = assistantActionSchema.safeParse(value)
    if (!parsed.success) {
      const receipt: AssistantActionReceipt = {
        action_id: typeof value === "object" && value && "id" in value
          ? String(value.id)
          : "invalid",
        status: "rejected",
        detail: "La acción no cumple el contrato permitido.",
      }
      await reportReceipt(receipt)
      return receipt
    }
    const action = parsed.data
    try {
      if (action.type === "navigate") {
        const path = safeAssistantNavigationPath(action.payload.url)
        if (!path) throw new Error("Destino de navegación no permitido.")
        router.push(path)
      } else {
        const controller = controllerRef.current
        if (!controller || !controller.capabilities.includes(action.type)) {
          if (
            action.type.startsWith("catalog.")
            || action.type === "products.highlight"
          ) {
            sessionStorage.setItem(
              "ucb_assistant_deferred_action",
              JSON.stringify(action),
            )
            router.push("/catalog")
            const receipt: AssistantActionReceipt = {
              action_id: action.id,
              status: "succeeded",
              detail: "Acción diferida hasta cargar el catálogo.",
              resulting_revision: revision + 1,
            }
            await reportReceipt(receipt)
            return receipt
          }
          if (
            action.type === "product.set_quantity"
            && typeof action.payload.product_id === "string"
          ) {
            sessionStorage.setItem(
              "ucb_assistant_deferred_action",
              JSON.stringify(action),
            )
            router.push(
              `/products/${encodeURIComponent(action.payload.product_id)}`,
            )
            const receipt: AssistantActionReceipt = {
              action_id: action.id,
              status: "succeeded",
              detail: "Acción diferida hasta cargar el producto.",
              resulting_revision: revision + 1,
            }
            await reportReceipt(receipt)
            return receipt
          }
          if (action.type === "cart.refresh" || action.type === "orders.refresh") {
            const receipt: AssistantActionReceipt = {
              action_id: action.id,
              status: "succeeded",
              detail: "No hay una vista abierta que necesite refrescarse.",
              resulting_revision: revision,
            }
            await reportReceipt(receipt)
            return receipt
          }
          const receipt: AssistantActionReceipt = {
            action_id: action.id,
            status: "unsupported",
            detail: `La página actual no admite ${action.type}.`,
            resulting_revision: revision,
          }
          await reportReceipt(receipt)
          return receipt
        }
        await controller.handleAction(action)
      }
      const receipt: AssistantActionReceipt = {
        action_id: action.id,
        status: "succeeded",
        resulting_revision: revision + 1,
      }
      setRevision((current) => current + 1)
      await reportReceipt(receipt)
      return receipt
    } catch (error) {
      const receipt: AssistantActionReceipt = {
        action_id: action.id,
        status: "failed",
        detail: error instanceof Error ? error.message : "La acción falló.",
        resulting_revision: revision,
      }
      await reportReceipt(receipt)
      return receipt
    }
  }, [revision, router])

  return (
    <AssistantContext.Provider
      value={{ pageContext, executeAction, registerController }}
    >
      {children}
    </AssistantContext.Provider>
  )
}

export function useAssistant() {
  const context = useContext(AssistantContext)
  if (!context) {
    throw new Error("useAssistant must be used within AssistantProvider")
  }
  return context
}

export function useAssistantPage(controller: PageController) {
  const { registerController } = useAssistant()
  useEffect(
    () => registerController(controller),
    [
      registerController,
      controller.surface,
      controller.handleAction,
      JSON.stringify(controller.capabilities),
      JSON.stringify(controller.state),
    ],
  )
}
