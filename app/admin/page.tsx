"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { AdminGuard } from "@/components/admin-guard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  Plus,
  CheckCircle,
  Clock,
  Truck,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  UserCheck,
  UserX,
  Shield,
  ShieldCheck,
  Upload,
} from "lucide-react"
import type { Product, Order, User } from "@/lib/database"
import { db } from "@/lib/database"
import { useToast } from "@/hooks/use-toast"

interface DashboardStats {
  totalProducts: number
  totalOrders: number
  totalUsers: number
  totalRevenue: number
  pendingOrders: number
  lowStockProducts: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    lowStockProducts: 0,
  })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Products state
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [productSearchTerm, setProductSearchTerm] = useState("")
  const [selectedCareer, setSelectedCareer] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  // Orders state
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [orderSearchTerm, setOrderSearchTerm] = useState("")
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<string>("all")

  // Users state
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [userSearchTerm, setUserSearchTerm] = useState("")
  const [selectedUserRole, setSelectedUserRole] = useState<string>("all")

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)

  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    career: "",
    stock: "",
    image: "",
  })

  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)

  const { toast } = useToast()

  const careers = db.getCareers()
  const categories = ["Tecnología", "Libros", "Electrónica", "Material Educativo", "Componentes"]

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [products, productSearchTerm, selectedCareer, selectedCategory])

  useEffect(() => {
    filterOrders()
  }, [orders, orderSearchTerm, selectedOrderStatus])

  useEffect(() => {
    filterUsers()
  }, [users, userSearchTerm, selectedUserRole])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      await addSampleOrders()

      // Load all data
      const [productsData, ordersData, usersData] = await Promise.all([
        db.getProducts(),
        db.getOrders(),
        db.getAllUsers(),
      ])

      setProducts(productsData)
      setOrders(ordersData)
      setUsers(usersData)

      // Calculate stats
      const totalRevenue = ordersData.reduce((sum, order) => sum + order.total, 0)
      const pendingOrders = ordersData.filter((order) => order.status === "pending").length
      const lowStock = productsData.filter((product) => product.stock <= 5)

      setStats({
        totalProducts: productsData.length,
        totalOrders: ordersData.length,
        totalUsers: usersData.length,
        totalRevenue,
        pendingOrders,
        lowStockProducts: lowStock.length,
      })

      // Set recent orders (last 5)
      const sortedOrders = ordersData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setRecentOrders(sortedOrders.slice(0, 5))

      // Set low stock products
      setLowStockProducts(lowStock.slice(0, 5))
    } catch (error) {
      console.error("Error loading dashboard data:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del panel",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addSampleOrders = async () => {
    const existingOrders = await db.getOrders()
    if (existingOrders.length === 0) {
      // Create sample orders
      const sampleOrders = [
        {
          userId: "2",
          items: [
            { productId: "1", quantity: 1, price: 4500 },
            { productId: "2", quantity: 2, price: 280 },
          ],
          total: 5060,
          status: "pending" as const,
        },
        {
          userId: "2",
          items: [{ productId: "3", quantity: 1, price: 350 }],
          total: 350,
          status: "confirmed" as const,
        },
        {
          userId: "1",
          items: [
            { productId: "4", quantity: 1, price: 320 },
            { productId: "5", quantity: 1, price: 850 },
          ],
          total: 1170,
          status: "shipped" as const,
        },
      ]

      for (const order of sampleOrders) {
        await db.createOrder(order)
      }
    }
  }

  // Filter functions
  const filterProducts = () => {
    let filtered = [...products]

    if (productSearchTerm) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
          product.description.toLowerCase().includes(productSearchTerm.toLowerCase()),
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

  const filterOrders = () => {
    let filtered = [...orders]

    if (orderSearchTerm) {
      filtered = filtered.filter(
        (order) =>
          order.id.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
          order.userId.toLowerCase().includes(orderSearchTerm.toLowerCase()),
      )
    }

    if (selectedOrderStatus !== "all") {
      filtered = filtered.filter((order) => order.status === selectedOrderStatus)
    }

    setFilteredOrders(filtered)
  }

  const filterUsers = () => {
    let filtered = [...users]

    if (userSearchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(userSearchTerm.toLowerCase()),
      )
    }

    if (selectedUserRole !== "all") {
      filtered = filtered.filter((user) => user.role === selectedUserRole)
    }

    setFilteredUsers(filtered)
  }

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product)
    setIsProductModalOpen(true)
  }

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product)
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category: product.category,
      career: product.career,
      stock: product.stock.toString(),
      image: product.image,
    })
    setIsEditModalOpen(true)
  }

  const handleDeleteProduct = async (product: Product) => {
    try {
      await db.deleteProduct(product.id)
      setProducts(products.filter((p) => p.id !== product.id))
      setProductToDelete(null)
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

  const handleAddProduct = async () => {
    try {
      const newProduct = await db.createProduct({
        name: productForm.name,
        description: productForm.description,
        price: Number.parseFloat(productForm.price),
        category: productForm.category,
        career: productForm.career,
        stock: Number.parseInt(productForm.stock),
        image: productForm.image || "/placeholder.svg",
      })
      setProducts([...products, newProduct])
      setIsAddModalOpen(false)
      setProductForm({
        name: "",
        description: "",
        price: "",
        category: "",
        career: "",
        stock: "",
        image: "",
      })
      toast({
        title: "Producto creado",
        description: "El producto ha sido creado exitosamente",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear el producto",
        variant: "destructive",
      })
    }
  }

  const handleUpdateProduct = async () => {
    if (!selectedProduct) return

    try {
      const updatedProduct = await db.updateProduct(selectedProduct.id, {
        name: productForm.name,
        description: productForm.description,
        price: Number.parseFloat(productForm.price),
        category: productForm.category,
        career: productForm.career,
        stock: Number.parseInt(productForm.stock),
        image: productForm.image,
      })

      if (updatedProduct) {
        setProducts(products.map((p) => (p.id === selectedProduct.id ? updatedProduct : p)))
        setIsEditModalOpen(false)
        toast({
          title: "Producto actualizado",
          description: "El producto ha sido actualizado exitosamente",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el producto",
        variant: "destructive",
      })
    }
  }

  const handleViewUser = (user: User) => {
    setSelectedUser(user)
    setIsUserModalOpen(true)
  }

  const toggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "student" : "admin"

    try {
      // Update in database (simulated)
      const userIndex = users.findIndex((u) => u.id === userId)
      if (userIndex !== -1) {
        const updatedUsers = [...users]
        updatedUsers[userIndex] = { ...updatedUsers[userIndex], role: newRole as any }
        setUsers(updatedUsers)

        toast({
          title: "Rol actualizado",
          description: `El usuario ahora es ${newRole === "admin" ? "administrador" : "estudiante"}`,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el rol del usuario",
        variant: "destructive",
      })
    }
  }

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
    setIsOrderModalOpen(true)
  }

  const updateOrderStatus = async (orderId: string, newStatus: Order["status"]) => {
    try {
      await db.updateOrderStatus(orderId, newStatus)
      setOrders(orders.map((order) => (order.id === orderId ? { ...order, status: newStatus } : order)))
      toast({
        title: "Estado actualizado",
        description: "El estado del pedido ha sido actualizado",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del pedido",
        variant: "destructive",
      })
    }
  }

  // Helper functions
  const getOrderStatusIcon = (status: Order["status"]) => {
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

  const getOrderStatusColor = (status: Order["status"]) => {
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

  const getOrderStatusText = (status: Order["status"]) => {
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

  const getProductDetails = (productId: string) => {
    return products.find((p) => p.id === productId)
  }

  if (isLoading) {
    return (
      <AdminGuard>
        <div className="min-h-screen bg-background">
          <Header />
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-8 bg-muted rounded w-1/2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </AdminGuard>
    )
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Panel de Administración</h1>
            <p className="text-muted-foreground">Gestiona tu tienda UCB desde aquí</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Productos</p>
                    <p className="text-2xl font-bold">{stats.totalProducts}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <ShoppingCart className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pedidos</p>
                    <p className="text-2xl font-bold">{stats.totalOrders}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Usuarios</p>
                    <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ingresos</p>
                    <p className="text-2xl font-bold">Bs. {stats.totalRevenue.toFixed(0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pendientes</p>
                    <p className="text-2xl font-bold">{stats.pendingOrders}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Stock Bajo</p>
                    <p className="text-2xl font-bold">{stats.lowStockProducts}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="overview" className="space-y-6">
            <div className="w-full overflow-x-auto">
              <TabsList className="grid w-full grid-cols-4 min-w-[400px]">
                <TabsTrigger value="overview" className="text-xs sm:text-sm">
                  Resumen
                </TabsTrigger>
                <TabsTrigger value="products" className="text-xs sm:text-sm">
                  Productos
                </TabsTrigger>
                <TabsTrigger value="orders" className="text-xs sm:text-sm">
                  Pedidos
                </TabsTrigger>
                <TabsTrigger value="users" className="text-xs sm:text-sm">
                  Usuarios
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Orders */}
                <Card>
                  <CardHeader>
                    <CardTitle>Pedidos Recientes</CardTitle>
                    <CardDescription>Últimos 5 pedidos realizados</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentOrders.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">Pedido #{order.id}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={`${getOrderStatusColor(order.status)} text-white`}>
                              <div className="flex items-center space-x-1">
                                {getOrderStatusIcon(order.status)}
                                <span className="text-xs">{getOrderStatusText(order.status)}</span>
                              </div>
                            </Badge>
                            <span className="font-bold">Bs. {order.total.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Low Stock Products */}
                <Card>
                  <CardHeader>
                    <CardTitle>Stock Bajo</CardTitle>
                    <CardDescription>Productos con 5 o menos unidades</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {lowStockProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          ¡Excelente! Todos los productos tienen stock suficiente
                        </p>
                      ) : (
                        lowStockProducts.map((product) => (
                          <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{product.name}</p>
                              <p className="text-sm text-muted-foreground">{product.career}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="destructive">{product.stock} restantes</Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="products">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Gestión de Productos ({filteredProducts.length})</CardTitle>
                    <CardDescription>Administra el catálogo de productos</CardDescription>
                  </div>
                  <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Producto
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Agregar Nuevo Producto</DialogTitle>
                        <DialogDescription>Completa la información del nuevo producto</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Nombre del producto</Label>
                            <Input
                              id="name"
                              value={productForm.name}
                              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                              placeholder="Ej: Laptop Dell Inspiron"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="price">Precio (Bs.)</Label>
                            <Input
                              id="price"
                              type="number"
                              value={productForm.price}
                              onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Descripción</Label>
                          <Textarea
                            id="description"
                            value={productForm.description}
                            onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                            placeholder="Descripción detallada del producto"
                            rows={3}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="career">Carrera</Label>
                            <Select
                              value={productForm.career}
                              onValueChange={(value) => setProductForm({ ...productForm, career: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar carrera" />
                              </SelectTrigger>
                              <SelectContent>
                                {careers.map((career) => (
                                  <SelectItem key={career} value={career}>
                                    {career}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="category">Categoría</Label>
                            <Select
                              value={productForm.category}
                              onValueChange={(value) => setProductForm({ ...productForm, category: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar categoría" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((category) => (
                                  <SelectItem key={category} value={category}>
                                    {category}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="stock">Stock</Label>
                            <Input
                              id="stock"
                              type="number"
                              value={productForm.stock}
                              onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="image">URL de la imagen</Label>
                          <div className="flex gap-2">
                            <Input
                              id="image"
                              value={productForm.image}
                              onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                              placeholder="https://ejemplo.com/imagen.jpg o /ruta/imagen.jpg"
                            />
                            <Button variant="outline" size="icon">
                              <Upload className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Puedes usar una URL externa o subir una imagen
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleAddProduct}
                          disabled={!productForm.name || !productForm.price || !productForm.career}
                        >
                          Crear Producto
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Buscar productos..."
                        value={productSearchTerm}
                        onChange={(e) => setProductSearchTerm(e.target.value)}
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
                        setProductSearchTerm("")
                        setSelectedCareer("all")
                        setSelectedCategory("all")
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  </div>

                  {/* Products Table */}
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No se encontraron productos</h3>
                      <p className="text-muted-foreground mb-4">
                        {products.length === 0
                          ? "Aún no tienes productos. Crea tu primer producto."
                          : "Intenta ajustar tus filtros de búsqueda."}
                      </p>
                      <Button onClick={() => setIsAddModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear Producto
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
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
                                    <DropdownMenuItem onClick={() => handleViewProduct(product)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      Ver detalles
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setProductToDelete(product)}
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
            </TabsContent>

            <TabsContent value="orders">
              <Card>
                <CardHeader>
                  <CardTitle>Gestión de Pedidos ({filteredOrders.length})</CardTitle>
                  <CardDescription>Administra todos los pedidos de la tienda</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Buscar pedidos..."
                        value={orderSearchTerm}
                        onChange={(e) => setOrderSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    <Select value={selectedOrderStatus} onValueChange={setSelectedOrderStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los estados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="shipped">Enviado</SelectItem>
                        <SelectItem value="delivered">Entregado</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setOrderSearchTerm("")
                        setSelectedOrderStatus("all")
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  </div>

                  {/* Orders Table */}
                  {filteredOrders.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No se encontraron pedidos</h3>
                      <p className="text-muted-foreground">
                        {orders.length === 0
                          ? "Aún no hay pedidos en la tienda."
                          : "Intenta ajustar tus filtros de búsqueda."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-[70px]">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredOrders.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">#{order.id}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {order.items.length} producto{order.items.length !== 1 ? "s" : ""}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <p className="font-medium">
                                  {users.find((u) => u.id === order.userId)?.name || "Usuario desconocido"}
                                </p>
                              </TableCell>
                              <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                              <TableCell className="font-medium">Bs. {order.total.toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge className={`${getOrderStatusColor(order.status)} text-white`}>
                                  <div className="flex items-center space-x-1">
                                    {getOrderStatusIcon(order.status)}
                                    <span className="text-xs">{getOrderStatusText(order.status)}</span>
                                  </div>
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleViewOrder(order)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      Ver detalles
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "confirmed")}>
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Confirmar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "shipped")}>
                                      <Truck className="mr-2 h-4 w-4" />
                                      Marcar como enviado
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "delivered")}>
                                      <Package className="mr-2 h-4 w-4" />
                                      Marcar como entregado
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
            </TabsContent>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>Gestión de Usuarios ({filteredUsers.length})</CardTitle>
                  <CardDescription>Administra los usuarios de la plataforma</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Buscar usuarios..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    <Select value={selectedUserRole} onValueChange={setSelectedUserRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los roles</SelectItem>
                        <SelectItem value="student">Estudiante</SelectItem>
                        <SelectItem value="teacher">Profesor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setUserSearchTerm("")
                        setSelectedUserRole("all")
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  </div>

                  {/* Users Table */}
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No se encontraron usuarios</h3>
                      <p className="text-muted-foreground">
                        {users.length === 0
                          ? "Aún no hay usuarios registrados."
                          : "Intenta ajustar tus filtros de búsqueda."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead>Carrera</TableHead>
                            <TableHead>Fecha de registro</TableHead>
                            <TableHead className="w-[70px]">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell>
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-medium">{user.name}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    user.role === "admin"
                                      ? "default"
                                      : user.role === "teacher"
                                        ? "secondary"
                                        : "outline"
                                  }
                                >
                                  <div className="flex items-center space-x-1">
                                    {user.role === "admin" ? (
                                      <ShieldCheck className="h-3 w-3" />
                                    ) : (
                                      <Shield className="h-3 w-3" />
                                    )}
                                    <span>
                                      {user.role === "admin"
                                        ? "Administrador"
                                        : user.role === "teacher"
                                          ? "Profesor"
                                          : "Estudiante"}
                                    </span>
                                  </div>
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {user.career || "No especificada"}
                                </span>
                              </TableCell>
                              <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleViewUser(user)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      Ver perfil
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toggleUserRole(user.id, user.role)}>
                                      {user.role === "admin" ? (
                                        <>
                                          <UserX className="mr-2 h-4 w-4" />
                                          Quitar admin
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="mr-2 h-4 w-4" />
                                          Hacer admin
                                        </>
                                      )}
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
            </TabsContent>
          </Tabs>
        </div>

        <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalles del Producto</DialogTitle>
            </DialogHeader>
            {selectedProduct && (
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <img
                    src={selectedProduct.image || "/placeholder.svg"}
                    alt={selectedProduct.name}
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{selectedProduct.name}</h3>
                    <p className="text-muted-foreground">{selectedProduct.description}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant="outline">{selectedProduct.career}</Badge>
                      <Badge variant="secondary">{selectedProduct.category}</Badge>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Precio</Label>
                    <p className="text-lg font-bold">Bs. {selectedProduct.price}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Stock</Label>
                    <p className="text-lg">{selectedProduct.stock} unidades</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Estado</Label>
                    <div className="mt-1">{getStockBadge(selectedProduct.stock)}</div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Fecha de creación</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedProduct.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Producto</DialogTitle>
              <DialogDescription>Modifica la información del producto</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nombre del producto</Label>
                  <Input
                    id="edit-name"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Precio (Bs.)</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-career">Carrera</Label>
                  <Select
                    value={productForm.career}
                    onValueChange={(value) => setProductForm({ ...productForm, career: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {careers.map((career) => (
                        <SelectItem key={career} value={career}>
                          {career}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Categoría</Label>
                  <Select
                    value={productForm.category}
                    onValueChange={(value) => setProductForm({ ...productForm, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-stock">Stock</Label>
                  <Input
                    id="edit-stock"
                    type="number"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-image">URL de la imagen</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-image"
                    value={productForm.image}
                    onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                  />
                  <Button variant="outline" size="icon">
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateProduct}>Guardar Cambios</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El producto "{productToDelete?.name}" será eliminado permanentemente
                del catálogo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => productToDelete && handleDeleteProduct(productToDelete)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Perfil de Usuario</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xl font-medium">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{selectedUser.name}</h3>
                    <p className="text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Rol</Label>
                    <div className="mt-1">
                      <Badge
                        variant={
                          selectedUser.role === "admin"
                            ? "default"
                            : selectedUser.role === "teacher"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {selectedUser.role === "admin"
                          ? "Administrador"
                          : selectedUser.role === "teacher"
                            ? "Profesor"
                            : "Estudiante"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Carrera</Label>
                    <p className="text-sm">{selectedUser.career || "No especificada"}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Fecha de registro</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalles del Pedido</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Pedido #{selectedOrder.id}</h3>
                    <p className="text-muted-foreground">{new Date(selectedOrder.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Badge className={`${getOrderStatusColor(selectedOrder.status)} text-white`}>
                    <div className="flex items-center space-x-1">
                      {getOrderStatusIcon(selectedOrder.status)}
                      <span>{getOrderStatusText(selectedOrder.status)}</span>
                    </div>
                  </Badge>
                </div>

                <div>
                  <Label className="text-sm font-medium">Cliente</Label>
                  <p className="text-sm">
                    {users.find((u) => u.id === selectedOrder.userId)?.name || "Usuario desconocido"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {users.find((u) => u.id === selectedOrder.userId)?.email}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Productos</Label>
                  <div className="space-y-2 mt-2">
                    {selectedOrder.items.map((item, index) => {
                      const product = getProductDetails(item.productId)
                      return (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center space-x-3">
                            <img
                              src={product?.image || "/placeholder.svg"}
                              alt={product?.name || "Producto"}
                              className="w-10 h-10 object-cover rounded"
                            />
                            <div>
                              <p className="font-medium">{product?.name || "Producto desconocido"}</p>
                              <p className="text-sm text-muted-foreground">Cantidad: {item.quantity}</p>
                            </div>
                          </div>
                          <p className="font-medium">Bs. {(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-xl font-bold">Bs. {selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminGuard>
  )
}
