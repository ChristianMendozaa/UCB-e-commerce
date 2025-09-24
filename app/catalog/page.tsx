"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { ProductCard } from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Filter, Grid, List } from "lucide-react"
import type { Product } from "@/lib/database"
import { db } from "@/lib/database"

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCareer, setSelectedCareer] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("name")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [isLoading, setIsLoading] = useState(true)

  const careers = db.getCareers()
  const categories = ["Tecnología", "Libros", "Electrónica", "Material Educativo", "Componentes"]

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    filterAndSortProducts()
  }, [products, searchTerm, selectedCareer, selectedCategory, sortBy])

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const allProducts = await db.getProducts()
      setProducts(allProducts)
    } catch (error) {
      console.error("Error loading products:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterAndSortProducts = () => {
    let filtered = [...products]

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.description.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Filtrar por carrera
    if (selectedCareer !== "all") {
      filtered = filtered.filter((product) => product.career === selectedCareer)
    }

    // Filtrar por categoría
    if (selectedCategory !== "all") {
      filtered = filtered.filter((product) => product.category === selectedCategory)
    }

    // Ordenar
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name)
        case "price-low":
          return a.price - b.price
        case "price-high":
          return b.price - a.price
        case "stock":
          return b.stock - a.stock
        default:
          return 0
      }
    })

    setFilteredProducts(filtered)
  }

  const clearFilters = () => {
    setSearchTerm("")
    setSelectedCareer("all")
    setSelectedCategory("all")
    setSortBy("name")
  }

  const activeFiltersCount = [searchTerm, selectedCareer !== "all", selectedCategory !== "all"].filter(Boolean).length

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Catálogo de Productos</h1>
          <p className="text-muted-foreground">Encuentra todo lo que necesitas para tu carrera universitaria</p>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Career Filter */}
              <Select value={selectedCareer} onValueChange={setSelectedCareer}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las carreras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las carreras</SelectItem>
                  {careers.map((career) => (
                    <SelectItem key={career} value={career}>
                      {career}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nombre A-Z</SelectItem>
                  <SelectItem value="price-low">Precio: Menor a Mayor</SelectItem>
                  <SelectItem value="price-high">Precio: Mayor a Menor</SelectItem>
                  <SelectItem value="stock">Mayor Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Actions */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center space-x-2">
                {activeFiltersCount > 0 && (
                  <>
                    <Badge variant="secondary">
                      <Filter className="mr-1 h-3 w-3" />
                      {activeFiltersCount} filtro{activeFiltersCount > 1 ? "s" : ""} activo
                      {activeFiltersCount > 1 ? "s" : ""}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Cargando..."
              : `${filteredProducts.length} producto${filteredProducts.length !== 1 ? "s" : ""} encontrado${filteredProducts.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Products Grid */}
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
        ) : filteredProducts.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No se encontraron productos</h3>
              <p className="text-muted-foreground mb-4">Intenta ajustar tus filtros o términos de búsqueda</p>
              <Button onClick={clearFilters}>Limpiar filtros</Button>
            </div>
          </Card>
        ) : (
          <div
            className={
              viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"
            }
          >
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={loadProducts} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
