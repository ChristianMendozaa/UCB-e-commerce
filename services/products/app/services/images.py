# app/services/images.py
import httpx
from fastapi import UploadFile
from app.config import IMAGE_SERVICE_BASE_URL

async def upload_image_and_get_url(
    file: UploadFile,
    convert_webp: bool = True,
) -> str:
    """
    Sube la imagen al servicio externo y devuelve la URL pública final.
    """
    upload_url = IMAGE_SERVICE_BASE_URL.rstrip("/") + "/images/upload-image/"
    async with httpx.AsyncClient(timeout=30) as client:
        # Importantísimo: leer el archivo antes de enviarlo
        content = await file.read()
        files = {
            "file": (file.filename or "upload", content, file.content_type or "application/octet-stream")
        }
        data = {"convert_webp": "true" if convert_webp else "false"}

        resp = await client.post(upload_url, files=files, data=data)
        resp.raise_for_status()
        payload = resp.json()
        img_id = payload.get("id")
        if not img_id:
            raise RuntimeError("El servicio de imágenes no devolvió 'id'.")

        # Construye la URL pública
        return IMAGE_SERVICE_BASE_URL.rstrip("/") + f"/images/{img_id}"
