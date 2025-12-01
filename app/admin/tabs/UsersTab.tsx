"use client"

import { FC } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Users as UsersIcon, Search, MoreHorizontal, Eye, UserCheck, UserX, Shield, ShieldCheck, Loader2 } from "lucide-react"
import type { User } from "@/lib/database"

type Props = {
  users: User[]
  filteredUsers: User[]
  userSearchTerm: string
  setUserSearchTerm: (v: string) => void
  selectedUserRole: string
  setSelectedUserRole: (v: string) => void
  onView: (user: User) => void
  onToggleRole: (userId: string, currentRole: string) => void
  // NUEVO:
  busyUserId?: string | null
  busyMode?: "make" | "remove" | null
  currentUserId?: string
}

const UsersTab: FC<Props> = ({
  users,
  filteredUsers,
  userSearchTerm,
  setUserSearchTerm,
  selectedUserRole,
  setSelectedUserRole,
  onView,
  onToggleRole,
  // 👇 ¡faltaban estos dos!
  busyUserId,
  busyMode,
  currentUserId,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Usuarios ({filteredUsers.length})</CardTitle>
        <CardDescription>Administra los usuarios de la plataforma</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar usuarios..."
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedUserRole} onValueChange={setSelectedUserRole}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="student">Estudiante</SelectItem>
              <SelectItem value="teacher">Profesor</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => {
              setUserSearchTerm("")
              setSelectedUserRole("all")
            }}
          >
            Limpiar filtros
          </Button>
        </div>

        {/* Tabla */}
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron usuarios</h3>
            <p className="text-muted-foreground">
              {users.length === 0 ? "Aún no hay usuarios registrados." : "Intenta ajustar tus filtros de búsqueda."}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Carrera</TableHead>
                  <TableHead>Fecha de registro</TableHead>
                  <TableHead className="w-[70px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.platformAdmin
                            ? "destructive" // Color distintivo para Platform Admin
                            : user.role === "admin"
                              ? "default"
                              : user.role === "teacher"
                                ? "secondary"
                                : "outline"
                        }
                      >
                        <span className="flex items-center gap-1">
                          {user.platformAdmin ? (
                            <ShieldCheck className="h-3 w-3 text-white" />
                          ) : user.role === "admin" ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <Shield className="h-3 w-3" />
                          )}
                          <span>
                            {user.platformAdmin
                              ? "Platform Admin"
                              : user.role === "admin"
                                ? "Administrador"
                                : user.role === "teacher"
                                  ? "Profesor"
                                  : "Estudiante"}
                          </span>
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{user.career || "No especificada"}</span>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            disabled={busyUserId === user.id}
                            aria-label="Acciones"
                          >
                            {busyUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled={busyUserId === user.id} onClick={() => onView(user)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver perfil
                          </DropdownMenuItem>

                          {/* Ocultar opción si es el mismo usuario */}
                          {user.id !== currentUserId && (
                            <DropdownMenuItem
                              disabled={busyUserId === user.id}
                              onClick={() => onToggleRole(user.id, user.role)}
                            >
                              {user.platformAdmin ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  {busyUserId === user.id && busyMode === "remove" ? "Quitando..." : "Quitar Platform Admin"}
                                </>
                              ) : user.role === "admin" ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  {busyUserId === user.id && busyMode === "remove" ? "Quitando..." : "Quitar admin"}
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  {busyUserId === user.id && busyMode === "make" ? "Haciendo..." : "Hacer admin"}
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
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
    </Card >
  )
}

export default UsersTab
