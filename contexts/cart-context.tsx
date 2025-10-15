// contexts/cart-context.tsx
"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { getCartCount } from "@/lib/cart"

// Mantén el KEY sincronizado con cart-local.ts
const CART_KEY = "ucb_cart_v1"

interface CartContextType {
  cartCount: number
  updateCartCount: () => Promise<void> | void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartCount, setCartCount] = useState(0)

  const updateCartCount = () => {
    setCartCount(getCartCount())
  }

  useEffect(() => {
    // Inicial
    updateCartCount()

    // Cambios entre pestañas
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === CART_KEY) updateCartCount()
    }
    window.addEventListener("storage", onStorage)

    // Al volver a la pestaña/ventana
    const onVisibility = () => {
      if (document.visibilityState === "visible") updateCartCount()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.removeEventListener("storage", onStorage)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return (
    <CartContext.Provider value={{ cartCount, updateCartCount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within a CartProvider")
  return ctx
}
