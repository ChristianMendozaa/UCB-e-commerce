"use client";

import { useEffect, useState } from "react";
import type { User as FbUser } from "firebase/auth";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  /** Rol primario, solo para conveniencia visual */
  role: "student" | "teacher" | "admin";
  /** Lista completa de roles (fuente: colección roles) */
  roles: Array<"student" | "teacher" | "admin">;
  /** Carreras donde es admin (p.ej. ["SIS","ADM"]) */
  admin_careers: string[];
  /** Superadmin de plataforma */
  platform_admin: boolean;

  /** Compat: antes tenías career simple */
  career?: string; // si aún lo usas en UI legada
  photoURL?: string;
  is_admin?: boolean; // sigue viniendo desde /me
}

type MeResp = {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;

  role?: "student" | "teacher" | "admin";
  roles?: Array<"student" | "teacher" | "admin">;
  is_admin?: boolean;

  // NUEVO
  careers?: string[];          // 👈
  admin_careers?: string[];    // compat
  platform_admin?: boolean;

  profile?: { role?: "student" | "teacher" | "admin"; career?: string };
};

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

  /** Lista usuarios (requiere admin o platform_admin) */
  async listUsers(): Promise<Array<{
    uid: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
    roles: string[];
    role: string;
    admin_careers: string[];
    platform_admin: boolean;
  }>> {
    const res = await apiFetch<{ ok: boolean; users: any[] }>("/api/users", { method: "GET" });
    return res.users ?? [];
  }

  /** Hace admin a un usuario para una carrera */
  async makeAdmin(targetUid: string, career: string): Promise<void> {
    await apiFetch("/api/users/roles/make_admin", {
      method: "POST",
      body: JSON.stringify({ uid: targetUid, career }),
    });
  }

  // auth.ts (dentro de class AuthService)
  async removeAdmin(targetUid: string, career: string): Promise<void> {
    await apiFetch("/api/users/roles/remove_admin", {
      method: "POST",
      body: JSON.stringify({ uid: targetUid, career }),
    });
  }


  // Lista de carreras desde el backend (usa /api/careers)
  async getCareersPublic(): Promise<string[]> {
    try {
      // acepta dos formatos: { ok, careers } o string[]
      const res = await apiFetch<any>("/api/careers/public", { method: "GET" });
      if (Array.isArray(res)) return res as string[];
      if (Array.isArray(res?.careers)) return res.careers as string[];
      return [];
    } catch {
      return [];
    }
  }

  // Lista de carreras desde el backend (usa /api/careers)
  async getCareers(): Promise<string[]> {
    try {
      // acepta dos formatos: { ok, careers } o string[]
      const res = await apiFetch<any>("/api/careers", { method: "GET" });
      if (Array.isArray(res)) return res as string[];
      if (Array.isArray(res?.careers)) return res.careers as string[];
      return [];
    } catch {
      return [];
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
    const data = await apiFetch<MeResp>("/api/users/me", { method: "GET" });

    const role = data.role ?? data.profile?.role ?? "student";
    const roles = (data.roles?.length ? data.roles : []) as AuthUser["roles"] ?? ["student"];

    // preferimos 'careers', si no, 'admin_careers', si no, el 'career' legado
    const careers = data.careers
      ?? data.admin_careers
      ?? (data.profile?.career ? [data.profile.career] : []);

    const user: AuthUser = {
      id: data.uid,
      email: data.email ?? "",
      name: data.displayName ?? data.email ?? "Usuario",
      role,
      roles,
      admin_careers: careers ?? [],      // 👈 usamos el array
      platform_admin: !!data.platform_admin,
      photoURL: data.photoURL,
      is_admin: !!data.is_admin,
      career: data.profile?.career,      // compat con UI legada
    };

    this.currentUser = user;
    if (typeof window !== "undefined") {
      localStorage.setItem("authUser", JSON.stringify(user));
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
      localStorage.removeItem("ucb_cart_v1");
    }
  }

  /** Chequeos rápidos */
  isAuthenticatedSync(): boolean {
    return this.currentUser !== null;
  }

  hasRole(role: AuthUser["role"]): boolean {
    if (!this.currentUser) return false;
    const u = this.currentUser;

    // superadmin siempre pasa
    if (u.platform_admin) return true;

    // si es admin, también pasa
    if (u.is_admin || u.role === "admin" || (u.roles?.includes("admin"))) return true;

    // en caso contrario, verifica rol exacto
    return u.role === role || (u.roles?.includes(role) ?? false);
  }

  canManageCareer(career: string): boolean {
    if (!this.currentUser) return false;
    const u = this.currentUser;
    // superadmin puede todo
    if (u.platform_admin) return true;
    // admin de la carrera específica
    return (u.roles?.includes("admin") ?? false) && u.admin_careers?.includes(career);
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
    canManageCareer: authService.canManageCareer.bind(authService),
  };
}
