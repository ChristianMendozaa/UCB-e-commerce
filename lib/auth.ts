"use client";

import { useEffect, useState } from "react";
import type { User as FbUser } from "firebase/auth";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "student" | "teacher" | "admin";
  career?: string;
  photoURL?: string;
  is_admin?: boolean;
}

function getFirebaseAuth() {
  // Carga dinámica (evita problemas de SSR)
  return import("firebase/app")
    .then(async (fb) => {
      const app =
        fb.getApps().length > 0
          ? fb.getApp()
          : fb.initializeApp({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          });

      const authMod = await import("firebase/auth");
      const auth = authMod.getAuth(app);
      const provider = new authMod.GoogleAuthProvider();

      return { auth, provider, authMod };
    })
    .catch((e) => {
      console.error("Firebase init error:", e);
      throw e;
    });
}

/** apiFetch:
 * - Usa rutas relativas /api/... que serán reescritas hacia tu backend (ver next.config.js).
 * - Mantiene credentials: "include" para enviar la cookie HttpOnly (__session).
 */
async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  // Asegura que usemos la capa de rewrites
  const url =
    path.startsWith("http")
      ? path
      : path.startsWith("/api/")
        ? path
        : `/api${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = await res.text().catch(() => "");
    try {
      const j = JSON.parse(msg);
      msg = (j as any).detail || JSON.stringify(j);
    } catch { }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

class AuthService {
  private currentUser: AuthUser | null = null;

  constructor() {
    // Cargar usuario guardado (persistencia local)
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("authUser");
      if (saved) {
        try {
          this.currentUser = JSON.parse(saved);
        } catch { }
      }
    }
  }

  /** Login con Google -> backend fija cookie __session */
  async googleLogin(): Promise<AuthUser> {
    const { auth, provider, authMod } = await getFirebaseAuth();
    const result = await authMod.signInWithPopup(auth, provider);
    const fbUser: FbUser | null = result.user ?? auth.currentUser;
    if (!fbUser) throw new Error("No se pudo obtener el usuario de Firebase");

    const idToken = await fbUser.getIdToken(true);

    // Tu backend crea la cookie __session (vía rewrite a /api/auth/...)
    await apiFetch("/api/auth/google/login_or_register", {
      method: "POST",
      body: JSON.stringify({
        provider_id_token: idToken,
        request_uri: typeof window !== "undefined" ? window.location.origin : "http://localhost",
      }),
    });

    // Luego pedimos /users/me (vía rewrite)
    const me = await this.fetchMe();
    this.currentUser = me;
    localStorage.setItem("authUser", JSON.stringify(me));

    return me;
  }

  /** Obtiene /users/me desde el backend */
  async fetchMe(): Promise<AuthUser> {
    type MeResp = {
      uid: string;
      email?: string;
      displayName?: string;
      photoURL?: string;
      role?: "student" | "teacher" | "admin";
      is_admin?: boolean;
      profile?: { role?: "student" | "teacher" | "admin"; career?: string };
    };

    const data = await apiFetch<MeResp>("/api/users/me", { method: "GET" });

    const role = data.role ?? data.profile?.role ?? "student";

    const user: AuthUser = {
      id: data.uid,
      email: data.email ?? "",
      name: data.displayName ?? data.email ?? "Usuario",
      role,
      career: data.profile?.career,
      photoURL: data.photoURL,
      is_admin: data.is_admin,
    };

    // Guardar en memoria y localStorage
    this.currentUser = user;
    if (typeof window !== "undefined") {
      const { role, is_admin, ...safeUser } = user;
      localStorage.setItem("authUser", JSON.stringify(safeUser));
    }

    return user;
  }

  /** Obtiene el usuario actual (de memoria o backend) */
  async getCurrentUser(): Promise<AuthUser | null> {
    if (this.currentUser) return this.currentUser;
    // Siempre pide al backend el rol actual
    try {
      const me = await this.fetchMe();
      this.currentUser = me;
      return me;
    } catch {
      // Si falla (offline), usa cache parcial sin rol
      return this.currentUser;
    }

  }

  /** Cerrar sesión */
  async logout(): Promise<void> {
    try {
      await apiFetch("/api/auth/session/logout", { method: "POST" });
    } catch (e) {
      console.warn("logout backend:", e);
    }
    try {
      const { auth, authMod } = await getFirebaseAuth();
      await authMod.signOut(auth);
    } catch (e) {
      console.warn("firebase signOut:", e);
    }

    // Limpiar todo
    this.currentUser = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("authUser");
    }
  }

  /** Chequeos rápidos */
  isAuthenticatedSync(): boolean {
    return this.currentUser !== null;
  }

  hasRole(role: AuthUser["role"]): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.is_admin || this.currentUser.role === "admin") return true;
    return this.currentUser.role === role;
  }
}

/* Exportar instancia global */
export const authService = new AuthService();

/* Hook reactivo para usar en componentes */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    authService
      .getCurrentUser()
      .then((u) => mounted && setUser(u))
      .finally(() => mounted && setIsLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const googleLogin = async () => {
    const u = await authService.googleLogin();
    setUser(u);
    return u;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return {
    user,
    isLoading,
    googleLogin,
    logout,
    isAuthenticated: !!user,
    hasRole: authService.hasRole.bind(authService),
  };
}
