export const MAX_ORIGINAL_IMAGE_BYTES = 4 * 1024 * 1024
// Mantiene el request por debajo de 4.5 MB y deja ~255 KB decimales
// para boundaries multipart y el resto de los campos del producto.
export const MAX_PRODUCT_MULTIPART_BYTES = 4_450_000
export const MAX_MULTIPART_OVERHEAD_BYTES =
  MAX_PRODUCT_MULTIPART_BYTES - MAX_ORIGINAL_IMAGE_BYTES
export const ORIGINAL_IMAGE_SIZE_HEADER = "x-original-image-size"

export function assertOriginalImageSize(file?: File | null): void {
  if (file && file.size > MAX_ORIGINAL_IMAGE_BYTES) {
    throw new Error("La imagen original no puede superar 4 MiB.")
  }
}
