"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Search, Package, Eye, Truck, CheckCircle, XCircle } from "lucide-react"
import { DatabaseService } from "@/lib/database"
import AdminGuard from "@/components/admin-guard"

interface Order {
  id: string
  userId: string
  userName: string
  userEmail: string
  items: Array<{
    id: string
    name: string
    price: number
    quantity: number
    image: string
  }>
  total: number
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  createdAt: string
  shippingAddress: {
    street: string
    city: string
    zipCode: string
    phone: string
  }
}

export default function OrdersManagement() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    filterOrders()
  }, [orders, searchTerm, statusFilter])

  const loadOrders = async () => {
    const allOrders = await DatabaseService.getAllOrders()
    setOrders(allOrders)
  }

  const filterOrders = () => {
    let filtered = orders

    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.userEmail.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter)
    }

    setFilteredOrders(filtered)
  }

  const updateOrderStatus = (orderId: string, newStatus: Order["status"]) => {
    DatabaseService.updateOrderStatus(orderId, newStatus)
    loadOrders()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Package className="h-4 w-4" />
      case "processing":
        return <Truck className="h-4 w-4" />
      case "shipped":
        return <Truck className="h-4 w-4" />
      case "delivered":
        return <CheckCircle className="h-4 w-4" />
      case "cancelled":
        return <XCircle className="h-4 w-4" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "processing":
        return "bg-blue-100 text-blue-800"
      case "shipped":
        return "bg-purple-100 text-purple-800"
      case "delivered":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendiente"
      case "processing":
        return "Procesando"
      case "shipped":
        return "Enviado"
      case "delivered":
        return "Entregado"
      case "cancelled":
        return "Cancelado"
      default:
        return status
    }
  }

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-ucb-blue">Gestión de Órdenes</h1>
            <p className="text-gray-600 mt-2">Administra y rastrea todas las órdenes</p>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar por ID, usuario o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="processing">Procesando</SelectItem>
                  <SelectItem value="shipped">Enviados</SelectItem>
                  <SelectItem value="delivered">Entregados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de órdenes */}
        <div className="grid gap-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(order.status)}
                      <h3 className="font-semibold text-lg">Orden #{order.id}</h3>
                      <Badge className={getStatusBadgeColor(order.status)}>{getStatusText(order.status)}</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">
                          <strong>Cliente:</strong> {order.userName}
                        </p>
                        <p className="text-gray-600">
                          <strong>Email:</strong> {order.userEmail}
                        </p>
                        <p className="text-gray-600">
                          <strong>Total:</strong> Bs. {order.total.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">
                          <strong>Fecha:</strong> {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-gray-600">
                          <strong>Items:</strong> {order.items.length} productos
                        </p>
                        <p className="text-gray-600">
                          <strong>Teléfono:</strong> {order.shippingAddress.phone}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalles
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Detalles de la Orden #{selectedOrder?.id}</DialogTitle>
                        </DialogHeader>
                        {selectedOrder && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-semibold mb-2">Información del Cliente</h4>
                                <p>
                                  <strong>Nombre:</strong> {selectedOrder.userName}
                                </p>
                                <p>
                                  <strong>Email:</strong> {selectedOrder.userEmail}
                                </p>
                                <p>
                                  <strong>Teléfono:</strong> {selectedOrder.shippingAddress.phone}
                                </p>
                              </div>
                              <div>
                                <h4 className="font-semibold mb-2">Dirección de Envío</h4>
                                <p>{selectedOrder.shippingAddress.street}</p>
                                <p>{selectedOrder.shippingAddress.city}</p>
                                <p>CP: {selectedOrder.shippingAddress.zipCode}</p>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold mb-2">Productos</h4>
                              <div className="space-y-2">
                                {selectedOrder.items.map((item, index) => (
                                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                                    <img
                                      src={item.image || "/placeholder.svg"}
                                      alt={item.name}
                                      className="w-12 h-12 object-cover rounded"
                                    />
                                    <div className="flex-1">
                                      <p className="font-medium">{item.name}</p>
                                      <p className="text-sm text-gray-600">
                                        Cantidad: {item.quantity} × Bs. {item.price.toFixed(2)}
                                      </p>
                                    </div>
                                    <p className="font-semibold">Bs. {(item.quantity * item.price).toFixed(2)}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="text-right mt-4 pt-4 border-t">
                                <p className="text-xl font-bold">Total: Bs. {selectedOrder.total.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <Select
                      value={order.status}
                      onValueChange={(value: Order["status"]) => updateOrderStatus(order.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="processing">Procesando</SelectItem>
                        <SelectItem value="shipped">Enviado</SelectItem>
                        <SelectItem value="delivered">Entregado</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredOrders.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No se encontraron órdenes</h3>
              <p className="text-gray-500">Intenta ajustar los filtros de búsqueda</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminGuard>
  )
}
