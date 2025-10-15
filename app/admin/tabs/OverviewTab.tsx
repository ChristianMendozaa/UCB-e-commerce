"use client"

import { FC } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, ShoppingCart, Users, TrendingUp, Clock } from "lucide-react"
import type { Order } from "@/lib/orders"
import type { Product } from "@/lib/products"

export type DashboardStats = {
  totalProducts: number
  totalOrders: number
  totalUsers: number
  totalRevenue: number
  pendingOrders: number
  lowStockProducts: number
}

type Props = {
  stats: DashboardStats
  recentOrders: Order[]
  lowStockProducts: Product[]
  // helpers de estado de pedido (provistos por el padre)
  getOrderStatusIcon: (s: Order["status"]) => JSX.Element
  getOrderStatusColor: (s: Order["status"]) => string
  getOrderStatusText: (s: Order["status"]) => string
}

const StatCard: FC<{ icon: JSX.Element; label: string; value: string | number }> = ({ icon, label, value }) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center space-x-2">
        {icon}
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
)

const OverviewTab: FC<Props> = ({
  stats,
  recentOrders,
  lowStockProducts,
  getOrderStatusIcon,
  getOrderStatusColor,
  getOrderStatusText,
}) => {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <StatCard icon={<Package className="h-5 w-5 text-primary" />} label="Productos" value={stats.totalProducts} />
        <StatCard icon={<ShoppingCart className="h-5 w-5 text-blue-500" />} label="Pedidos" value={stats.totalOrders} />
        <StatCard icon={<Users className="h-5 w-5 text-green-500" />} label="Usuarios" value={stats.totalUsers} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-purple-500" />} label="Ingresos" value={`Bs. ${stats.totalRevenue.toFixed(0)}`} />
        <StatCard icon={<Clock className="h-5 w-5 text-yellow-500" />} label="Pendientes" value={stats.pendingOrders} />
        <StatCard icon={<Package className="h-5 w-5 text-red-500" />} label="Stock Bajo" value={stats.lowStockProducts} />
      </div>

      {/* Columna doble: Pedidos recientes / Stock bajo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pedidos recientes */}
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
                      <span className="flex items-center gap-1">
                        {getOrderStatusIcon(order.status)}
                        <span className="text-xs">{getOrderStatusText(order.status)}</span>
                      </span>
                    </Badge>
                    <span className="font-bold">Bs. {order.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              {recentOrders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay pedidos recientes.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stock bajo */}
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
    </div>
  )
}

export default OverviewTab
