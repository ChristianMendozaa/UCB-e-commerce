"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { ProductCard } from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, BookOpen, Laptop, Wrench } from "lucide-react"
import type { Product } from "@/lib/database"
import { db } from "@/lib/database"

export default function CareerProductsPage() {
  const params = useParams()
  const careerName = decodeURIComponent(params.career as string)
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const careerIcons = {
    "Ingeniería de Sistemas": Laptop,
    Psicopedagogía: BookOpen,
    Mecatrónica: Wrench,
  }

  const careerColors = {
    "Ingeniería de Sistemas": "from-blue-500 to-blue-600",
    Psicopedagogía: "from-green-500 to-green-600",
    Mecatrónica: "from-purple-500 to-purple-600",
  }

  useEffect(() => {
    loadProducts()
  }, [careerName])

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const careerProducts = await db.getProducts(careerName)
      setProducts(careerProducts)
    } catch (error) {
      console.error("Error loading products:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const IconComponent = careerIcons[careerName as keyof typeof careerIcons] || BookOpen
  const gradientColor = careerColors[careerName as keyof typeof careerColors] || "from-gray-500 to-gray-600"

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            href="/careers"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a carreras
          </Link>
        </div>

        {/* Career Header */}
        <div className="relative overflow-hidden rounded-2xl mb-8">
          <div className={`bg-gradient-to-r ${gradientColor} p-8 text-white`}>
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <IconComponent className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{careerName}</h1>
                <p className="text-white/90">Productos especializados para tu carrera</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              {products.length} productos disponibles
            </Badge>
          </div>
        </div>

        {/* Products */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="h-96 animate-pulse">
                <div className="h-48 bg-muted rounded-t-lg" />
                <CardContent className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-6 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <IconComponent className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No hay productos disponibles</h3>
              <p className="text-muted-foreground mb-4">
                Aún no tenemos productos para {careerName}. ¡Pronto agregaremos más!
              </p>
              <Link href="/catalog">
                <Button>Ver catálogo completo</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={loadProducts} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
