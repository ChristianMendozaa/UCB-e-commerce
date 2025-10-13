"use client"

import { FC } from "react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Shield, ShieldCheck } from "lucide-react"
import type { User } from "@/lib/database"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  user: User | null
}

const UserViewModal: FC<Props> = ({ open, onOpenChange, user }) => {
  const roleBadge = user?.role === "admin" ? (
    <Badge variant="default" className="gap-1">
      <ShieldCheck className="h-3 w-3" />
      Administrador
    </Badge>
  ) : user?.role === "teacher" ? (
    <Badge variant="secondary" className="gap-1">
      <Shield className="h-3 w-3" />
      Profesor
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1">
      <Shield className="h-3 w-3" />
      Estudiante
    </Badge>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Perfil de Usuario</DialogTitle>
        </DialogHeader>

        {user && (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xl font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-semibold">{user.name}</h3>
                <p className="text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Rol</Label>
                <div className="mt-1">{roleBadge}</div>
              </div>
              <div>
                <Label className="text-sm font-medium">Carrera</Label>
                <p className="text-sm">{user.career || "No especificada"}</p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Fecha de registro</Label>
              <p className="text-sm text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default UserViewModal
