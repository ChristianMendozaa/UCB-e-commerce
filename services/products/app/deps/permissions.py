# app/deps/permissions.py
from fastapi import HTTPException, status
from typing import List, Tuple

from app.core.firebase import firestore_db

def _read_roles_doc(uid: str) -> Tuple[List[str], bool, List[str]]:
    """
    Devuelve (roles, platform_admin, admin_careers) desde la colección 'roles'.
    Estructura esperada del doc:
      {
        roles: ["admin","student"],
        platform_admin: true/false,
        admin_careers: ["SIS","ADM", ...]
      }
    """
    doc = firestore_db.collection("roles").document(uid).get()
    if not doc.exists:
        return [], False, []
    data = doc.to_dict() or {}
    roles = list(data.get("roles") or [])
    platform_admin = bool(data.get("platform_admin") or False)
    admin_careers = list(data.get("admin_careers") or [])
    return roles, platform_admin, admin_careers

def can_manage_career_or_403(uid: str, career: str):
    roles, is_platform_admin, admin_careers = _read_roles_doc(uid)
    if is_platform_admin:
        return
    # permitimos si tiene rol admin y la carrera en su lista
    if "admin" in roles and career in admin_careers:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"No tienes permisos para gestionar productos de la carrera '{career}'.",
    )

def visible_careers_for(uid: str) -> List[str]:
    roles, is_platform_admin, admin_careers = _read_roles_doc(uid)
    if is_platform_admin:
        # plataforma: puede ver todas; devolvemos [] para indicar "no limitar".
        return []
    if "admin" in roles:
        # admins ven (y gestionan) sus carreras
        return admin_careers
    # estudiantes u otros: no gestionan, pero pueden ver sus carreras si las tuvieran;
    # aquí devolvemos [] para NO limitar (listado público autenticado).
    return []
