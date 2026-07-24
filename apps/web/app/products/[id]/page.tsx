"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Header } from "@/components/header"
import { ArrowLeft, ShoppingCart, Package, Star, Truck, Shield, RefreshCw } from "lucide-react"
import { addToCart as addToLocalCart, getCartCount } from "@/lib/cart"
import type { Product } from "@/lib/products"
import { productsApi } from "@/lib/products"
import { authService } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { useCart } from "@/contexts/cart-context"



export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { updateCartCount, optimisticAdd } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingToCart, setIsAddingToCart] = useState(false)

  useEffect(() => {
    const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined)
    if (!id) return
    loadProduct(id)
  }, [params?.id])

  const loadProduct = async (id: string) => {
    setIsLoading(true)
    try {
      const productData = await productsApi.getProduct(id)
      setProduct(productData)
    } catch (error) {
      console.error("Error loading product:", error)
      setProduct(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddToCart = async () => {
    const user = authService.getCurrentUser()
    if (!user) {
      toast({
        title: "Inicia sesión",
        description: "Debes iniciar sesión para agregar productos al carrito",
        variant: "destructive",
      })
      router.push("/login")
      return
    }
    if (!product) return

    setIsAddingToCart(true)

    // Optimistic
    optimisticAdd(quantity)
    toast({ title: "Producto agregado", description: `${product.name} agregado al carrito` })

    try {
      // ⬇️ Backend
      await addToLocalCart(product.id, quantity)
      // si tu useCart lee del backend, cámbialo a leer de localStorage o haz:
      await updateCartCount?.() // si internamente ya usa getCartCount, perfecto
    } catch (error: any) {
      console.error("Error adding to cart:", error)
      await updateCartCount?.() // revert
      toast({
        title: "Error",
        description: error?.message || "No se pudo agregar el producto al carrito",
        variant: "destructive",
      })
    } finally {
      setIsAddingToCart(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-32 mb-6" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="aspect-square bg-muted rounded-lg" />
              <div className="space-y-4">
                <div className="h-8 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-6 bg-muted rounded w-1/4" />
                <div className="h-20 bg-muted rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Producto no encontrado</h1>
            <p className="text-muted-foreground mb-6">El producto que buscas no existe o ha sido eliminado.</p>
            <Link href="/catalog">
              <Button>Volver al catálogo</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/catalog" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al catálogo
          </Link>
        </div>

        {/* Product Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Product Image */}
          <div className="space-y-4">
            <div className="aspect-square relative overflow-hidden rounded-lg border bg-muted">
              <Image
                src={product.image || "/placeholder.svg"}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">{product.career}</Badge>
                <Badge variant="outline">{product.category}</Badge>
              </div>
              <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
              <p className="text-3xl font-bold text-primary mb-4">Bs. {Number(product.price).toFixed(2)}</p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Descripción</h3>
              <p className="text-muted-foreground leading-relaxed">{product.description}</p>
            </div>

            <Separator />

            {/* Stock and Quantity */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Disponibilidad:</span>
                <div className="flex items-center gap-2">
                  {product.stock > 0 ? (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-green-600 font-medium">{product.stock} en stock</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="text-red-600 font-medium">Agotado</span>
                    </>
                  )}
                </div>
              </div>

              {product.stock > 0 && (
                <div className="flex items-center gap-4">
                  <label className="font-medium">Cantidad:</label>
                  <div className="flex items-center border rounded-md">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      -
                    </Button>
                    <span className="px-4 py-2 min-w-[3rem] text-center">{quantity}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      disabled={quantity >= product.stock}
                    >
                      +
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Add to Cart Button */}
            <div className="space-y-3">
              <Button
                onClick={handleAddToCart}
                disabled={product.stock === 0 || isAddingToCart}
                className="w-full h-12 text-lg"
                size="lg"
              >
                {isAddingToCart ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    {product.stock > 0 ? "Agregar al carrito" : "Producto agotado"}
                  </>
                )}
              </Button>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-primary" />
                <span>Garantía UCB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4">Productos relacionados</h2>
            <p className="text-muted-foreground">
              Descubre más productos de {product.career} en nuestro{" "}
              <Link href={`/careers/${encodeURIComponent(product.career)}`} className="text-primary hover:underline">
                catálogo completo
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
