"use client"
import { FC, ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ProductFormState } from "@/lib/products"
import { Loader2 } from "lucide-react"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  form: ProductFormState
  // 👇 igual que useState
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>
  careers: string[]
  categories: string[]
  onSubmit: () => void
  /** si existe, la carrera queda fija */
  lockCareer?: string | null
  saving?: boolean
}

const ProductEditModal: FC<Props> = ({
  open, onOpenChange, form, setForm, careers, categories, onSubmit, lockCareer, saving
}) => {
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setForm(p => ({ ...p, imageFile: file, image: file ? URL.createObjectURL(file) : p.image }))
  }

  const careerValue = lockCareer ?? form.career
  const careerOptions = lockCareer ? [lockCareer] : careers

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Producto</DialogTitle>
          <DialogDescription>Modifica la información del producto</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre del producto</Label>
              <Input id="edit-name" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-price">Precio (Bs.)</Label>
              <Input id="edit-price" type="number" value={form.price} onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Descripción</Label>
            <Textarea id="edit-description" rows={3} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-career">Carrera</Label>
              <Select
                value={careerValue}
                onValueChange={(v) => setForm(p => ({ ...p, career: v }))}
                disabled={!!lockCareer}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar carrera" /></SelectTrigger>
                <SelectContent>
                  {careerOptions.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-stock">Stock</Label>
              <Input id="edit-stock" type="number" value={form.stock} onChange={(e) => setForm(p => ({ ...p, stock: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Imagen</Label>
            <Input type="file" accept="image/*" onChange={onFile} />
            {form.image && (<img src={form.image} alt="preview" className="h-24 w-24 mt-2 rounded object-cover" />)}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => !saving && onOpenChange(false)} disabled={!!saving}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!!saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ProductEditModal
