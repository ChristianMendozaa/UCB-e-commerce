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
  image: string           // sólo para preview de la imagen subida
  imageFile: File | null  // <- archivo real
}

function asProduct(p: any): Product {
  return { ...p, createdAt: p?.createdAt ?? new Date().toISOString() }
}

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { credentials: "include", ...init })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${await res.text().catch(()=> "")}`)
  return (await res.json()) as T
}

export async function listProducts(): Promise<Product[]> {
  const data = await http<{ items: Product[] }>(`/api/products`, { method: "GET" })
  return (data.items || []).map(asProduct)
}

export async function createProduct(input: {
  name: string
  description: string
  price: number
  category: string
  career: string
  stock: number
  imageFile?: File | null
}): Promise<Product> {
  const fd = new FormData()
  fd.append("name", input.name)
  fd.append("description", input.description ?? "")
  fd.append("price", String(input.price))
  fd.append("category", input.category)
  fd.append("career", input.career)
  fd.append("stock", String(input.stock))
  fd.append("convert_webp", "true")
  if (input.imageFile) fd.append("image_file", input.imageFile)

  const res = await fetch(`/api/products/form`, { method: "POST", credentials: "include", body: fd })
  if (!res.ok) throw new Error(await res.text())
  return asProduct(await res.json())
}

export async function updateProduct(
  id: string,
  input: {
    name?: string
    description?: string
    price?: number
    category?: string
    career?: string
    stock?: number
    imageFile?: File | null
  },
): Promise<Product> {
  const fd = new FormData()
  if (input.name !== undefined) fd.append("name", input.name)
  if (input.description !== undefined) fd.append("description", input.description)
  if (input.price !== undefined) fd.append("price", String(input.price))
  if (input.category !== undefined) fd.append("category", input.category)
  if (input.career !== undefined) fd.append("career", input.career)
  if (input.stock !== undefined) fd.append("stock", String(input.stock))
  fd.append("convert_webp", "true")
  if (input.imageFile) fd.append("image_file", input.imageFile)

  const res = await fetch(`/api/products/${id}/form`, { method: "PUT", credentials: "include", body: fd })
  if (!res.ok) throw new Error(await res.text())
  return asProduct(await res.json())
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, { method: "DELETE", credentials: "include" })
  if (!res.ok) throw new Error(await res.text())
}

export const productsApi = { listProducts, createProduct, updateProduct, deleteProduct }
