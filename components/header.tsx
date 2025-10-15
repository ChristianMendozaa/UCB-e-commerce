"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Menu, X, LogOut, Package } from "lucide-react"
import { authService, type AuthUser } from "@/lib/auth" // asegúrate que exporte is_admin opcional
import { ThemeToggle } from "./theme-toggle"
import { useCart } from "@/contexts/cart-context"

export function Header() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { cartCount, updateCartCount } = useCart()

  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const u = await authService.getCurrentUser()
          if (mounted) setUser(u)
        } catch {
          if (mounted) setUser(null)
        } finally {
          // al montar el header, sincroniza el contador por si cambió fuera
          updateCartCount?.()
        }
      })()

    const onStorage = (e: StorageEvent) => {
      if (e.key === "authUser") {
        try {
          const parsed = e.newValue ? (JSON.parse(e.newValue) as AuthUser) : null
          setUser(parsed)
        } catch {
          setUser(null)
        }
      }
    }
    window.addEventListener("storage", onStorage)

    return () => {
      mounted = false
      window.removeEventListener("storage", onStorage)
    }
  }, [updateCartCount])

  useEffect(() => {
    let mounted = true

      // Cargar usuario (respeta cookie HttpOnly; usa cache/localStorage si existe)
      ; (async () => {
        try {
          const u = await authService.getCurrentUser()
          if (mounted) setUser(u)
        } catch {
          if (mounted) setUser(null)
        }
      })()

    // Sincroniza cambios de sesión entre pestañas
    const onStorage = (e: StorageEvent) => {
      if (e.key === "authUser") {
        try {
          const parsed = e.newValue ? (JSON.parse(e.newValue) as AuthUser) : null
          setUser(parsed)
        } catch {
          setUser(null)
        }
      }
    }
    window.addEventListener("storage", onStorage)

    return () => {
      mounted = false
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const isAdmin = !!(user?.is_admin || user?.role === "admin")
  const firstName = user?.name ? user.name.split(" ")[0] : ""

  const handleLogout = async () => {
    await authService.logout()
    setUser(null)
    window.location.href = "/"
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <div className="relative h-10 w-10 flex-shrink-0">
              <Image
                src="/ucb-logo.png"
                alt="Universidad Católica Boliviana"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-foreground leading-tight">UCB Store</h1>
              <p className="text-xs text-muted-foreground leading-tight">Universidad Católica Boliviana</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/catalog" className="text-sm font-medium hover:text-primary transition-colors">
              Catálogo
            </Link>
            <Link href="/careers" className="text-sm font-medium hover:text-primary transition-colors">
              Por Carrera
            </Link>
            {isAdmin && (
              <Link href="/admin" className="text-sm font-medium hover:text-primary transition-colors">
                Administración
              </Link>
            )}
          </nav>

          {/* User Actions */}
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            {/* Cart */}
            <Link href="/cart">
              <Button variant="ghost" size="sm" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 min-w-[1.25rem] rounded-full p-0 px-1 flex items-center justify-center text-[10px] leading-none"
                    title={`${cartCount} en carrito`}
                  >
                    {cartCount > 10 ? "10+" : cartCount}
                  </Badge>
                )}
              </Button>
            </Link>
            {user ? (
              <>
                <Link href="/orders">
                  <Button variant="ghost" size="sm">
                    <Package className="h-5 w-5" />
                    <span className="hidden sm:inline ml-2">Mis Pedidos</span>
                  </Button>
                </Link>

                {/* User Menu */}
                <div className="hidden md:flex items-center space-x-6">
                  <div className="text-right">
                    <p className="text-sm font-medium">{firstName}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="hidden md:flex items-center space-x-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Iniciar Sesión
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t bg-background">
            <div className="py-4 space-y-2">
              <Link
                href="/catalog"
                className="block px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Catálogo
              </Link>
              <Link
                href="/careers"
                className="block px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Por Carrera
              </Link>

              {user ? (
                <>
                  <Link
                    href="/orders"
                    className="block px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Mis Pedidos
                  </Link>

                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="block px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Administración
                    </Link>
                  )}
                  <div className="px-4 py-2 border-t">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{isAdmin ? "admin" : user.role}</p>
                    {user.career && <p className="text-xs text-muted-foreground">{user.career}</p>}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                  >
                    Cerrar Sesión
                  </button>
                </>
              ) : (
                <div className="px-4 py-2 space-y-2 border-t">
                  <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      Iniciar Sesión
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
