"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Package, Clock, CheckCircle, Truck, Calendar } from "lucide-react"
import type { Order, Product } from "@/lib/database"
import { db } from "@/lib/database"
import { authService } from "@/lib/auth"

interface OrderWithProducts extends Order {
  products: Array<{
    product: Product
    quantity: number
    price: number
  }>
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithProducts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const user = authService.getCurrentUser()
    if (!user) {
      router.push("/login")
      return
    }
    loadOrders()
  }, [router])

  const loadOrders = async () => {
    const user = authService.getCurrentUser()
    if (!user) return

    setIsLoading(true)
    try {
      const userOrders = await db.getOrders(user.id)
      const ordersWithProducts = await Promise.all(
        userOrders.map(async (order) => {
          const products = await Promise.all(
            order.items.map(async (item) => {
              const product = await db.getProduct(item.productId)
              return {
                product: product!,
                quantity: item.quantity,
                price: item.price,
              }
            }),
          )
          return { ...order, products: products.filter((p) => p.product) }
        }),
      )
      setOrders(ordersWithProducts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    } catch (error) {
      console.error("Error loading orders:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />
      case "confirmed":
        return <CheckCircle className="h-4 w-4" />
      case "shipped":
        return <Truck className="h-4 w-4" />
      case "delivered":
        return <Package className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500"
      case "confirmed":
        return "bg-blue-500"
      case "shipped":
        return "bg-purple-500"
      case "delivered":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusText = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return "Pendiente"
      case "confirmed":
        return "Confirmado"
      case "shipped":
        return "Enviado"
      case "delivered":
        return "Entregado"
      default:
        return "Desconocido"
    }
  }

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
                    <div className="space-y-3">
                      <div className="h-4 bg-muted rounded w-1/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                      <div className="h-6 bg-muted rounded w-1/3" />
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
            <h1 className="text-3xl font-bold mb-2">Mis Pedidos</h1>
            <p className="text-muted-foreground">Historial de tus compras en UCB Store</p>
          </div>

          {orders.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No tienes pedidos</h3>
                <p className="text-muted-foreground mb-6">Cuando realices tu primera compra, aparecerá aquí</p>
                <Button onClick={() => router.push("/catalog")}>Explorar productos</Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Pedido #{order.id}</CardTitle>
                        <div className="flex items-center space-x-2 mt-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString("es-ES", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={`${getStatusColor(order.status)} text-white`}>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(order.status)}
                            <span>{getStatusText(order.status)}</span>
                          </div>
                        </Badge>
                        <p className="text-lg font-bold text-primary mt-1">Bs. {order.total.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {order.products.map((item, index) => (
                        <div key={index} className="flex items-center space-x-3 py-2">
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                            <img
                              src={item.product.image || "/placeholder.svg"}
                              alt={item.product.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.quantity} x Bs. {item.price} = Bs. {(item.quantity * item.price).toFixed(2)}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {item.product.career}
                          </Badge>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {order.products.reduce((sum, item) => sum + item.quantity, 0)} producto
                          {order.products.reduce((sum, item) => sum + item.quantity, 0) !== 1 ? "s" : ""}
                        </span>
                        <span className="font-semibold">Total: Bs. {order.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
