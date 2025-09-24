"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/auth"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield } from "lucide-react"

interface AdminGuardProps {
  children: React.ReactNode
}

export function AdminGuard({ children }: AdminGuardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const user = authService.getCurrentUser()

    if (!user) {
      router.push("/login")
      return
    }

    if (user.role !== "admin") {
      setIsAuthorized(false)
      setIsLoading(false)
      return
    }

    setIsAuthorized(true)
    setIsLoading(false)
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p>Verificando permisos...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
            <Alert variant="destructive">
              <AlertDescription>
                No tienes permisos para acceder a esta sección. Solo los administradores pueden ver el panel de
                administración.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}

export default AdminGuard
