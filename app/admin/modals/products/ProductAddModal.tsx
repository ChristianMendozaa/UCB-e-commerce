"use client"

import { FC } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Upload } from "lucide-react"

type ProductForm = {
  name: string
  description: string
  price: string
  category: string
  career: string
  stock: string
  image: string
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  form: ProductForm
  setForm: (f: ProductForm) => void
  careers: string[]
  categories: string[]
  onSubmit: () => void
}

const ProductAddModal: FC<Props> = ({ open, onOpenChange, form, setForm, careers, categories, onSubmit }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Nuevo Producto</DialogTitle>
          <DialogDescription>Completa la información del nuevo producto</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del producto</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Laptop Dell Inspiron"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Precio (Bs.)</Label>
              <Input
                id="price"
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descripción detallada del producto"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="career">Carrera</Label>
              <Select value={form.career} onValueChange={(v) => setForm({ ...form, career: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar carrera" />
                </SelectTrigger>
                <SelectContent>
                  {careers.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">URL de la imagen</Label>
            <div className="flex gap-2">
              <Input
                id="image"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                placeholder="https://... o /ruta/imagen.jpg"
              />
              <Button variant="outline" size="icon" type="button">
                <Upload className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Puedes usar una URL externa o subir una imagen</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!form.name || !form.price || !form.career}>
            Crear Producto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ProductAddModal
