// lib/orders.ts
"use client";

export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered";

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number; // lo manda el backend en las respuestas
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;  // ISO string
  updatedAt: string;  // ISO string
}

type CreateOrderItemIn = { productId: string; quantity: number };
type CreateOrderIn = { items: CreateOrderItemIn[] };

type ListParams = {
  status?: OrderStatus;
  limit?: number;
};

/** Copia local de apiFetch (igual a la de auth.ts) para usar rewrites y cookie __session */
async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
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
    } catch {}
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function qs(params?: Record<string, any>) {
  if (!params) return "";
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return "";
  const s = new URLSearchParams(entries as any).toString();
  return `?${s}`;
}

class OrdersApi {
  /** Cliente: lista mis pedidos */
  async listMyOrders(params?: ListParams): Promise<Order[]> {
    const query = qs({ status_filter: params?.status, limit: params?.limit ?? 50 });
    return apiFetch<Order[]>(`/orders/me${query}`, { method: "GET" });
  }

  /** Cliente: crear pedido */
  async createOrder(body: CreateOrderIn): Promise<Order> {
    return apiFetch<Order>("/orders", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /** Admin: listar pedidos (respeta visibilidad por carreras / roles) */
  async listAdminOrders(params?: ListParams): Promise<Order[]> {
    const query = qs({ status_filter: params?.status, limit: params?.limit ?? 100 });
    return apiFetch<Order[]>(`/orders${query}`, { method: "GET" });
  }

  /** Admin/owner: obtener un pedido por id (chequea permisos) */
  async getOrder(orderId: string): Promise<Order> {
    return apiFetch<Order>(`/orders/${orderId}`, { method: "GET" });
  }

  /** Admin: actualizar estado */
  async updateStatus(orderId: string, status: OrderStatus): Promise<Order> {
    return apiFetch<Order>(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }
}

export const ordersApi = new OrdersApi();
