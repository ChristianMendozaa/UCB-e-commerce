// app/api/cart/[[...path]]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUpstreamBaseUrl } from "@/lib/server/upstreams";
import { encodedPathSuffix } from "@/lib/server/proxy-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const OPTIONS = handler;

async function handler(req: NextRequest, ctx: { params: { path?: string[] } }) {
    const productsBaseUrl = getUpstreamBaseUrl("products");
    if (!productsBaseUrl) {
        return NextResponse.json(
            { error: "Servicio de productos no configurado." },
            { status: 503 },
        );
    }
    const segments = ctx.params?.path ?? [];
    const suffix = encodedPathSuffix(segments);
    if (suffix === null) {
        return NextResponse.json({ error: "Ruta inválida." }, { status: 400 });
    }

    // tu backend expone /api/cart/*
    const target = new URL(`${productsBaseUrl}/api/cart${suffix}`);
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

    const resHeaders = new Headers(upstream.headers);
    resHeaders.delete("content-encoding");
    resHeaders.delete("content-length");
    resHeaders.delete("transfer-encoding");
    resHeaders.delete("connection");

    const res = new NextResponse(upstream.body, {
        status: upstream.status,
        headers: resHeaders,
    });

    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) {
        res.headers.delete("set-cookie");
        setCookie.split(/,(?=\s*\w+=)/g).forEach((c) => res.headers.append("set-cookie", c));
    }

    res.headers.set("cache-control", "no-store");
    return res;
}
