"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight, BookOpen, Laptop, Wrench } from "lucide-react"

import type { Product } from "@/lib/products"
import { productsApi } from "@/lib/products"
import { authService } from "@/lib/auth"

export default function CareersPage() {
  const [careers, setCareers] = useState<string[]>([])
  const [productsByCareer, setProductsByCareer] = useState<Record<string, Product[]>>({})
  const [isLoading, setIsLoading] = useState(true)

  const iconByCareer = useMemo(() => {
    return new Map<string, React.ComponentType<any>>([
      ["Ingeniería de Sistemas", Laptop],
      ["Psicopedagogía", BookOpen],
      ["Mecatrónica", Wrench],
    ])
  }, [])

  useEffect(() => {
    ;(async () => {
      setIsLoading(true)
      try {
        const apiCareers = await authService.getCareersPublic()
        const normalizedCareers: string[] = Array.isArray(apiCareers)
          ? apiCareers
              .map((c: any) =>
                typeof c === "string"
                  ? c
                  : (c?.name ?? c?.title ?? c?.code ?? c?.id ?? "").toString(),
              )
              .filter(Boolean)
          : []

        setCareers(normalizedCareers)

        const page = await productsApi.listPublicProducts({ limit: 200 })
        const grouped = page.items.reduce((acc, p) => {
          const key = p.career || "Otros"
          if (!acc[key]) acc[key] = []
          acc[key].push(p)
          return acc
        }, {} as Record<string, Product[]>)

        setProductsByCareer(grouped)
      } catch (e) {
        console.error("Error cargando carreras/productos", e)
        setCareers([])
        setProductsByCareer({})
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Productos por Carrera</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Encuentra productos especializados para tu área de estudio en la Universidad Católica Boliviana
          </p>
        </div>

        {/* Careers dinámicas desde backend */}
        <div className="space-y-12">
          {careers.map((careerName) => {
            const IconComponent = iconByCareer.get(careerName) ?? Laptop
            const products = productsByCareer[careerName] || []

            return (
              <div key={careerName} className="space-y-6">
                {/* Career Header */}
                <div className="relative overflow-hidden rounded-2xl">
                  <div className={`bg-gradient-to-r from-primary to-primary/80 p-8 text-white`}>
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                        <IconComponent className="h-8 w-8" />
                      </div>
                      <div>
                        <h2 className="text-2xl md:text-3xl font-bold">{careerName}</h2>
                        <p className="text-white/90">Recursos y materiales para {careerName}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                        {isLoading ? "Cargando..." : `${products.length} productos disponibles`}
                      </Badge>
                      <Link href={`/careers/${encodeURIComponent(careerName)}`}>
                        <Button
                          variant="secondary"
                          className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                        >
                          Ver todos
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Products Preview */}
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i} className="h-64 animate-pulse">
                        <div className="h-32 bg-muted rounded-t-lg" />
                        <CardContent className="p-4 space-y-2">
                          <div className="h-4 bg-muted rounded" />
                          <div className="h-3 bg-muted rounded w-3/4" />
                          <div className="h-6 bg-muted rounded w-1/2" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">No hay productos disponibles para esta carrera</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.slice(0, 3).map((product) => (
                      <Card key={product.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader className="p-0">
                          <div className="relative h-48 overflow-hidden rounded-t-lg">
                            <Image
                              src={product.image || "/placeholder.svg"}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 1024px) 100vw, 33vw"
                            />
                            <div className="absolute top-2 right-2">
                              <Badge variant="secondary" className="bg-background/80 backdrop-blur">
                                {product.category}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          {/* Título clickeable */}
                          <Link href={`/products/${product.id}`}>
                            <CardTitle className="text-lg mb-2 line-clamp-2 hover:text-primary transition-colors">
                              {product.name}
                            </CardTitle>
                          </Link>

                          <CardDescription className="text-sm mb-3 line-clamp-2">
                            {product.description}
                          </CardDescription>

                          <div className="flex items-center justify-between">
                            <p className="text-xl font-bold text-primary">Bs. {product.price}</p>
                            <Badge variant="outline" className="text-xs">
                              Stock: {product.stock}
                            </Badge>
                          </div>

                          {/* ⬇️ Botón para ir a la página del producto */}
                          <div className="mt-4">
                            <Link href={`/products/${product.id}`}>
                              <Button className="w-full" size="sm">
                                Ver detalle
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {products.length > 3 && (
                  <div className="text-center">
                    <Link href={`/careers/${encodeURIComponent(careerName)}`}>
                      <Button variant="outline">
                        Ver todos los productos de {careerName}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
