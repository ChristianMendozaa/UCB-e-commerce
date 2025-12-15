"use client";

import { useState, useEffect } from "react";
import { ordersApi } from "@/lib/orders";
import { useAuth } from "@/lib/auth";

export function useAdminStats() {
    const { user } = useAuth();
    const [pendingCount, setPendingCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);

    // Check valid admin
    const isAdmin = user?.platform_admin || user?.role === "admin" || (user?.roles?.includes("admin"));

    useEffect(() => {
        if (!isAdmin) {
            setPendingCount(0);
            return;
        }

        let mounted = true;

        const fetchStats = async () => {
            try {
                const res = await ordersApi.getPendingCount();
                if (mounted) setPendingCount(res.count);
            } catch (error) {
                console.warn("Failed to fetch pending orders count", error);
            }
        };

        // Initial fetch
        setIsLoading(true);
        fetchStats().finally(() => mounted && setIsLoading(false));

        // Poll every 30 seconds
        const interval = setInterval(fetchStats, 30_000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [isAdmin, user?.id]); // Re-run if user changes

    return { pendingCount, isAdmin, isLoading };
}
