// src/lib/products.ts

export type Product = {
  id: string
  name: string
  description: string
  price: number
  category: string
  career: string
  stock: number
  image: string
  createdAt: string | Date
  updatedAt?: string | Date
}

export type ProductFormState = {
  name: string
  description: string
  price: string
  category: string
  career: string
  stock: string
  image: string           // sólo preview
  imageFile: File | null  // archivo real
}

// ===== Tipos de contrato backend =====
export type ProductList = {
  items: Product[]
  next_cursor?: string | null
}

export type ListParams = {
  q?: string
  category?: string
  career?: string
  limit?: number // 1..200 (default 50 en backend)
  cursor?: string // ISO datetime
}

export type ProductCreateJSON = {
  name: string
  description?: string
  price: number
  category: string
  career: string
  stock?: number
  image?: string // URL directa opcional
}

export type ProductUpdateJSON = Partial<ProductCreateJSON>

// ===== opts para inyectar headers (Authorization, etc.) =====
export type FetchOpts = { headers?: HeadersInit }

// ===== helpers =====
function asProduct(p: any): Product {
  return { ...p, createdAt: p?.createdAt ?? new Date().toISOString() }
}

function asList(r: ProductList): ProductList {
  return { items: (r.items || []).map(asProduct), next_cursor: r.next_cursor ?? null }
}

function buildQuery(params?: Record<string, any>) {
  const q = new URLSearchParams()
  if (!params) return ""
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return
    q.set(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ""
}

// --- parser robusto: detecta HTML por rewrites rotos ---
async function parseJsonRobust<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${body}`)
  }
  if (res.status === 204) return undefined as unknown as T
  const ct = res.headers.get("content-type") || ""
  const text = await res.text()
  if (text && !ct.includes("application/json")) {
    throw new Error(`Non-JSON response: ${text.slice(0, 250)}`)
  }
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T)
}

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { credentials: "include", ...init })
  return parseJsonRobust<T>(res)
}

// ===== Listados =====
// Pública: GET /api/products/public
export async function listPublicProducts(params?: ListParams): Promise<ProductList> {
  const qp = buildQuery(params)
  const data = await http<ProductList>(`/api/products/public${qp}`, { method: "GET" })
  return asList(data)
}

// Autenticada: GET /api/products  (pasa headers aquí)
export async function listProducts(params?: ListParams, opts: FetchOpts = {}): Promise<ProductList> {
  const qp = buildQuery(params)
  try {
    const res = await fetch(`/api/products${qp}`, {
      method: "GET",
      credentials: "include",
      headers: opts.headers, // <-- Authorization aquí
    })
    const data = await parseJsonRobust<ProductList>(res)
    return asList(data)
  } catch (err: any) {
    const msg = String(err?.message || "")
    if (msg.startsWith("HTTP 401") || msg.includes("Non-JSON response")) {
      // ➜ caer al listado público
      const pub = await listPublicProducts(params)
      return pub
    }
    throw err
  }
}

// Helper por si quieres traer TODO paginando (cuidado con tamaño):
export async function listAllPublicProducts(params?: Omit<ListParams, "cursor">): Promise<Product[]> {
  let cursor: string | undefined = undefined
  const acc: Product[] = []
  do {
    const page = await listPublicProducts({ ...params, cursor })
    acc.push(...page.items)
    cursor = page.next_cursor ?? undefined
  } while (cursor)
  return acc
}

// ===== Detalle =====
// GET /api/products/{id}  (público)
export async function getProduct(id: string): Promise<Product> {
  const data = await http<Product>(`/api/products/${id}`, { method: "GET" })
  return asProduct(data)
}

// ===== Crear =====
// POST JSON /api/products (privado)
export async function createProductJSON(payload: ProductCreateJSON, opts: FetchOpts = {}): Promise<Product> {
  // mezclamos headers del caller con content-type
  const headers = new Headers(opts.headers || {})
  headers.set("content-type", "application/json")

  const res = await fetch(`/api/products`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  })
  const data = await parseJsonRobust<Product>(res)
  return asProduct(data)
}

// POST FORM /api/products/form (privado; con archivo o image_url)
export async function createProductForm(input: {
  name: string
  price: number
  category: string
  career: string
  stock?: number
  description?: string
  image_url?: string | null
  imageFile?: File | null
  convert_webp?: boolean
}, opts: FetchOpts = {}): Promise<Product> {
  const fd = new FormData()
  fd.append("name", input.name)
  fd.append("price", String(input.price))
  fd.append("category", input.category)
  fd.append("career", input.career)
  if (input.stock !== undefined) fd.append("stock", String(input.stock))
  if (input.description !== undefined) fd.append("description", input.description ?? "")
  if (input.image_url !== undefined && input.image_url !== null) fd.append("image_url", input.image_url)
  fd.append("convert_webp", String(input.convert_webp ?? true))
  if (input.imageFile) fd.append("image_file", input.imageFile)

  const res = await fetch(`/api/products/form`, {
    method: "POST",
    credentials: "include",
    headers: opts.headers, // <-- Authorization aquí (NO pongas content-type con FormData)
    body: fd,
  })
  const data = await parseJsonRobust<Product>(res)
  return asProduct(data)
}

// ===== Actualizar =====
// PUT JSON /api/products/{id} (privado)
export async function updateProductJSON(id: string, payload: ProductUpdateJSON, opts: FetchOpts = {}): Promise<Product> {
  const headers = new Headers(opts.headers || {})
  headers.set("content-type", "application/json")

  const res = await fetch(`/api/products/${id}`, {
    method: "PUT",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  })
  const data = await parseJsonRobust<Product>(res)
  return asProduct(data)
}

// PUT FORM /api/products/{id}/form (privado)
export async function updateProductForm(
  id: string,
  input: {
    name?: string
    price?: number
    category?: string
    career?: string
    stock?: number
    description?: string
    image_url?: string | null // si mandas null/undefined no se cambia; si string se setea
    imageFile?: File | null
    convert_webp?: boolean
  },
  opts: FetchOpts = {}
): Promise<Product> {
  const fd = new FormData()
  if (input.name !== undefined) fd.append("name", input.name)
  if (input.price !== undefined) fd.append("price", String(input.price))
  if (input.category !== undefined) fd.append("category", input.category)
  if (input.career !== undefined) fd.append("career", input.career)
  if (input.stock !== undefined) fd.append("stock", String(input.stock))
  if (input.description !== undefined) fd.append("description", input.description ?? "")
  if (input.image_url !== undefined) fd.append("image_url", input.image_url ?? "")
  fd.append("convert_webp", String(input.convert_webp ?? true))
  if (input.imageFile) fd.append("image_file", input.imageFile)

  const res = await fetch(`/api/products/${id}/form`, {
    method: "PUT",
    credentials: "include",
    headers: opts.headers, // <-- Authorization aquí
    body: fd,
  })
  const data = await parseJsonRobust<Product>(res)
  return asProduct(data)
}

// ===== Eliminar =====
// DELETE /api/products/{id} (privado)
export async function deleteProduct(id: string, opts: FetchOpts = {}): Promise<void> {
  const res = await fetch(`/api/products/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: opts.headers, // <-- Authorization aquí
  })
  await parseJsonRobust<void>(res)
}

// Export de conveniencia
export const productsApi = {
  // listados
  listPublicProducts,
  listProducts,
  listAllPublicProducts,
  // detalle
  getProduct,
  // crear
  createProductJSON,
  createProductForm,
  // actualizar
  updateProductJSON,
  updateProductForm,
  // eliminar
  deleteProduct,
}
