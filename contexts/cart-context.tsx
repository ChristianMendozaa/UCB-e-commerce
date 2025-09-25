"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { db } from "@/lib/database"
import { authService } from "@/lib/auth"

interface CartContextType {
  cartCount: number
  updateCartCount: () => Promise<void>
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartCount, setCartCount] = useState(0)

  const updateCartCount = async () => {
    const user = authService.getCurrentUser()
    if (user) {
      const cartItems = await db.getCartItems(user.id)
      const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)
      setCartCount(totalItems)
    } else {
      setCartCount(0)
    }
  }

  useEffect(() => {
    updateCartCount()
  }, [])

  return <CartContext.Provider value={{ cartCount, updateCartCount }}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
