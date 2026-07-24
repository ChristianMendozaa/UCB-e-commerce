from typing import List, Dict
from app.schemas.roles import MakeAdminBody, RemoveAdminBody, MakePlatformAdminBody, RemovePlatformAdminBody
from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth as fb_auth

from app.deps.auth import get_current_user
from app.schemas.user import MeResponse, UpdateProfile
from app.services.users_service import upsert_profile, get_profile, delete_profile
from app.services.roles_service import get_roles, add_admin_for_career, can_manage_career, is_platform_admin, remove_admin_for_career, make_platform_admin, remove_platform_admin
from app.core.firebase import firestore_db

router = APIRouter(prefix="/users", tags=["users"])

# ====== HELPERS ======
def _primary_role(roles: List[str]) -> str:
    # Si es admin, mostrarlo como rol primario
    if "admin" in roles:
        return "admin"
    return "student"

# ====== ENDPOINTS ======

@router.get("/me", response_model=MeResponse)
def me(current=Depends(get_current_user)):
    uid = current["uid"]

    # Perfil legado (puede traer 'career' simple)
    prof = current.get("profile") or get_profile(uid) or {}

    # Doc de roles en colección 'roles'
    roles_doc = get_roles(uid) or {}
    roles = roles_doc.get("roles") or ["student"]
    admin_careers = roles_doc.get("admin_careers") or []
    platform_admin = bool(roles_doc.get("platform_admin"))

    # Rol primario
    role = _primary_role(roles)
    is_admin = ("admin" in roles)

    # careers (array): unimos admin_careers + career legado (si existe) y quitamos duplicados
    legacy_career = prof.get("career")
    careers_raw = list(admin_careers)  # copia
    if legacy_career:
        careers_raw.append(legacy_career)
    # deduplicar manteniendo orden
    seen = set()
    careers = [c for c in careers_raw if (c and not (c in seen or seen.add(c)))]

    return {
        "uid": uid,
        "email": current.get("email"),
        "displayName": current.get("displayName"),
        "photoURL": current.get("photoURL"),
        "profile": prof,

        "role": role,
        "is_admin": is_admin,
        "roles": roles,

        # NUEVOS/EXPUESTOS
        "careers": careers,                 # 👈 ahora llega como array
        "admin_careers": admin_careers,     # se mantiene
        "platform_admin": platform_admin,    # útil en el front
    }

@router.get("/me/profile")
def read_my_profile(current=Depends(get_current_user)):
    prof = get_profile(current["uid"])
    return {"ok": True, "profile": prof}

@router.post("/me/profile")
def update_my_profile(body: UpdateProfile, current=Depends(get_current_user)):
    data = {k: v for k, v in body.dict().items() if v is not None}
    if not data:
        return {"ok": True, "profile": current.get("profile")}
    profile = upsert_profile(current["uid"], data)
    return {"ok": True, "profile": profile}

@router.delete("/me")
def delete_my_account(current=Depends(get_current_user)):
    uid = current["uid"]
    try:
        fb_auth.delete_user(uid)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo borrar el usuario en Auth: {e}")
    try:
        delete_profile(uid)
        # Opcional: también podrías borrar su doc en `roles`
        # firestore_db.collection("roles").document(uid).delete()
    except Exception:
        pass
    return {"ok": True}

# ========= NUEVOS ENDPOINTS DE ROLES =========

@router.post("/roles/make_admin", status_code=status.HTTP_200_OK)
def make_admin(body: MakeAdminBody, current=Depends(get_current_user)):
    """
    Asigna rol 'admin' al usuario `body.uid` para la carrera `body.career`.
    Reglas:
      - platform_admin puede asignar cualquier carrera.
      - admin puede asignar SOLO carreras que él mismo administra.
    """
    requester_uid = current["uid"]
    if not (is_platform_admin(requester_uid) or can_manage_career(requester_uid, body.career)):
        raise HTTPException(status_code=403, detail="No tienes permisos para asignar admin en esta carrera.")

    updated = add_admin_for_career(body.uid, body.career)
    return {"ok": True, "roles": updated.get("roles"), "admin_careers": updated.get("admin_careers")}

@router.get("", status_code=status.HTTP_200_OK)
def list_users(current=Depends(get_current_user)):
    """
    Lista usuarios con perfil y roles. Requiere ser admin (de alguna carrera) o platform_admin.
    """
    requester_uid = current["uid"]
    roles_doc = get_roles(requester_uid)
    if not ("admin" in (roles_doc.get("roles") or []) or roles_doc.get("platform_admin")):
        raise HTTPException(status_code=403, detail="No autorizado")

    # Traer perfiles
    users_ref = firestore_db.collection("users")
    users_iter = users_ref.stream()
    users: Dict[str, Dict] = {}
    for doc in users_iter:
        data = doc.to_dict() or {}
        data["uid"] = doc.id
        users[doc.id] = data

    # Traer roles y hacer join por uid
    roles_ref = firestore_db.collection("roles")
    roles_iter = roles_ref.stream()
    roles_map: Dict[str, Dict] = {doc.id: (doc.to_dict() or {}) for doc in roles_iter}

    # Combinar
    results: List[Dict] = []
    for uid, prof in users.items():
        rdoc = roles_map.get(uid, {"roles": ["student"], "admin_careers": []})
        roles = rdoc.get("roles") or ["student"]
        results.append({
            "uid": uid,
            "email": prof.get("email"),
            "displayName": prof.get("displayName"),
            "photoURL": prof.get("photoURL"),
            "profile": prof,
            "roles": roles,
            "role": "admin" if "admin" in roles else "student",
            "admin_careers": rdoc.get("admin_careers") or [],
            "platform_admin": bool(rdoc.get("platform_admin")),
        })

    # (Opcional) Filtros por carrera que administra el solicitante (si no es platform_admin)
    if not roles_doc.get("platform_admin"):
        allowed = set(roles_doc.get("admin_careers") or [])
        # Un admin puede ver:
        #  - a otros admins que compartan al menos una carrera
        #  - a todos los students (si lo prefieres, puedes restringir más)
        filtered = []
        for u in results:
            if "admin" in u["roles"]:
                if allowed.intersection(set(u.get("admin_careers") or [])):
                    filtered.append(u)
            else:
                filtered.append(u)
        results = filtered

    return {"ok": True, "count": len(results), "users": results}

@router.post("/roles/remove_admin", status_code=status.HTTP_200_OK)
def remove_admin(body: RemoveAdminBody, current=Depends(get_current_user)):
    requester_uid = current["uid"]
    if not (is_platform_admin(requester_uid) or can_manage_career(requester_uid, body.career)):
        raise HTTPException(status_code=403, detail="No tienes permisos para quitar admin en esta carrera.")
    updated = remove_admin_for_career(body.uid, body.career)
    return {"ok": True, "roles": updated.get("roles"), "admin_careers": updated.get("admin_careers")}

@router.post("/roles/make_platform_admin", status_code=status.HTTP_200_OK)
def make_platform_admin_endpoint(body: MakePlatformAdminBody, current=Depends(get_current_user)):
    """
    Convierte a un usuario en Platform Admin.
    Requiere ser Platform Admin.
    """
    requester_uid = current["uid"]
    if not is_platform_admin(requester_uid):
        raise HTTPException(status_code=403, detail="Requiere ser Platform Admin.")
    
    updated = make_platform_admin(body.uid)
    return {"ok": True, "platform_admin": updated.get("platform_admin")}

@router.post("/roles/remove_platform_admin", status_code=status.HTTP_200_OK)
def remove_platform_admin_endpoint(body: RemovePlatformAdminBody, current=Depends(get_current_user)):
    """
    Quita el rol de Platform Admin.
    Requiere ser Platform Admin.
    """
    requester_uid = current["uid"]
    if not is_platform_admin(requester_uid):
        raise HTTPException(status_code=403, detail="Requiere ser Platform Admin.")
    
    updated = remove_platform_admin(body.uid)
    return {"ok": True, "platform_admin": updated.get("platform_admin")}
