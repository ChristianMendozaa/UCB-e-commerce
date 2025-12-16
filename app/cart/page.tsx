// app/(ruta)/cart/page.tsx
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
import { Plus, Minus, Trash2, ShoppingBag, ArrowLeft, CreditCard, LogIn } from "lucide-react"
import { authService, type AuthUser } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { useCart } from "@/contexts/cart-context"
import { getCart, getCartDetails, updateQuantity as lsUpdate, removeFromCart as lsRemove, clearCart } from "@/lib/cart"
import { productsApi, type Product } from "@/lib/products"
import { ordersApi } from "@/lib/orders"

type HydratedItem = {
  productId: string
  quantity: number
  product?: Product
}

export default function CartPage() {
  const [items, setItems] = useState<HydratedItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const { updateCartCount } = useCart()

  useEffect(() => {
    let mounted = true
      ; (async () => {
        const u = await authService.getCurrentUser().catch(() => null)
        if (!mounted) return
        setUser(u)
        await load()
      })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setIsLoading(true)
    try {
      // Use the optimized endpoint that returns everything in one request
      const items = await getCartDetails()

      const hydrated: HydratedItem[] = items.map(it => ({
        productId: it.productId,
        quantity: it.quantity,
        product: {
          id: it.productId,
          name: it.name || "Producto desconocido",
          price: it.price || 0,
          image: it.image || "/placeholder.svg",
          description: it.description || "",
          category: it.category || "",
          career: it.career || "",
          stock: it.stock || 0,
          createdAt: "",
          updatedAt: "",
          createdBy: ""
        }
      }))
      setItems(hydrated)
    } finally {
      setIsLoading(false)
    }
  }

  async function updateQty(productId: string, q: number) {
    if (q < 1) return
    setIsUpdating(productId)
    try {
      await lsUpdate(productId, q)
      setItems((prev) => prev.map((it) => (it.productId === productId ? { ...it, quantity: q } : it)))
      await updateCartCount?.()
      toast({ title: "Cantidad actualizada", description: "La cantidad del producto ha sido actualizada" })
    } finally {
      setIsUpdating(null)
    }
  }

  async function remove(productId: string) {
    setIsUpdating(productId)
    try {
      await lsRemove(productId)
      setItems((prev) => prev.filter((it) => it.productId !== productId))
      await updateCartCount?.()
      toast({ title: "Producto eliminado", description: "El producto ha sido eliminado del carrito" })
    } finally {
      setIsUpdating(null)
    }
  }

  async function proceedToCheckout() {
    // guardia extra por si se pierde la sesión
    const u = await authService.getCurrentUser().catch(() => null)
    if (!u) {
      router.push("/login")
      return
    }
    try {
      await ordersApi.createOrder({})
      clearCart()
      await updateCartCount?.()
      toast({ title: "¡Pedido realizado!", description: "Tu pedido ha sido procesado exitosamente" })
      router.push("/orders")
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No se pudo procesar el pedido", variant: "destructive" })
    }
  }

  const totalItems = items.reduce((s, it) => s + it.quantity, 0)
  const totalPrice = items.reduce((s, it) => s + ((it.product?.price ?? 0) * it.quantity), 0)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-4">
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
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Link href="/catalog" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Continuar comprando
            </Link>
            <h1 className="text-3xl font-bold">Carrito de Compras</h1>
            <p className="text-muted-foreground">
              {totalItems} producto{totalItems !== 1 ? "s" : ""} en tu carrito
            </p>
          </div>

          {items.length === 0 ? (
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
              <div className="lg:col-span-2 space-y-4">
                {items.map((item) => (
                  <Card key={item.productId}>
                    <CardContent className="p-6">
                      <div className="flex space-x-4">
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted">
                          <Image
                            src={item.product?.image || "/placeholder.svg"}
                            alt={item.product?.name || "Producto"}
                            fill
                            className="object-cover"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg truncate">{item.product?.name || "Producto"}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-2">{item.product?.description}</p>
                              <div className="flex items-center space-x-2 mt-2">
                                {item.product?.career && (
                                  <Badge variant="outline" className="text-xs">{item.product.career}</Badge>
                                )}
                                {item.product?.category && (
                                  <Badge variant="secondary" className="text-xs">{item.product.category}</Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(item.productId)}
                              disabled={isUpdating === item.productId}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQty(item.productId, item.quantity - 1)}
                                disabled={item.quantity <= 1 || isUpdating === item.productId}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-12 text-center font-medium">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQty(item.productId, item.quantity + 1)}
                                disabled={
                                  (item.product?.stock !== undefined && item.quantity >= item.product.stock) ||
                                  isUpdating === item.productId
                                }
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Bs. {item.product?.price} c/u</p>
                              <p className="text-lg font-bold text-primary">
                                Bs. {(((item.product?.price ?? 0) * item.quantity) || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>

                          {item.product?.stock !== undefined && item.quantity >= item.product.stock && (
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

                    {/* 👇 Botón según sesión */}
                    {user ? (
                      <Button onClick={proceedToCheckout} className="w-full" size="lg">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Hacer Pedido
                      </Button>
                    ) : (
                      <Button onClick={() => router.push("/login")} className="w-full" size="lg" variant="default">
                        <LogIn className="mr-2 h-4 w-4" />
                        Iniciar Sesión
                      </Button>
                    )}

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
