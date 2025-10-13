"use client"

import { FC } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ShoppingCart, Search, MoreHorizontal, Eye, CheckCircle, Truck, Package } from "lucide-react"
import type { Order, User } from "@/lib/database"

type Props = {
  // data
  orders: Order[]
  filteredOrders: Order[]
  users: User[]

  // filtros controlados
  orderSearchTerm: string
  setOrderSearchTerm: (v: string) => void
  selectedOrderStatus: string
  setSelectedOrderStatus: (v: string) => void

  // helpers para status
  getOrderStatusIcon: (s: Order["status"]) => JSX.Element
  getOrderStatusColor: (s: Order["status"]) => string
  getOrderStatusText: (s: Order["status"]) => string

  // acciones
  onView: (o: Order) => void
  onUpdateStatus: (orderId: string, newStatus: Order["status"]) => void
}

const OrdersTab: FC<Props> = ({
  orders,
  filteredOrders,
  users,
  orderSearchTerm,
  setOrderSearchTerm,
  selectedOrderStatus,
  setSelectedOrderStatus,
  getOrderStatusIcon,
  getOrderStatusColor,
  getOrderStatusText,
  onView,
  onUpdateStatus,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Pedidos ({filteredOrders.length})</CardTitle>
        <CardDescription>Administra todos los pedidos de la tienda</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
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

        {/* Tabla de pedidos */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron pedidos</h3>
            <p className="text-muted-foreground">
              {orders.length === 0 ? "Aún no hay pedidos en la tienda." : "Intenta ajustar tus filtros de búsqueda."}
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
                        <span className="flex items-center gap-1">
                          {getOrderStatusIcon(order.status)}
                          <span className="text-xs">{getOrderStatusText(order.status)}</span>
                        </span>
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
                          <DropdownMenuItem onClick={() => onView(order)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalles
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onUpdateStatus(order.id, "confirmed")}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Confirmar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onUpdateStatus(order.id, "shipped")}>
                            <Truck className="mr-2 h-4 w-4" />
                            Marcar como enviado
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onUpdateStatus(order.id, "delivered")}>
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
  )
}

export default OrdersTab
