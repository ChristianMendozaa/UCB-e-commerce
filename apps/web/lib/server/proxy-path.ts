function isUnsafePathSegment(value: string): boolean {
  let candidate = value

  for (let depth = 0; depth < 3; depth += 1) {
    if (
      !candidate
      || candidate === "."
      || candidate === ".."
      || candidate.includes("/")
      || candidate.includes("\\")
      || /[\u0000-\u001f\u007f]/.test(candidate)
    ) {
      return true
    }

    try {
      const decoded = decodeURIComponent(candidate)
      if (decoded === candidate) break
      candidate = decoded
    } catch {
      break
    }
  }

  return false
}

export function encodedPathSuffix(
  segments: string[] | undefined,
): string | null {
  if (!segments?.length) return ""
  if (segments.some(isUnsafePathSegment)) return null
  return `/${segments.map(encodeURIComponent).join("/")}`
}
