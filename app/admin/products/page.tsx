"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Header } from "@/components/header"
import { AdminGuard } from "@/components/admin-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye, ArrowLeft, Package } from "lucide-react"
import type { Product } from "@/lib/database"
import { db } from "@/lib/database"
import { useToast } from "@/hooks/use-toast"

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCareer, setSelectedCareer] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const careers = db.getCareers()
  const categories = ["Tecnología", "Libros", "Electrónica", "Material Educativo", "Componentes"]

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [products, searchTerm, selectedCareer, selectedCategory])

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const allProducts = await db.getProducts()
      setProducts(allProducts)
    } catch (error) {
      console.error("Error loading products:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filterProducts = () => {
    let filtered = [...products]

    if (searchTerm) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.description.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (selectedCareer !== "all") {
      filtered = filtered.filter((product) => product.career === selectedCareer)
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter((product) => product.category === selectedCategory)
    }

    setFilteredProducts(filtered)
  }

  const deleteProduct = async (productId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este producto?")) {
      return
    }

    try {
      await db.deleteProduct(productId)
      setProducts(products.filter((p) => p.id !== productId))
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido eliminado exitosamente",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el producto",
        variant: "destructive",
      })
    }
  }

  const getStockBadge = (stock: number) => {
    if (stock === 0) {
      return <Badge variant="destructive">Agotado</Badge>
    } else if (stock <= 5) {
      return (
        <Badge variant="secondary" className="bg-yellow-500 text-white">
          Stock Bajo
        </Badge>
      )
    } else {
      return (
        <Badge variant="secondary" className="bg-green-500 text-white">
          En Stock
        </Badge>
      )
    }
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/admin"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al panel
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Gestión de Productos</h1>
                <p className="text-muted-foreground">Administra el catálogo de productos</p>
              </div>
              <Link href="/admin/products/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Producto
                </Button>
              </Link>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Productos ({filteredProducts.length})</CardTitle>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

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

                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("")
                    setSelectedCareer("all")
                    setSelectedCategory("all")
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No se encontraron productos</h3>
                  <p className="text-muted-foreground mb-4">
                    {products.length === 0
                      ? "Aún no tienes productos. Crea tu primer producto."
                      : "Intenta ajustar tus filtros de búsqueda."}
                  </p>
                  <Link href="/admin/products/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Crear Producto
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Carrera</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[70px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                                <img
                                  src={product.image || "/placeholder.svg"}
                                  alt={product.name}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              </div>
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-sm text-muted-foreground line-clamp-1">{product.description}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{product.career}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{product.category}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">Bs. {product.price}</TableCell>
                          <TableCell>{product.stock}</TableCell>
                          <TableCell>{getStockBadge(product.stock)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ver detalles
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => deleteProduct(product.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminGuard>
  )
}
