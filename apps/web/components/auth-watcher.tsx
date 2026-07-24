"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, onAuthEvent } from "@/lib/auth";

export function AuthWatcher() {
    const { logout, checkSession, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // 1. Escuchar evento "unauthorized" (401 global)
        const unsubscribe = onAuthEvent(async (event) => {
            if (event === "unauthorized") {
                console.warn("[AuthWatcher] 401 detectado. Cerrando sesión...");
                await logout();
                router.push("/");
            }
        });

        return () => {
            unsubscribe();
        };
    }, [logout, router]);

    useEffect(() => {
        if (!isAuthenticated) return;

        // 2. Polling periódico (cada 5 min)
        const intervalId = setInterval(async () => {
            const valid = await checkSession();
            if (!valid) {
                // El checkSession ya dispara 401 si falla con ese status,
                // pero si falla por red u otra cosa, no deslogueamos agresivamente
                // a menos que estemos seguros.
                // Aquí asumimos que checkSession maneja la emisión si es 401 via apiFetch.
            }
        }, 5 * 60 * 1000);

        // 3. Revisar al volver a la pestaña
        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                checkSession();
            }
        };

        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [isAuthenticated, checkSession]);

    return null; // Componente sin UI
}
