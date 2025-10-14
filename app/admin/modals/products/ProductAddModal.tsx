"use client"

import { FC, ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ProductFormState } from "@/lib/products"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  form: ProductFormState
  // 👇 acepta el mismo tipo que useState devuelve
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>
  careers: string[]
  categories: string[]
  onSubmit: () => void
  /** si la recibes, bloquea el selector y usa ese valor */
  lockCareer?: string | null
}

const ProductAddModal: FC<Props> = ({
  open, onOpenChange, form, setForm, careers, categories, onSubmit, lockCareer
}) => {
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setForm(prev => ({
      ...prev,
      imageFile: file,
      image: file ? URL.createObjectURL(file) : ""
    }))
  }

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
              <Input id="name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Precio (Bs.)</Label>
              <Input id="price" type="number" value={form.price} onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={3} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="career">Carrera</Label>
              <Select
                value={lockCareer ?? form.career}
                onValueChange={(v) => setForm(p => ({ ...p, career: v }))}
                disabled={!!lockCareer}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar carrera" /></SelectTrigger>
                <SelectContent>
                  {(lockCareer ? [lockCareer] : careers).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Stock</Label>
              <Input id="stock" type="number" value={form.stock} onChange={(e) => setForm(p => ({ ...p, stock: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Imagen</Label>
            <Input type="file" accept="image/*" onChange={onFile} />
            {form.image && <img src={form.image} alt="preview" className="h-24 w-24 mt-2 rounded object-cover" />}
            <p className="text-xs text-muted-foreground">Selecciona un archivo. El backend generará la URL pública.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={!form.name || !form.price || !(lockCareer ?? form.career)}>Crear Producto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ProductAddModal
