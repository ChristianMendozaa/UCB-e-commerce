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

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { credentials: "include", ...init })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${body}`)
  }
  // puede venir 204 (sin body)
  if (res.status === 204) return undefined as unknown as T
  return (await res.json()) as T
}

// ===== Listados =====
// Pública: GET /api/products/public
export async function listPublicProducts(params?: ListParams): Promise<ProductList> {
  const qp = buildQuery(params)
  const data = await http<ProductList>(`/api/products/public${qp}`, { method: "GET" })
  return asList(data)
}

// Autenticada: GET /api/products
export async function listProducts(params?: ListParams): Promise<ProductList> {
  const qp = buildQuery(params)
  const data = await http<ProductList>(`/api/products${qp}`, { method: "GET", credentials: "include" })
  return asList(data)
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
// GET /api/products/{id}
export async function getProduct(id: string): Promise<Product> {
  const data = await http<Product>(`/api/products/${id}`, { method: "GET" })
  return asProduct(data)
}

// ===== Crear =====
// POST JSON /api/products
export async function createProductJSON(payload: ProductCreateJSON): Promise<Product> {
  const data = await http<Product>(`/api/products`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  return asProduct(data)
}

// POST FORM /api/products/form (con archivo o image_url)
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
}): Promise<Product> {
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

  const res = await fetch(`/api/products/form`, { method: "POST", credentials: "include", body: fd })
  if (!res.ok) throw new Error(await res.text())
  return asProduct(await res.json())
}

// ===== Actualizar =====
// PUT JSON /api/products/{id}
export async function updateProductJSON(id: string, payload: ProductUpdateJSON): Promise<Product> {
  const data = await http<Product>(`/api/products/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  return asProduct(data)
}

// PUT FORM /api/products/{id}/form
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

  const res = await fetch(`/api/products/${id}/form`, { method: "PUT", credentials: "include", body: fd })
  if (!res.ok) throw new Error(await res.text())
  return asProduct(await res.json())
}

// ===== Eliminar =====
// DELETE /api/products/{id}
export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, { method: "DELETE", credentials: "include" })
  if (!res.ok) throw new Error(await res.text())
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
