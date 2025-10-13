import { Clock, CheckCircle, Truck, Package } from "lucide-react"
import React from "react"
import { cn } from "@/lib/utils"

export function getOrderStatusIcon(status: string) {
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

export function getOrderStatusText(status: string) {
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

export function getOrderStatusColor(status: string) {
  return cn({
    "bg-yellow-500": status === "pending",
    "bg-blue-500": status === "confirmed",
    "bg-purple-500": status === "shipped",
    "bg-green-500": status === "delivered",
    "bg-gray-500": !["pending", "confirmed", "shipped", "delivered"].includes(status),
  })
}
export function getStockBadge(stock: number) {
  if (stock <= 0) {
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-destructive text-destructive-foreground font-medium">
        Sin stock
      </span>
    )
  }
  if (stock <= 5) {
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-yellow-500 text-white font-medium">
        Bajo
      </span>
    )
  }
  return (
    <span className="px-2 py-1 text-xs rounded-full bg-emerald-600 text-white font-medium">
      En stock
    </span>
  )
}
