import { z } from "zod"

export const assistantActionSchema = z.object({
  id: z.string().min(1).max(128),
  version: z.literal(1),
  type: z.enum([
    "navigate",
    "catalog.apply_filters",
    "catalog.clear_filters",
    "catalog.set_sort",
    "catalog.set_view",
    "product.set_quantity",
    "products.highlight",
    "cart.refresh",
    "orders.refresh",
  ]),
  payload: z.record(z.unknown()),
}).strict()

export type AssistantAction = z.infer<typeof assistantActionSchema>

export const renderableSchema = z.object({
  id: z.string().min(1).max(128),
  version: z.literal(1),
  type: z.enum([
    "product_list",
    "comparison",
    "cart_summary",
    "order_list",
    "suggestions",
  ]),
  data: z.record(z.unknown()),
}).strict()

export type AssistantRenderable = z.infer<typeof renderableSchema>

export const pendingConfirmationSchema = z.object({
  id: z.string().min(1).max(128),
  token: z.string().min(1).max(8_000),
  tool: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  arguments: z.record(z.unknown()),
  expires_at: z.number().int().positive(),
}).strict()

export type PendingConfirmation = z.infer<typeof pendingConfirmationSchema>

export type AssistantSurface =
  | "home"
  | "catalog"
  | "product"
  | "cart"
  | "orders"
  | "careers"
  | "career"
  | "login"
  | "unknown"

export type AssistantPageContext = {
  route: string
  surface: AssistantSurface
  revision: number
  capabilities: string[]
  state: Record<string, unknown>
}

export type AssistantActionReceipt = {
  action_id: string
  status: "succeeded" | "rejected" | "failed" | "unsupported"
  detail?: string
  resulting_revision?: number
}
