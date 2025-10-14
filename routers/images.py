# routers/images.py
import os
import logging
import base64
from io import BytesIO

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse

from firebase_client import db
from config import MAX_B64_BYTES, FIREBASE_COLLECTION
from utils.utils import calc_b64_size, convert_to_webp, encode_b64

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


@router.post("/upload-image/", summary="Crear (upload) una nueva imagen")
async def upload_image(
    file: UploadFile = File(...),
    convert_webp: bool = True
):
    try:
        raw = await file.read()
        size_orig = calc_b64_size(raw)

        # Si original > límite, intentamos WebP
        if size_orig > MAX_B64_BYTES:
            if not convert_webp:
                raise HTTPException(400, "Imagen demasiado grande en Base64")
            raw = convert_to_webp(raw)
            size_webp = calc_b64_size(raw)
            if size_webp > MAX_B64_BYTES:
                raise HTTPException(400, "Imagen WebP sigue >1 MiB en Base64")
            content_type = "image/webp"
            filename = os.path.splitext(file.filename)[0] + ".webp"
        else:
            content_type = file.content_type
            filename = file.filename

        b64_str = encode_b64(raw)
        doc = {
            "filename": filename,
            "contentType": content_type,
            "b64": b64_str,
        }
        ref = db.collection(FIREBASE_COLLECTION).document()
        ref.set(doc)

        return {"id": ref.id, "filename": filename, "size_b64": len(b64_str)}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error en upload_image")
        raise HTTPException(500, detail=str(e))


@router.get("/", summary="Listar todas las imágenes (metadatos)")
async def list_images():
    """Devuelve id, filename, contentType y size_b64 de cada imagen."""
    try:
        images = []
        for doc in db.collection(FIREBASE_COLLECTION).stream():
            data = doc.to_dict() or {}
            b64 = data.get("b64", "")
            images.append({
                "id": doc.id,
                "filename": data.get("filename"),
                "contentType": data.get("contentType"),
                "size_b64": len(b64),
            })
        return images

    except Exception as e:
        logger.exception("Error en list_images")
        raise HTTPException(500, detail="No se pudo listar las imágenes")


@router.get("/{image_id}", summary="Descargar imagen (raw con extensión)")
async def get_image(image_id: str):
    """
    Devuelve la imagen en el formato en que fue guardada,
    con el Content-Type y un filename adecuado para descarga.
    """
    try:
        doc_snap = db.collection(FIREBASE_COLLECTION).document(image_id).get()
        if not doc_snap.exists:
            raise HTTPException(404, "Imagen no encontrada")

        data = doc_snap.to_dict() or {}
        b64 = data.get("b64")
        content_type = data.get("contentType")
        filename = data.get("filename")

        if not b64 or not content_type or not filename:
            raise HTTPException(404, "Datos de imagen incompletos")

        raw = base64.b64decode(b64)
        headers = {
            "Content-Disposition": f'inline; filename="{filename}"'
        }
        return StreamingResponse(
            BytesIO(raw),
            media_type=content_type,
            headers=headers
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error en get_image")
        raise HTTPException(500, detail="No se pudo recuperar la imagen")

@router.put("/{image_id}", summary="Actualizar imagen existente")
async def update_image(
    image_id: str,
    file: UploadFile = File(...),
    convert_webp: bool = True
):
    """
    Reemplaza la imagen almacenada en el documento indicado.
    Aplica la misma lógica de tamaño y conversión que upload_image.
    """
    try:
        # Verifico que exista
        ref = db.collection(FIREBASE_COLLECTION).document(image_id)
        if not ref.get().exists:
            raise HTTPException(404, "Imagen no encontrada")

        raw = await file.read()
        size_orig = calc_b64_size(raw)

        if size_orig > MAX_B64_BYTES:
            if not convert_webp:
                raise HTTPException(400, "Imagen demasiado grande en Base64")
            raw = convert_to_webp(raw)
            size_webp = calc_b64_size(raw)
            if size_webp > MAX_B64_BYTES:
                raise HTTPException(400, "Imagen WebP sigue >1 MiB en Base64")
            content_type = "image/webp"
            filename = os.path.splitext(file.filename)[0] + ".webp"
        else:
            content_type = file.content_type
            filename = file.filename

        b64_str = encode_b64(raw)
        update_data = {
            "filename": filename,
            "contentType": content_type,
            "b64": b64_str,
        }
        ref.update(update_data)
        return {"id": image_id, "filename": filename, "size_b64": len(b64_str)}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error en update_image")
        raise HTTPException(500, detail=str(e))


@router.delete("/{image_id}", summary="Eliminar imagen por ID")
async def delete_image(image_id: str):
    """
    Borra el documento de Firestore con el ID dado.
    """
    try:
        ref = db.collection(FIREBASE_COLLECTION).document(image_id)
        if not ref.get().exists:
            raise HTTPException(404, "Imagen no encontrada")
        ref.delete()
        return {"id": image_id, "deleted": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error en delete_image")
        raise HTTPException(500, detail="No se pudo eliminar la imagen")
