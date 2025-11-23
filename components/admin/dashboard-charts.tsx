"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { Order } from "@/lib/orders"

interface DashboardChartsProps {
  stats: {
    totalProducts: number
    totalOrders: number
    totalUsers: number
    totalRevenue: number
    pendingOrders: number
    lowStockProducts: number
  }
  orders: Order[]
}

export const DashboardCharts = ({ stats, orders }: DashboardChartsProps) => {
  // Preparar datos para gráficos

  // 1. Datos de distribución de estados de pedidos
  const orderStatusData = [
    { name: "Pendiente", value: orders.filter((o) => o.status === "pending").length, fill: "#eab308" },
    { name: "Confirmado", value: orders.filter((o) => o.status === "confirmed").length, fill: "#3b82f6" },
    { name: "Enviado", value: orders.filter((o) => o.status === "shipped").length, fill: "#a855f7" },
    { name: "Entregado", value: orders.filter((o) => o.status === "delivered").length, fill: "#22c55e" },
  ].filter((item) => item.value > 0)

  // 2. Datos de ingresos por mes (últimos 30 días, simulado por fecha de pedido)
  const getLast30DaysData = () => {
    const data: Record<string, number> = {}
    const today = new Date()

    // Inicializar últimos 7 días
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const key = date.toLocaleDateString("es-BO", { month: "short", day: "numeric" })
      data[key] = 0
    }

    // Agregar ingresos por día
    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt)
      const daysDiff = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff >= 0 && daysDiff < 7) {
        const key = orderDate.toLocaleDateString("es-BO", { month: "short", day: "numeric" })
        data[key] = (data[key] || 0) + order.total
      }
    })

    return Object.entries(data).map(([date, total]) => ({
      date,
      total: Math.round(total * 100) / 100,
    }))
  }

  const revenueData = getLast30DaysData()

  // 3. Datos KPI
  const kpiData = [
    {
      name: "Ticket Promedio",
      value: orders.length > 0 ? `Bs. ${(stats.totalRevenue / orders.length).toFixed(2)}` : "Bs. 0",
    },
    { name: "Conversión", value: `${orders.length}/${stats.totalUsers}` },
    {
      name: "Margen Efectivo",
      value: `${stats.totalOrders > 0 ? ((stats.totalOrders / (stats.totalUsers || 1)) * 100).toFixed(1) : 0}%`,
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpiData.map((kpi, idx) => (
          <Card key={idx}>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground mb-2">{kpi.name}</p>
              <p className="text-2xl font-bold text-primary">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Ingresos - Últimos 7 Días</CardTitle>
            <CardDescription>Tendencia de ventas diarias</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                total: {
                  label: "Ingresos (Bs)",
                  color: "hsl(var(--color-primary))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#f4d03f"
                    strokeWidth={2}
                    name="Ingresos"
                    dot={{ fill: "#f4d03f", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Order Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Estados</CardTitle>
            <CardDescription>Estado actual de pedidos</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ChartContainer
              config={{
                pending: { label: "Pendiente", color: "#eab308" },
                confirmed: { label: "Confirmado", color: "#3b82f6" },
                shipped: { label: "Enviado", color: "#a855f7" },
                delivered: { label: "Entregado", color: "#22c55e" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={orderStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {orderStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Stats Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen Operativo</CardTitle>
            <CardDescription>Métricas clave del negocio</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                productos: { label: "Productos", color: "hsl(var(--color-primary))" },
                pedidos: { label: "Pedidos", color: "#3b82f6" },
                usuarios: { label: "Usuarios", color: "#22c55e" },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: "Totales",
                      productos: stats.totalProducts,
                      pedidos: stats.totalOrders,
                      usuarios: stats.totalUsers,
                    },
                  ]}
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="productos" fill="#f4d03f" name="Productos" />
                  <Bar dataKey="pedidos" fill="#3b82f6" name="Pedidos" />
                  <Bar dataKey="usuarios" fill="#22c55e" name="Usuarios" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Health Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Estado de Salud</CardTitle>
            <CardDescription>Indicadores de la tienda</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Stock Bajo</span>
                <span className={`text-lg font-bold ${stats.lowStockProducts > 5 ? "text-red-500" : "text-green-500"}`}>
                  {stats.lowStockProducts} productos
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Pedidos Pendientes</span>
                <span
                  className={`text-lg font-bold ${stats.pendingOrders > 10 ? "text-orange-500" : "text-green-500"}`}
                >
                  {stats.pendingOrders} pedidos
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Tasa de Conversión</span>
                <span className="text-lg font-bold text-primary">
                  {stats.totalUsers > 0 ? ((stats.totalOrders / stats.totalUsers) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Ingresos Totales</span>
                <span className="text-lg font-bold text-primary">Bs. {stats.totalRevenue.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
