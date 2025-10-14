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
import type { Order, User } from "@/lib/database"
import { db } from "@/lib/database"
import { useToast } from "@/hooks/use-toast"
import { authService } from "@/lib/auth"
import CareerPickerModal from "./modals/users/CareerPickerModal";
import type { Product, ProductFormState } from "@/lib/products"
import { productsApi } from "@/lib/products"
import { useAuth } from "@/lib/auth";

type CareerAction = { mode: "make" | "remove"; userId: string; adminCareers?: string[] } | null;
function mapApiUserToUI(u: {
  uid: string
  email?: string
  displayName?: string
  photoURL?: string
  roles: string[]
  role: string
  admin_careers: string[]
  platform_admin: boolean
}): User {
  return {
    id: u.uid,
    name: u.displayName || u.email || "Usuario",
    email: u.email || "",
    role: (u.role as any) || "student",
    career: u.admin_careers?.[0] || "",       // compat con tu UI (una sola)
    createdAt: new Date(),      // si tu tipo User lo exige
    // (opcional) guarda también campos extendidos que quieras usar en el modal
    // @ts-ignore
    adminCareers: u.admin_careers,
    // @ts-ignore
    platformAdmin: u.platform_admin,
    // @ts-ignore
    rolesFull: u.roles,
  }
}

interface DashboardStats {
  totalProducts: number
  totalOrders: number
  totalUsers: number
  totalRevenue: number
  pendingOrders: number
  lowStockProducts: number
}

export default function AdminDashboard() {

  const { user } = useAuth();
  const lockedCareer = user?.platform_admin ? null : (user?.admin_careers?.[0] ?? null);
  const lockedCareerForEdit =
    user?.platform_admin ? null :
      (user?.admin_careers?.length === 1 ? user.admin_careers[0] : null);

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

  const [careerAction, setCareerAction] = useState<CareerAction>(null);
  const [careerModalOpen, setCareerModalOpen] = useState(false);
  const [careerOptions, setCareerOptions] = useState<string[]>([]);
  const [realCareers, setRealCareers] = useState<string[]>([]);

  // estado de carga por usuario/acción (para spinner en la tabla)
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<"make" | "remove" | null>(null);

  // estado de carga en el modal: cargar opciones y guardar acción
  const [isCareersFetching, setIsCareersFetching] = useState(false);
  const [isRoleSaving, setIsRoleSaving] = useState(false);

  const [productForm, setProductForm] = useState<ProductFormState>({
    name: "", description: "", price: "", category: "", career: "", stock: "",
    image: "", imageFile: null,
  })


  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)

  const { toast } = useToast()

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
  // Carga inicial de carreras reales
  useEffect(() => {
    (async () => {
      if (!careerModalOpen) return;
      if (careerAction?.mode !== "make") return;

      setIsCareersFetching(true);
      try {
        const apiCareers = await authService.getCareers(); // GET /api/careers
        const normalized = Array.isArray(apiCareers)
          ? apiCareers.map((c: any) => (typeof c === "string" ? c : c?.code)).filter(Boolean)
          : [];
        setCareerOptions(normalized);
      } catch (e) {
        console.warn("No se pudo cargar careers al abrir modal:", e);
        setCareerOptions([]); // el modal te deja escribir nueva si no hay
      } finally {
        setIsCareersFetching(false);
      }
    })();
  }, [careerModalOpen, careerAction]);

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      await addSampleOrders()

      // 🔁 Productos desde backend real
      const productsData = await productsApi.listProducts()

      // 🔁 Pedidos (mock) y usuarios (auth backend como ya tenías)
      const [ordersData] = await Promise.all([db.getOrders()])
      const apiUsers = await authService.listUsers()
      const usersData = apiUsers.map(mapApiUserToUI)

      setProducts(productsData)
      setOrders(ordersData)
      setUsers(usersData)

      // (stats igual que antes)
      const totalRevenue = ordersData.reduce((sum, order) => sum + order.total, 0)
      const pendingOrders = ordersData.filter((o) => o.status === "pending").length
      const lowStock = productsData.filter((p) => p.stock <= 5)

      setStats({
        totalProducts: productsData.length,
        totalOrders: ordersData.length,
        totalUsers: usersData.length,
        totalRevenue,
        pendingOrders,
        lowStockProducts: lowStock.length,
      })
      setRecentOrders(ordersData.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5))
      setLowStockProducts(lowStock.slice(0, 5))
    } catch (error) {
      console.error("Error loading dashboard data:", error)
      toast({ title: "Error", description: "No se pudieron cargar los datos del panel", variant: "destructive" })
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
      imageFile: null,
    })
    setIsEditModalOpen(true)
  }

  const handleDeleteProduct = async (product: Product) => {
    try {
      await productsApi.deleteProduct(product.id)
      setProducts(products.filter(p => p.id !== product.id))
      setProductToDelete(null)
      toast({ title: "Producto eliminado", description: "El producto ha sido eliminado exitosamente" })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el producto", variant: "destructive" })
    }
  }

  const handleAddProduct = async () => {
    try {
      const newProduct = await productsApi.createProduct({
        name: productForm.name,
        description: productForm.description,
        price: Number(productForm.price),
        category: productForm.category,
        career: productForm.career,
        stock: Number(productForm.stock),
        imageFile: productForm.imageFile || null,
      })
      setProducts([...products, newProduct])
      setIsAddModalOpen(false)
      setProductForm({
        name: "", description: "", price: "", category: "", career: "", stock: "",
        image: "", imageFile: null,
      })
      toast({ title: "Producto creado", description: "El producto ha sido creado exitosamente" })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo crear el producto", variant: "destructive" })
    }
  }

  const handleUpdateProduct = async () => {
    if (!selectedProduct) return
    try {
      const updated = await productsApi.updateProduct(selectedProduct.id, {
        name: productForm.name,
        description: productForm.description,
        price: Number(productForm.price),
        category: productForm.category,
        career: productForm.career,
        stock: Number(productForm.stock),
        imageFile: productForm.imageFile || null, // si hay file, reemplaza
      })
      setProducts(products.map(p => (p.id === selectedProduct.id ? updated : p)))
      setIsEditModalOpen(false)
      toast({ title: "Producto actualizado", description: "El producto ha sido actualizado exitosamente" })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar el producto", variant: "destructive" })
    }
  }

  const handleViewUser = (user: User) => {
    setSelectedUser(user)
    setIsUserModalOpen(true)
  }

  const toggleUserRole = async (userId: string, currentRole: string) => {
    if (currentRole !== "admin") {
      // ➕ Hacer admin → abre modal y carga catálogo (el useEffect de arriba lo hace)
      setCareerAction({ mode: "make", userId });
      setCareerModalOpen(true);
      return;
    }

    // 🔻 Quitar admin
    const target = users.find((x) => x.id === userId);
    const adminCareers: string[] = (target as any)?.adminCareers || [];

    if (adminCareers.length === 0) {
      toast({ title: "Sin carreras", description: "Este usuario no administra ninguna carrera." });
      return;
    }

    if (adminCareers.length === 1) {
      // quitar directo sin modal → spinner en fila
      setBusyUserId(userId);
      setBusyMode("remove");
      try {
        await authService.removeAdmin(userId, adminCareers[0]);
        toast({ title: "Rol actualizado", description: `Se quitó admin en ${adminCareers[0]}` });

        const apiUsers = await authService.listUsers();
        const usersData = apiUsers.map(mapApiUserToUI);
        setUsers(usersData);
      } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "No se pudo quitar el rol de administrador", variant: "destructive" });
      } finally {
        setBusyUserId(null);
        setBusyMode(null);
      }
      return;
    }

    // 2+ carreras → abre modal SOLO con sus carreras administradas
    setCareerOptions(adminCareers);
    setCareerAction({ mode: "remove", userId, adminCareers });
    setCareerModalOpen(true);
  };

  const handleCareerConfirm = async (career: string) => {
    if (!careerAction) return;

    setIsRoleSaving(true);
    setBusyUserId(careerAction.userId);
    setBusyMode(careerAction.mode);

    try {
      if (careerAction.mode === "make") {
        await authService.makeAdmin(careerAction.userId, career);
        toast({ title: "Rol actualizado", description: `Usuario promovido a admin de ${career}` });
      } else {
        await authService.removeAdmin(careerAction.userId, career);
        toast({ title: "Rol actualizado", description: `Se quitó admin en ${career}` });
      }

      // refrescar usuarios
      const apiUsers = await authService.listUsers();
      const usersData = apiUsers.map(mapApiUserToUI);
      setUsers(usersData);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo actualizar el rol del usuario", variant: "destructive" });
    } finally {
      setIsRoleSaving(false);
      setBusyUserId(null);
      setBusyMode(null);
      setCareerModalOpen(false);
      setCareerAction(null);
    }
  };

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
                careers={realCareers}
                categories={categories}
                getStockBadge={getStockBadge}
                onOpenAdd={() => {
                  setProductForm(p => ({ ...p, career: lockedCareer ?? p.career }));
                  setIsAddModalOpen(true);
                }}
                onView={(p) => { setSelectedProduct(p); setIsProductModalOpen(true) }}
                onEdit={(p) => {
                  setSelectedProduct(p)
                  setProductForm({
                    name: p.name,
                    description: p.description,
                    price: p.price.toString(),
                    category: p.category,
                    // si está bloqueado, imponemos esa carrera; si no, dejamos la del producto
                    career: lockedCareerForEdit ?? p.career,
                    stock: p.stock.toString(),
                    image: p.image,
                    imageFile: null,
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
                // NUEVO:
                busyUserId={busyUserId}
                busyMode={busyMode}
              />
            </TabsContent>

          </Tabs>
        </div>

        <ProductAddModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          form={productForm}
          setForm={setProductForm}
          careers={realCareers}
          categories={categories}
          onSubmit={handleAddProduct}
          lockCareer={lockedCareer}
        />

        <ProductEditModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          form={productForm}
          setForm={setProductForm}
          careers={realCareers}
          categories={categories}
          onSubmit={handleUpdateProduct}
          lockCareer={lockedCareerForEdit}
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

        <CareerPickerModal
          open={careerModalOpen}
          mode={careerAction?.mode === "remove" ? "remove" : "make"}
          careers={careerOptions}
          adminCareers={careerAction?.adminCareers}
          onClose={() => { setCareerModalOpen(false); setCareerAction(null); }}
          onConfirm={handleCareerConfirm}
          // NUEVO:
          isFetching={isCareersFetching}
          isSaving={isRoleSaving}
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
