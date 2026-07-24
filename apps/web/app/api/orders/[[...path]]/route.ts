// app/api/orders/[[...path]]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDERS = process.env.NEXT_PUBLIC_ORDERS_API_URL!;
if (!ORDERS) {
    throw new Error("Falta la env NEXT_PUBLIC_ORDERS_API_URL");
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;

async function handler(req: NextRequest, ctx: { params: { path?: string[] } }) {
    const segments = ctx.params?.path ?? [];
    const suffix = segments.length ? `/${segments.join("/")}` : "";

    // Tu backend de pedidos expone /orders/*
    const target = new URL(`${ORDERS}/orders${suffix}`);
    target.search = req.nextUrl.search;

    const headers = new Headers(req.headers);
    headers.delete("host");
    headers.set("cache-control", "no-store");

    const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer();

    const upstream = await fetch(target.toString(), {
        method: req.method,
        headers,
        body,
        redirect: "manual",
    });

    // ---- prepara respuesta → browser
    const resHeaders = new Headers(upstream.headers);
    // elimina headers que causan decodificación doble o inconsistencias
    resHeaders.delete("content-encoding");
    resHeaders.delete("content-length");
    resHeaders.delete("transfer-encoding");
    resHeaders.delete("connection");

    const res = new NextResponse(upstream.body, {
        status: upstream.status,
        headers: resHeaders,
    });

    // Propaga múltiples Set-Cookie si vinieran
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) {
        res.headers.delete("set-cookie");
        setCookie.split(/,(?=\s*\w+=)/g).forEach((c) => res.headers.append("set-cookie", c));
    }

    res.headers.set("cache-control", "no-store");
    return res;
}