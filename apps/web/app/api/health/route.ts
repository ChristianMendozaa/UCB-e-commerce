import { NextResponse } from "next/server"
import {
  getUpstreamBaseUrl,
  UPSTREAM_ENV,
  type UpstreamName,
} from "@/lib/server/upstreams"

export const dynamic = "force-dynamic"

export function GET() {
  const configured = Object.fromEntries(
    (Object.keys(UPSTREAM_ENV) as UpstreamName[]).map((name) => [
      name,
      Boolean(getUpstreamBaseUrl(name)),
    ]),
  )
  const ok = Object.values(configured).every(Boolean)

  return NextResponse.json(
    { ok, service: "web", upstreams: configured },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  )
}

export function HEAD() {
  const ok = (Object.keys(UPSTREAM_ENV) as UpstreamName[]).every((name) =>
    Boolean(getUpstreamBaseUrl(name)),
  )

  return new NextResponse(null, {
    status: ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  })
}
