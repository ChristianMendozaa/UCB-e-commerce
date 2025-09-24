"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Header } from "@/components/header"
import { authService } from "@/lib/auth"
import { db } from "@/lib/database"
import { Eye, EyeOff, ArrowLeft } from "lucide-react"

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "" as "student" | "teacher",
    career: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const careers = db.getCareers()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validaciones
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }

    if (!formData.email.includes("@ucb.edu.bo")) {
      setError("Debes usar un email institucional (@ucb.edu.bo)")
      return
    }

    if (formData.role === "student" && !formData.career) {
      setError("Los estudiantes deben seleccionar una carrera")
      return
    }

    setIsLoading(true)

    try {
      const user = await authService.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        career: formData.role === "student" ? formData.career : undefined,
      })

      if (user) {
        router.push("/catalog")
        router.refresh()
      } else {
        setError("Error al crear la cuenta. El email podría estar en uso.")
      }
    } catch (err) {
      setError("Error al registrarse. Inténtalo de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="mb-6">
            <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio
            </Link>
          </div>

          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-primary-foreground font-bold text-xl">UCB</span>
              </div>
              <CardTitle className="text-2xl">Crear Cuenta</CardTitle>
              <CardDescription>Únete a la comunidad UCB Store</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Tu nombre completo"
                    value={formData.name}
                    onChange={(e) => updateFormData("name", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email institucional</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu.email@ucb.edu.bo"
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Debes usar tu email institucional de UCB</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Tipo de usuario</Label>
                  <Select value={formData.role} onValueChange={(value) => updateFormData("role", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tu rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Estudiante</SelectItem>
                      <SelectItem value="teacher">Docente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.role === "student" && (
                  <div className="space-y-2">
                    <Label htmlFor="career">Carrera</Label>
                    <Select value={formData.career} onValueChange={(value) => updateFormData("career", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tu carrera" />
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

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={formData.password}
                      onChange={(e) => updateFormData("password", e.target.value)}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repite tu contraseña"
                      value={formData.confirmPassword}
                      onChange={(e) => updateFormData("confirmPassword", e.target.value)}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  ¿Ya tienes cuenta?{" "}
                  <Link href="/login" className="text-primary hover:underline font-medium">
                    Inicia sesión aquí
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
