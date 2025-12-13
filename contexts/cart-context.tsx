// contexts/cart-context.tsx
"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { getCartCount } from "@/lib/cart"
import { useAuth } from "@/lib/auth"

interface CartContextType {
  cartCount: number
  updateCartCount: () => Promise<void>
  optimisticAdd: (qty: number) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartCount, setCartCount] = useState(0)
  const { user } = useAuth()

  const updateCartCount = async () => {
    if (!user) {
      setCartCount(0)
      return
    }
    try {
      const count = await getCartCount()
      setCartCount(count)
    } catch (e) {
      console.error(e)
    }
  }

  const optimisticAdd = (qty: number) => {
    setCartCount((prev) => prev + qty)
  }

  useEffect(() => {
    updateCartCount()
  }, [user])

  return (
    <CartContext.Provider value={{ cartCount, updateCartCount, optimisticAdd }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within a CartProvider")
  return ctx
}
