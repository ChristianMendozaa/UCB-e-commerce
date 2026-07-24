"use client"

import { FC } from "react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Order } from "@/lib/orders"
import type { User } from "@/lib/database"
import type { Product } from "@/lib/products"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  order: Order | null
  users: User[]
  // helpers
  getOrderStatusIcon: (s: Order["status"]) => JSX.Element
  getOrderStatusColor: (s: Order["status"]) => string
  getOrderStatusText: (s: Order["status"]) => string
  getProductDetails: (productId: string) => Product | undefined
}

const OrderViewModal: FC<Props> = ({
  open,
  onOpenChange,
  order,
  users,
  getOrderStatusIcon,
  getOrderStatusColor,
  getOrderStatusText,
  getProductDetails,
}) => {
  const user = order ? users.find((u) => u.id === order.userId) : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalles del Pedido</DialogTitle>
        </DialogHeader>

        {order && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Pedido #{order.id}</h3>
                <p className="text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <Badge className={`${getOrderStatusColor(order.status)} text-white`}>
                <span className="flex items-center gap-1">
                  {getOrderStatusIcon(order.status)}
                  <span>{getOrderStatusText(order.status)}</span>
                </span>
              </Badge>
            </div>

            <div>
              <Label className="text-sm font-medium">Cliente</Label>
              <p className="text-sm">{user?.name || "Usuario desconocido"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>

            <div>
              <Label className="text-sm font-medium">Productos</Label>
              <div className="space-y-2 mt-2">
                {order.items.map((item, idx) => {
                  const product = getProductDetails(item.productId)
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
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
                <span className="text-xl font-bold">Bs. {order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default OrderViewModal
