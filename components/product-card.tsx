// components/product-card.tsx
"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Plus, Minus } from "lucide-react"

import type { Product } from "@/lib/products"
import { authService } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { useCart } from "@/contexts/cart-context"
import { addToCart as addToLocalCart } from "@/lib/cart" // ⬅️ carrito en localStorage

interface ProductCardProps {
  product: Product
  onAddToCart?: () => void
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1)
  const { updateCartCount, optimisticAdd } = useCart()
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleAddToCart = async () => {
    const user = authService.getCurrentUser()
    if (!user) {
      toast({
        title: "Inicia sesión",
        description: "Debes iniciar sesión para agregar productos al carrito",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    // Optimistic update
    optimisticAdd(quantity)
    toast({
      title: "Producto agregado",
      description: `${product.name} agregado al carrito`,
    })
    onAddToCart?.()

    try {
      // ⬇️ Guardamos en backend
      await addToLocalCart(product.id, quantity)
      // Confirmamos con el backend (opcional, pero buena práctica para consistencia final)
      await updateCartCount?.()
    } catch (error: any) {
      // Si falla, revertimos (o simplemente recargamos el contador real)
      await updateCartCount?.()
      toast({
        title: "Error",
        description: error?.message || "No se pudo agregar el producto al carrito",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const incrementQuantity = () => {
    if (quantity < product.stock) setQuantity(quantity + 1)
  }

  const decrementQuantity = () => {
    if (quantity > 1) setQuantity(quantity - 1)
  }

  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-all duration-300">
      <CardHeader className="p-0">
        <Link href={`/products/${product.id}`}>
          <div className="relative aspect-square overflow-hidden rounded-t-lg cursor-pointer">
            <Image
              src={product.image || "/placeholder.svg"}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-300 hover:scale-105"
            />
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="bg-background/80 backdrop-blur">
                {product.career}
              </Badge>
            </div>
            {product.stock <= 5 && product.stock > 0 && (
              <div className="absolute top-2 left-2">
                <Badge variant="destructive" className="bg-destructive/80 backdrop-blur">
                  ¡Últimas {product.stock}!
                </Badge>
              </div>
            )}
            {product.stock === 0 && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur flex items-center justify-center">
                <Badge variant="destructive">Agotado</Badge>
              </div>
            )}
          </div>
        </Link>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4">
        <div className="flex-1">
          <Link href={`/products/${product.id}`}>
            <CardTitle className="text-lg mb-2 line-clamp-2 hover:text-primary cursor-pointer transition-colors">
              {product.name}
            </CardTitle>
          </Link>
          <CardDescription className="text-sm mb-3 line-clamp-3">{product.description}</CardDescription>

          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-2xl font-bold text-primary">Bs. {Number(product.price).toFixed(2)}</p>
              <Badge variant="outline" className="text-xs">
                {product.category}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Stock: {product.stock}</p>
            </div>
          </div>
        </div>

        {product.stock > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-center space-x-2">
              <Button variant="outline" size="sm" onClick={decrementQuantity} disabled={quantity <= 1 || isLoading}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={incrementQuantity}
                disabled={quantity >= product.stock || isLoading}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={handleAddToCart} disabled={isLoading} className="w-full">
              {isLoading ? (
                "Agregando..."
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Agregar al carrito
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
