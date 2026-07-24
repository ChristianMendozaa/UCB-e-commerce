from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.deps.auth import get_current_user
from app.services.careers_service import list_careers, ensure_career
from app.services.roles_service import is_platform_admin, get_roles

router = APIRouter(prefix="/careers", tags=["careers"])

class CareerBody(BaseModel):
    code: str
    name: Optional[str] = None

@router.get("/public", status_code=status.HTTP_200_OK, tags=["public"])
def public_careers_index():
    """
    Lista todas las carreras de forma pública (sin autenticación).
    """
    return {"ok": True, "careers": list_careers()}

@router.get("", status_code=status.HTTP_200_OK)
def careers_index(current=Depends(get_current_user)):
    """
    Lista carreras. Requiere ser admin (de alguna carrera) o platform_admin.
    """
    uid = current["uid"]
    roles_doc = get_roles(uid)
    if not ("admin" in (roles_doc.get("roles") or []) or roles_doc.get("platform_admin")):
        raise HTTPException(status_code=403, detail="No autorizado")
    return {"ok": True, "careers": list_careers()}

@router.post("", status_code=status.HTTP_201_CREATED)
def careers_create(body: CareerBody, current=Depends(get_current_user)):
    """
    Crea/actualiza una carrera. Requiere platform_admin.
    (Si quieres permitir a admins crear, cambia el chequeo)
    """
    uid = current["uid"]
    if not is_platform_admin(uid):
        raise HTTPException(status_code=403, detail="Solo platform_admin puede crear carreras.")
    try:
        saved = ensure_career(body.code, body.name)
        return {"ok": True, "career": saved}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
