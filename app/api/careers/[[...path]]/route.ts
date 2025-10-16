import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTH = process.env.NEXT_PUBLIC_AUTH_API_URL!;
if (!AUTH) throw new Error("Falta NEXT_PUBLIC_AUTH_API_URL");

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
  const target = new URL(`${AUTH}/careers${suffix}`);
  target.search = req.nextUrl.search;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.set("cache-control", "no-store");

  const body = ["GET","HEAD"].includes(req.method) ? undefined : await req.arrayBuffer();

  const upstream = await fetch(target.toString(), {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });

  const res = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });

  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) {
    res.headers.delete("set-cookie");
    setCookie.split(/,(?=\s*\w+=)/g).forEach(c => res.headers.append("set-cookie", c));
  }

  res.headers.set("cache-control", "no-store");
  return res;
}
