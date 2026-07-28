import type { NextRequest } from "next/server"

export class RequestBodyTooLarge extends Error {}

export async function readRequestBodyLimited(
  request: NextRequest,
  maxBytes: number,
): Promise<ArrayBuffer> {
  const declaredLength = Number(request.headers.get("content-length"))
  if (
    Number.isFinite(declaredLength)
    && declaredLength > maxBytes
  ) {
    throw new RequestBodyTooLarge()
  }
  if (!request.body) return new ArrayBuffer(0)

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new RequestBodyTooLarge()
    }
    chunks.push(value)
  }
  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output.buffer
}
