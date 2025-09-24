"use client"

import { db } from "./database"
import { useState, useEffect } from "react"

export interface AuthUser {
  id: string
  email: string
  name: string
  role: "student" | "teacher" | "admin"
  career?: string
}

class AuthService {
  private currentUser: AuthUser | null = null

  async login(email: string, password: string): Promise<AuthUser | null> {
    const user = await db.findUser(email, password)
    if (user) {
      this.currentUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        career: user.career,
      }
      // Simular persistencia en localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("ucb_user", JSON.stringify(this.currentUser))
      }
      return this.currentUser
    }
    return null
  }

  async register(userData: {
    email: string
    password: string
    name: string
    role: "student" | "teacher"
    career?: string
  }): Promise<AuthUser | null> {
    try {
      const existingUser = await db.findUser(userData.email)
      if (existingUser) {
        throw new Error("El usuario ya existe")
      }

      const newUser = await db.createUser(userData)
      this.currentUser = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        career: newUser.career,
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("ucb_user", JSON.stringify(this.currentUser))
      }
      return this.currentUser
    } catch (error) {
      console.error("Error en registro:", error)
      return null
    }
  }

  getCurrentUser(): AuthUser | null {
    if (this.currentUser) return this.currentUser

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ucb_user")
      if (stored) {
        this.currentUser = JSON.parse(stored)
        return this.currentUser
      }
    }
    return null
  }

  logout(): void {
    this.currentUser = null
    if (typeof window !== "undefined") {
      localStorage.removeItem("ucb_user")
    }
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser()
    return user?.role === role
  }
}

export const authService = new AuthService()

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const currentUser = authService.getCurrentUser()
    setUser(currentUser)
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const loggedInUser = await authService.login(email, password)
    setUser(loggedInUser)
    return loggedInUser
  }

  const register = async (userData: {
    email: string
    password: string
    name: string
    role: "student" | "teacher"
    career?: string
  }) => {
    const registeredUser = await authService.register(userData)
    setUser(registeredUser)
    return registeredUser
  }

  const logout = () => {
    authService.logout()
    setUser(null)
  }

  return {
    user,
    isLoading,
    login,
    register,
    logout,
    isAuthenticated: authService.isAuthenticated(),
    hasRole: authService.hasRole.bind(authService),
  }
}
