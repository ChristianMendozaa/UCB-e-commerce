// src/lib/cart-local.ts
"use client"

export type CartEntry = {
  productId: string
  quantity: number
}

const KEY = "ucb_cart_v1"

function readRaw(): CartEntry[] {
  if (typeof window === "undefined") return []
  try {
    const s = localStorage.getItem(KEY)
    return s ? (JSON.parse(s) as CartEntry[]) : []
  } catch {
    return []
  }
}

function writeRaw(items: CartEntry[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, JSON.stringify(items))
}

export function getCart(): CartEntry[] {
  return readRaw()
}

export function setCart(items: CartEntry[]) {
  writeRaw(items)
}

export function addToCart(productId: string, quantity: number) {
  const q = Math.max(1, Math.floor(quantity))
  const items = readRaw()
  const idx = items.findIndex((x) => x.productId === productId)
  if (idx >= 0) {
    items[idx] = { ...items[idx], quantity: items[idx].quantity + q }
  } else {
    items.push({ productId, quantity: q })
  }
  writeRaw(items)
}

export function updateQuantity(productId: string, quantity: number) {
  const q = Math.max(1, Math.floor(quantity))
  const items = readRaw()
  const idx = items.findIndex((x) => x.productId === productId)
  if (idx >= 0) {
    items[idx] = { ...items[idx], quantity: q }
    writeRaw(items)
  }
}

export function removeFromCart(productId: string) {
  const items = readRaw().filter((x) => x.productId !== productId)
  writeRaw(items)
}

export function clearCart() {
  writeRaw([])
}

/** Total de unidades para badge del header */
export function getCartCount(): number {
  return readRaw().reduce((sum, it) => sum + it.quantity, 0)
}
