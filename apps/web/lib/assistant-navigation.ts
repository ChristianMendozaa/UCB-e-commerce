const STATIC_PATHS = new Set([
  "/",
  "/catalog",
  "/careers",
  "/cart",
  "/login",
  "/orders",
])

function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
}

function safeSegment(value: string, maxBytes: number, firestoreId = false) {
  if (
    !value
    || value !== value.trim()
    || value === "."
    || value === ".."
    || value.includes("/")
    || value.includes("\\")
    || hasControlCharacters(value)
  ) {
    return false
  }
  if (firestoreId && /^__.*__$/.test(value)) return false
  return new TextEncoder().encode(value).byteLength <= maxBytes
}

export function safeAssistantNavigationPath(value: unknown): string | null {
  if (
    typeof value !== "string"
    || !value.startsWith("/")
    || value.startsWith("//")
    || value !== value.trim()
    || value.includes("\\")
    || hasControlCharacters(value)
  ) {
    return null
  }
  let parsed: URL
  try {
    parsed = new URL(value, window.location.origin)
  } catch {
    return null
  }
  if (
    parsed.origin !== window.location.origin
    || parsed.search
    || parsed.hash
    || parsed.pathname !== value
  ) {
    return null
  }
  if (STATIC_PATHS.has(value)) return value
  for (const [prefix, maxBytes, firestoreId] of [
    ["/products/", 1_500, true],
    ["/careers/", 200, false],
  ] as const) {
    if (!value.startsWith(prefix)) continue
    const encoded = value.slice(prefix.length)
    if (!encoded || encoded.includes("/")) return null
    try {
      const decoded = decodeURIComponent(encoded)
      return safeSegment(decoded, maxBytes, firestoreId)
        ? `${prefix}${encodeURIComponent(decoded)}`
        : null
    } catch {
      return null
    }
  }
  return null
}
