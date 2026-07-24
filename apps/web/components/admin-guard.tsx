"use client";

import { useEffect, useState } from "react";

type MeResp = {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: "student" | "teacher" | "admin";
  is_admin?: boolean;
  profile?: { role?: "student" | "teacher" | "admin"; career?: string };
};

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Importante: usar el rewrite de Next: /api/users/me
        const res = await fetch("/api/users/me", {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        if (!res.ok) {
          // 401/403 u otro error → no permitido
          if (mounted) {
            setAllowed(false);
            setErrorMsg("No tienes permisos para acceder a esta sección. Solo los administradores pueden ver el panel de administración.");
          }
          return;
        }

        const me: MeResp & { platform_admin?: boolean } = await res.json();
        const isAdmin = Boolean(me.is_admin || me.role === "admin" || me.profile?.role === "admin" || me.platform_admin);

        if (mounted) {
          setAllowed(isAdmin);
          setErrorMsg(
            isAdmin
              ? null
              : "No tienes permisos para acceder a esta sección. Solo los administradores pueden ver el panel de administración."
          );
        }
      } catch (e) {
        if (mounted) {
          setAllowed(false);
          setErrorMsg("No se pudo verificar tus permisos. Intenta iniciar sesión nuevamente.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    // Pantalla de verificación, evita el “flash” de sin permisos
    return (
      <div className="min-h-screen flex flex-col">
        {/* Si usas Header aquí, colócalo si quieres */}
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-muted-foreground">Verificando permisos…</div>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
