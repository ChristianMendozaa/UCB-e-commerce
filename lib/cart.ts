// src/lib/cart.ts
"use client"

export type CartEntry = {
  productId: string
  quantity: number
}

export type CartResponse = {
  userId: string
  items: CartEntry[]
  updatedAt?: string
}

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized")
    throw new Error(`HTTP ${res.status}`)
  }
  // 204 No Content
  if (res.status === 204) return {} as T
  return res.json() as Promise<T>
}

export async function getCart(): Promise<CartEntry[]> {
  try {
    const data = await apiFetch<CartResponse>("/api/cart")
    return data.items || []
  } catch (e) {
    console.error("getCart error", e)
    return []
  }
}

export async function addToCart(productId: string, quantity: number): Promise<void> {
  await apiFetch("/api/cart/items", {
    method: "POST",
    body: JSON.stringify({ productId, quantity }),
  })
}

export async function updateQuantity(productId: string, quantity: number): Promise<void> {
  await apiFetch("/api/cart/items", {
    method: "PUT",
    body: JSON.stringify({ productId, quantity }),
  })
}

export async function removeFromCart(productId: string): Promise<void> {
  await apiFetch(`/api/cart/items/${productId}`, {
    method: "DELETE",
  })
}

export async function clearCart(): Promise<void> {
  await apiFetch("/api/cart", {
    method: "DELETE",
  })
}

/** Total de unidades para badge del header */
export async function getCartCount(): Promise<number> {
  const items = await getCart()
  return items.reduce((sum, it) => sum + it.quantity, 0)
}
