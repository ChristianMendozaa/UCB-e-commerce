"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Minus, Trash2, ShoppingBag, ArrowLeft, CreditCard } from "lucide-react"
import type { CartItem, Product } from "@/lib/database"
import { db } from "@/lib/database"
import { authService } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"

interface CartItemWithProduct extends CartItem {
  product: Product
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const user = authService.getCurrentUser()
    if (!user) {
      router.push("/login")
      return
    }
    loadCartItems()
  }, [router])

  const loadCartItems = async () => {
    const user = authService.getCurrentUser()
    if (!user) return

    setIsLoading(true)
    try {
      const items = await db.getCartItems(user.id)
      const itemsWithProducts = await Promise.all(
        items.map(async (item) => {
          const product = await db.getProduct(item.productId)
          return { ...item, product: product! }
        }),
      )
      setCartItems(itemsWithProducts.filter((item) => item.product))
    } catch (error) {
      console.error("Error loading cart:", error)
      toast({
        title: "Error",
        description: "No se pudo cargar el carrito",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return

    setIsUpdating(itemId)
    try {
      await db.updateCartItem(itemId, newQuantity)
      setCartItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, quantity: newQuantity } : item)))
      toast({
        title: "Cantidad actualizada",
        description: "La cantidad del producto ha sido actualizada",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la cantidad",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(null)
    }
  }

  const removeItem = async (itemId: string) => {
    setIsUpdating(itemId)
    try {
      await db.removeFromCart(itemId)
      setCartItems((prev) => prev.filter((item) => item.id !== itemId))
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido eliminado del carrito",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el producto",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(null)
    }
  }

  const proceedToCheckout = async () => {
    const user = authService.getCurrentUser()
    if (!user) return

    try {
      // Crear orden
      const orderItems = cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.product.price,
      }))

      const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

      await db.createOrder({
        userId: user.id,
        items: orderItems,
        total,
        status: "pending",
      })

      // Limpiar carrito
      for (const item of cartItems) {
        await db.removeFromCart(item.id)
      }

      toast({
        title: "¡Pedido realizado!",
        description: "Tu pedido ha sido procesado exitosamente",
      })

      router.push("/orders")
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo procesar el pedido",
        variant: "destructive",
      })
    }
  }

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex space-x-4">
                      <div className="w-20 h-20 bg-muted rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                        <div className="h-6 bg-muted rounded w-1/4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/catalog"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Continuar comprando
            </Link>
            <h1 className="text-3xl font-bold">Carrito de Compras</h1>
            <p className="text-muted-foreground">
              {totalItems} producto{totalItems !== 1 ? "s" : ""} en tu carrito
            </p>
          </div>

          {cartItems.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Tu carrito está vacío</h3>
                <p className="text-muted-foreground mb-6">Agrega algunos productos para comenzar tu compra</p>
                <Link href="/catalog">
                  <Button>Explorar productos</Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                {cartItems.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-6">
                      <div className="flex space-x-4">
                        {/* Product Image */}
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted">
                          <Image
                            src={item.product.image || "/placeholder.svg"}
                            alt={item.product.name}
                            fill
                            className="object-cover"
                          />
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg truncate">{item.product.name}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-2">{item.product.description}</p>
                              <div className="flex items-center space-x-2 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {item.product.career}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {item.product.category}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.id)}
                              disabled={isUpdating === item.id}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Quantity and Price */}
                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1 || isUpdating === item.id}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-12 text-center font-medium">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                disabled={item.quantity >= item.product.stock || isUpdating === item.id}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Bs. {item.product.price} c/u</p>
                              <p className="text-lg font-bold text-primary">
                                Bs. {(item.product.price * item.quantity).toFixed(2)}
                              </p>
                            </div>
                          </div>

                          {/* Stock Warning */}
                          {item.quantity >= item.product.stock && (
                            <Alert className="mt-3">
                              <AlertDescription className="text-sm">
                                Stock máximo alcanzado ({item.product.stock} disponibles)
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <Card className="sticky top-8">
                  <CardHeader>
                    <CardTitle>Resumen del Pedido</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal ({totalItems} productos)</span>
                        <span>Bs. {totalPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Envío</span>
                        <span className="text-green-600">Gratis</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total</span>
                        <span className="text-primary">Bs. {totalPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button onClick={proceedToCheckout} className="w-full" size="lg">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Proceder al Pago
                    </Button>

                    <div className="text-center">
                      <Link href="/catalog">
                        <Button variant="ghost" size="sm">
                          Continuar comprando
                        </Button>
                      </Link>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>• Envío gratuito en toda Bolivia</p>
                      <p>• Garantía de calidad UCB</p>
                      <p>• Soporte técnico incluido</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
