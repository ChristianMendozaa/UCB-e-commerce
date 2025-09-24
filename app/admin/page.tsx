"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { AdminGuard } from "@/components/admin-guard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
} from "lucide-react"
import type { Product, Order, User } from "@/lib/database"
import { db } from "@/lib/database"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

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

  // Action functions
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

  const toggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin"

    try {
      await db.updateUserRole(userId, newRole)
      setUsers(users.map((user) => (user.id === userId ? { ...user, role: newRole } : user)))
      toast({
        title: "Rol actualizado",
        description: `El usuario ahora es ${newRole === "admin" ? "administrador" : "usuario"}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el rol del usuario",
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
                  <Link href="/admin/products/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Nuevo Producto
                    </Button>
                  </Link>
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
                      <Link href="/admin/products/new">
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Crear Producto
                        </Button>
                      </Link>
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
                                <p className="font-medium">{order.userId}</p>
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
                                    <DropdownMenuItem>
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
                        <SelectItem value="user">Usuario</SelectItem>
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
                                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                                  <div className="flex items-center space-x-1">
                                    {user.role === "admin" ? (
                                      <ShieldCheck className="h-3 w-3" />
                                    ) : (
                                      <Shield className="h-3 w-3" />
                                    )}
                                    <span>{user.role === "admin" ? "Administrador" : "Usuario"}</span>
                                  </div>
                                </Badge>
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
                                    <DropdownMenuItem>
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
      </div>
    </AdminGuard>
  )
}
