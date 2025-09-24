"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Search, UserPlus, Edit, Trash2, Shield, GraduationCap } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { DatabaseService } from "@/lib/database"
import AdminGuard from "@/components/admin-guard"

interface UserInterface {
  id: string
  name: string
  email: string
  role: "student" | "teacher" | "admin"
  career?: string
  registrationDate: string
  status: "active" | "inactive"
  lastLogin?: string
}

export default function UsersManagement() {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserInterface[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserInterface[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserInterface | null>(null)
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "student" as const,
    career: "",
    status: "active" as const,
  })

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, searchTerm, roleFilter, statusFilter])

  const loadUsers = async () => {
    const allUsers = await DatabaseService.getAllUsers()
    setUsers(allUsers)
  }

  const filterUsers = () => {
    let filtered = users

    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter)
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((user) => user.status === statusFilter)
    }

    setFilteredUsers(filtered)
  }

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email || !newUser.password) return

    const userId = DatabaseService.createUser({
      name: newUser.name,
      email: newUser.email,
      password: newUser.password,
      role: newUser.role,
      career: newUser.career || undefined,
    })

    if (userId) {
      loadUsers()
      setNewUser({
        name: "",
        email: "",
        password: "",
        role: "student",
        career: "",
        status: "active",
      })
      setIsAddDialogOpen(false)
    }
  }

  const handleUpdateUser = (userId: string, updates: Partial<UserInterface>) => {
    DatabaseService.updateUser(userId, updates)
    loadUsers()
    setEditingUser(null)
  }

  const handleDeleteUser = (userId: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este usuario?")) {
      DatabaseService.deleteUser(userId)
      loadUsers()
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="h-4 w-4" />
      case "teacher":
        return <GraduationCap className="h-4 w-4" />
      default:
        return <GraduationCap className="h-4 w-4" />
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800"
      case "teacher":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-green-100 text-green-800"
    }
  }

  const careers = ["Ingeniería de Sistemas", "Psicopedagogía", "Mecatrónica"]

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-ucb-blue">Gestión de Usuarios</h1>
            <p className="text-gray-600 mt-2">Administra usuarios, roles y permisos</p>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-ucb-gold hover:bg-ucb-gold/90 text-white">
                <UserPlus className="h-4 w-4 mr-2" />
                Agregar Usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Agregar Nuevo Usuario</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input
                    id="name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Nombre completo"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="email@ucb.edu.bo"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Contraseña"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Rol</Label>
                  <Select value={newUser.role} onValueChange={(value: any) => setNewUser({ ...newUser, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Estudiante</SelectItem>
                      <SelectItem value="teacher">Docente</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newUser.role === "student" && (
                  <div>
                    <Label htmlFor="career">Carrera</Label>
                    <Select value={newUser.career} onValueChange={(value) => setNewUser({ ...newUser, career: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar carrera" />
                      </SelectTrigger>
                      <SelectContent>
                        {careers.map((career) => (
                          <SelectItem key={career} value={career}>
                            {career}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleAddUser} className="w-full bg-ucb-gold hover:bg-ucb-gold/90">
                  Crear Usuario
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar por nombre o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filtrar por rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="student">Estudiantes</SelectItem>
                  <SelectItem value="teacher">Docentes</SelectItem>
                  <SelectItem value="admin">Administradores</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de usuarios */}
        <div className="grid gap-4">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getRoleIcon(user.role)}
                      <h3 className="font-semibold text-lg">{user.name}</h3>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role === "admin" ? "Administrador" : user.role === "teacher" ? "Docente" : "Estudiante"}
                      </Badge>
                      <Badge variant={user.status === "active" ? "default" : "secondary"}>
                        {user.status === "active" ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-1">{user.email}</p>
                    {user.career && <p className="text-sm text-gray-500">Carrera: {user.career}</p>}
                    <div className="flex flex-col sm:flex-row gap-2 text-sm text-gray-500 mt-2">
                      <span>Registrado: {new Date(user.registrationDate).toLocaleDateString()}</span>
                      {user.lastLogin && <span>Último acceso: {new Date(user.lastLogin).toLocaleDateString()}</span>}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setEditingUser(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Editar Usuario</DialogTitle>
                        </DialogHeader>
                        {editingUser && (
                          <div className="space-y-4">
                            <div>
                              <Label>Nombre</Label>
                              <Input
                                value={editingUser.name}
                                onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Email</Label>
                              <Input
                                value={editingUser.email}
                                onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Rol</Label>
                              <Select
                                value={editingUser.role}
                                onValueChange={(value: any) => setEditingUser({ ...editingUser, role: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="student">Estudiante</SelectItem>
                                  <SelectItem value="teacher">Docente</SelectItem>
                                  <SelectItem value="admin">Administrador</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Estado</Label>
                              <Select
                                value={editingUser.status}
                                onValueChange={(value: any) => setEditingUser({ ...editingUser, status: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Activo</SelectItem>
                                  <SelectItem value="inactive">Inactivo</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              onClick={() => handleUpdateUser(editingUser.id, editingUser)}
                              className="w-full bg-ucb-gold hover:bg-ucb-gold/90"
                            >
                              Guardar Cambios
                            </Button>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No se encontraron usuarios</h3>
              <p className="text-gray-500">Intenta ajustar los filtros de búsqueda</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminGuard>
  )
}
