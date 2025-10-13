"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Header } from "@/components/header"
import { authService } from "@/lib/auth"
import { ArrowLeft, Chrome } from "lucide-react"

export default function LoginPage() {
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // En tu LoginPage
  const handleGoogleLogin = async () => {
    setError("");
    setIsLoading(true);
    try {
      const user = await authService.googleLogin();
      if (user) {
        router.push("/");
        router.refresh();
      }
    } catch (e: any) {
      setError(e?.message || "Error al iniciar sesión con Google.");
    } finally {
      setIsLoading(false);
    }
  };

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
              <CardTitle className="text-2xl">Accede a UCB Store</CardTitle>
              <CardDescription>Autenticación con Google</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleGoogleLogin}
                className="w-full"
                disabled={isLoading}
                variant="default"
              >
                <Chrome className="mr-2 h-4 w-4" />
                {isLoading ? "Conectando con Google..." : "Continuar con Google"}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Tu cuenta será creada o iniciada automáticamente por el servicio de autenticación.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
