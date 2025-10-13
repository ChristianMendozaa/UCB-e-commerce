"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { AdminGuard } from "@/components/admin-guard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ProductsTab from "./tabs/ProductsTab"
import ProductAddModal from "./modals/products/ProductAddModal"
import ProductEditModal from "./modals/products/ProductEditModal"
import ProductViewModal from "./modals/products/ProductViewModal"
import ProductDeleteAlert from "./modals/products/ProductDeleteAlert"
import OrdersTab from "./tabs/OrdersTab"
import OrderViewModal from "./modals/orders/OrderViewModal"
import UsersTab from "./tabs/UsersTab"
import UserViewModal from "./modals/users/UserViewModal"
import OverviewTab from "./tabs/OverviewTab"
import {
  Package,
  CheckCircle,
  Clock,
  Truck,
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
              <OverviewTab
                stats={stats}
                recentOrders={recentOrders}
                lowStockProducts={lowStockProducts}
                getOrderStatusIcon={getOrderStatusIcon}
                getOrderStatusColor={getOrderStatusColor}
                getOrderStatusText={getOrderStatusText}
              />
            </TabsContent>

            {/* Products tab */}

            <TabsContent value="products">
              <ProductsTab
                products={products}
                filteredProducts={filteredProducts}
                productSearchTerm={productSearchTerm}
                setProductSearchTerm={setProductSearchTerm}
                selectedCareer={selectedCareer}
                setSelectedCareer={setSelectedCareer}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                careers={careers}
                categories={categories}
                getStockBadge={getStockBadge}
                onOpenAdd={() => setIsAddModalOpen(true)}
                onView={(p) => { setSelectedProduct(p); setIsProductModalOpen(true) }}
                onEdit={(p) => {
                  setSelectedProduct(p)
                  setProductForm({
                    name: p.name,
                    description: p.description,
                    price: p.price.toString(),
                    category: p.category,
                    career: p.career,
                    stock: p.stock.toString(),
                    image: p.image,
                  })
                  setIsEditModalOpen(true)
                }}
                onAskDelete={(p) => setProductToDelete(p)}
              />
            </TabsContent>

            <TabsContent value="orders">
              <OrdersTab
                orders={orders}
                filteredOrders={filteredOrders}
                users={users}
                orderSearchTerm={orderSearchTerm}
                setOrderSearchTerm={setOrderSearchTerm}
                selectedOrderStatus={selectedOrderStatus}
                setSelectedOrderStatus={setSelectedOrderStatus}
                getOrderStatusIcon={getOrderStatusIcon}
                getOrderStatusColor={getOrderStatusColor}
                getOrderStatusText={getOrderStatusText}
                onView={(o) => { setSelectedOrder(o); setIsOrderModalOpen(true) }}
                onUpdateStatus={updateOrderStatus}
              />
            </TabsContent>

            <TabsContent value="users">
              <UsersTab
                users={users}
                filteredUsers={filteredUsers}
                userSearchTerm={userSearchTerm}
                setUserSearchTerm={setUserSearchTerm}
                selectedUserRole={selectedUserRole}
                setSelectedUserRole={setSelectedUserRole}
                onView={(u) => { setSelectedUser(u); setIsUserModalOpen(true) }}
                onToggleRole={toggleUserRole}
              />
            </TabsContent>

          </Tabs>
        </div>

        <ProductAddModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          form={productForm}
          setForm={setProductForm}
          careers={careers}
          categories={categories}
          onSubmit={handleAddProduct}
        />

        <ProductEditModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          form={productForm}
          setForm={setProductForm}
          careers={careers}
          categories={categories}
          onSubmit={handleUpdateProduct}
        />

        <ProductViewModal
          open={isProductModalOpen}
          onOpenChange={setIsProductModalOpen}
          product={selectedProduct}
          getStockBadge={getStockBadge}
        />

        <ProductDeleteAlert
          product={productToDelete}
          onClose={() => setProductToDelete(null)}
          onConfirm={(p) => handleDeleteProduct(p)}
        />

        <UserViewModal
          open={isUserModalOpen}
          onOpenChange={setIsUserModalOpen}
          user={selectedUser}
        />

        <OrderViewModal
          open={isOrderModalOpen}
          onOpenChange={setIsOrderModalOpen}
          order={selectedOrder}
          users={users}
          getOrderStatusIcon={getOrderStatusIcon}
          getOrderStatusColor={getOrderStatusColor}
          getOrderStatusText={getOrderStatusText}
          getProductDetails={getProductDetails}
        />

      </div>
    </AdminGuard>
  )
}
