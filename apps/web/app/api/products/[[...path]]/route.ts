// app/api/products/[[...path]]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUpstreamBaseUrl } from "@/lib/server/upstreams";
import { encodedPathSuffix } from "@/lib/server/proxy-path";
import {
  MAX_ORIGINAL_IMAGE_BYTES,
  MAX_PRODUCT_MULTIPART_BYTES,
  ORIGINAL_IMAGE_SIZE_HEADER,
} from "@/lib/upload-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
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

  // The public catalog listing doesn't vary by identity (no auth dependency
  // on the products-side handler) and never sets a cookie, so — unlike
  // every other route this proxy handles — it's safe to let the CDN and the
  // browser cache it briefly. Everything else stays no-store.
  const isPublicListGet =
    req.method === "GET" && segments.length === 1 && segments[0] === "public";

  // tu backend expone /api/products/*
  const target = new URL(`${productsBaseUrl}/api/products${suffix}`);
  target.search = req.nextUrl.search;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.set("cache-control", "no-store");

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const isMultipart = req.headers
    .get("content-type")
    ?.toLowerCase()
    .startsWith("multipart/form-data") ?? false;

  if (hasBody && isMultipart) {
    const declaredImageSize = parseByteHeader(
      req.headers.get(ORIGINAL_IMAGE_SIZE_HEADER),
    );
    if (declaredImageSize === "invalid") {
      return NextResponse.json(
        { error: "Tamaño de imagen declarado inválido." },
        { status: 400 },
      );
    }
    if (
      typeof declaredImageSize === "number" &&
      declaredImageSize > MAX_ORIGINAL_IMAGE_BYTES
    ) {
      return imageTooLargeResponse();
    }

    const contentLength = parseByteHeader(req.headers.get("content-length"));
    if (contentLength === "invalid") {
      return NextResponse.json(
        { error: "Content-Length inválido." },
        { status: 400 },
      );
    }
    if (
      typeof contentLength === "number" &&
      contentLength > MAX_PRODUCT_MULTIPART_BYTES
    ) {
      return imageTooLargeResponse();
    }
  }

  let body: ArrayBuffer | Uint8Array | undefined;
  if (hasBody && isMultipart) {
    const limitedBody = await readBodyWithinLimit(
      req,
      MAX_PRODUCT_MULTIPART_BYTES,
    );
    if (!limitedBody.ok) return imageTooLargeResponse();
    body = limitedBody.body;
  } else if (hasBody) {
    body = await req.arrayBuffer();
  }

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

  if (
    isPublicListGet &&
    upstream.status === 200 &&
    !upstream.headers.get("set-cookie")
  ) {
    const cacheControl = "public, max-age=60, stale-while-revalidate=300";
    res.headers.set("cache-control", cacheControl);
    res.headers.set("cdn-cache-control", cacheControl);
    res.headers.set("vercel-cdn-cache-control", cacheControl);
  } else {
    res.headers.set("cache-control", "no-store");
  }
  return res;
}

function parseByteHeader(value: string | null): number | null | "invalid" {
  if (value === null) return null;
  if (!/^\d+$/.test(value)) return "invalid";
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : "invalid";
}

function imageTooLargeResponse() {
  return NextResponse.json(
    { error: "La imagen original no puede superar 4 MiB." },
    { status: 413 },
  );
}

async function readBodyWithinLimit(
  req: NextRequest,
  maxBytes: number,
): Promise<{ ok: true; body: Uint8Array } | { ok: false }> {
  if (!req.body) return { ok: true, body: new Uint8Array() };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, body };
}
