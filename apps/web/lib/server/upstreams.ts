export const UPSTREAM_ENV = {
  auth: "AUTH_API_URL",
  products: "PRODUCTS_API_URL",
  orders: "ORDERS_API_URL",
  chatbot: "CHATBOT_API_URL",
  images: "IMAGE_SERVICE_BASE_URL",
} as const

export type UpstreamName = keyof typeof UPSTREAM_ENV

export function getUpstreamBaseUrl(name: UpstreamName): string | null {
  const envName = UPSTREAM_ENV[name]
  const rawValue = process.env[envName]?.trim()
  if (!rawValue) return null

  try {
    const parsed = new URL(rawValue)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return rawValue.replace(/\/+$/, "")
  } catch {
    return null
  }
}
