"use client"

import { FC } from "react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Product } from "@/lib/products"
type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  product: Product | null
  getStockBadge: (stock: number) => JSX.Element
}

const ProductViewModal: FC<Props> = ({ open, onOpenChange, product, getStockBadge }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalles del Producto</DialogTitle>
        </DialogHeader>

        {product && (
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <img
                src={product.image || "/placeholder.svg"}
                alt={product.name}
                className="w-24 h-24 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{product.name}</h3>
                <p className="text-muted-foreground">{product.description}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge variant="outline">{product.career}</Badge>
                  <Badge variant="secondary">{product.category}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Precio</Label>
                <p className="text-lg font-bold">Bs. {product.price}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Stock</Label>
                <p className="text-lg">{product.stock} unidades</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Estado</Label>
                <div className="mt-1">{getStockBadge(product.stock)}</div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Fecha de creación</Label>
              <p className="text-sm text-muted-foreground">
                {new Date(product.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ProductViewModal
