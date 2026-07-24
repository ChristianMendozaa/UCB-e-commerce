from typing import Dict, List
from google.cloud import firestore
from app.core.firebase import firestore_db
from app.services.careers_service import ensure_career
ROLES_COLL = "roles"

def ensure_default_student(uid: str) -> Dict:
    """
    Garantiza que el usuario tenga un doc en `roles` con al menos el rol 'student'.
    Si el doc no existe, lo crea. Si existe pero no contiene 'student', lo agrega.
    """
    ref = firestore_db.collection(ROLES_COLL).document(uid)
    snap = ref.get()

    if not snap.exists:
        data = {
            "uid": uid,
            "roles": ["student"],
            "admin_careers": [],
            "platform_admin": False,  # opcional para superadmin
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        ref.set(data)
        return data

    data = snap.to_dict() or {}
    roles: List[str] = list(set((data.get("roles") or []) + ["student"]))
    update = {
        "roles": roles,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    ref.set(update, merge=True)
    data.update(update)
    return data

def get_roles(uid: str) -> Dict:
    snap = firestore_db.collection(ROLES_COLL).document(uid).get()
    return snap.to_dict() if snap.exists else {"uid": uid, "roles": ["student"], "admin_careers": []}

def is_platform_admin(uid: str) -> bool:
    doc = get_roles(uid)
    return bool(doc.get("platform_admin"))

def can_manage_career(uid: str, career: str) -> bool:
    """
    Un platform_admin puede todo. Un admin solo puede asignar/quitar dentro de sus propias carreras.
    """
    if is_platform_admin(uid):
        return True
    doc = get_roles(uid)
    roles = doc.get("roles") or []
    if "admin" not in roles:
        return False
    admin_careers = set(doc.get("admin_careers") or [])
    return career in admin_careers

def add_admin_for_career(target_uid: str, career: str) -> Dict:
    """
    Agrega rol 'admin' y la carrera en admin_careers del usuario objetivo.
    Idempotente. Asegura que la carrera exista en la colección careers.
    """
    # ⬅️ asegura que la carrera exista (no falla si ya existe)
    try:
        ensure_career(career)
    except Exception:
        # si quieres, ignora errores silenciosamente o propaga
        pass

    ref = firestore_db.collection(ROLES_COLL).document(target_uid)
    snap = ref.get()
    data = snap.to_dict() if snap.exists else {"uid": target_uid, "roles": ["student"], "admin_careers": []}
    roles: List[str] = list(set((data.get("roles") or []) + ["admin", "student"]))
    admin_careers = set(data.get("admin_careers") or [])
    admin_careers.add(career)

    update = {
        "uid": target_uid,
        "roles": sorted(roles),
        "admin_careers": sorted(admin_careers),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    ref.set(update, merge=True)
    data.update(update)
    return data

def remove_admin_for_career(target_uid: str, career: str) -> Dict:
    """
    Quita la carrera de `admin_careers` del usuario objetivo. Si después de quitarla
    ya no quedan carreras administradas, se remueve el rol 'admin'.
    Siempre garantiza que 'student' esté presente.
    Idempotente: si la carrera no estaba, no falla.
    """
    ref = firestore_db.collection(ROLES_COLL).document(target_uid)
    snap = ref.get()

    if not snap.exists:
        # Si no tenía doc de roles, garantizamos estado mínimo (student)
        data = {
            "uid": target_uid,
            "roles": ["student"],
            "admin_careers": [],
            "platform_admin": False,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        ref.set(data, merge=True)
        return data

    data = snap.to_dict() or {}
    roles: List[str] = list(data.get("roles") or [])
    admin_careers = set(data.get("admin_careers") or [])
    platform_admin = bool(data.get("platform_admin"))

    # Quitar la carrera (si existe)
    if career in admin_careers:
        admin_careers.remove(career)

    # Si ya no administra ninguna carrera, quitar 'admin'
    if not admin_careers and "admin" in roles:
        roles = [r for r in roles if r != "admin"]

    # Asegurar 'student'
    if "student" not in roles:
        roles.append("student")

    update = {
        "uid": target_uid,
        "roles": sorted(set(roles)),
        "admin_careers": sorted(admin_careers),
        "platform_admin": platform_admin,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    ref.set(update, merge=True)
    data.update(update)
    return data

# (Opcional) para revocar admin en todas las carreras de un tirón
def remove_admin_all_careers(target_uid: str) -> Dict:
    """
    Limpia todas las carreras administradas y quita el rol 'admin'.
    Mantiene 'student'. No toca 'platform_admin'.
    """
    ref = firestore_db.collection(ROLES_COLL).document(target_uid)
    snap = ref.get()
    if not snap.exists:
        data = {
            "uid": target_uid,
            "roles": ["student"],
            "admin_careers": [],
            "platform_admin": False,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        ref.set(data, merge=True)
        return data

    data = snap.to_dict() or {}
    roles = [r for r in (data.get("roles") or []) if r != "admin"]
    if "student" not in roles:
        roles.append("student")

    update = {
        "uid": target_uid,
        "roles": sorted(set(roles)),
        "admin_careers": [],
        "platform_admin": bool(data.get("platform_admin")),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    ref.set(update, merge=True)
    data.update(update)
    return data

def make_platform_admin(target_uid: str) -> Dict:
    """
    Convierte al usuario en Platform Admin.
    """
    ref = firestore_db.collection(ROLES_COLL).document(target_uid)
    snap = ref.get()
    
    if not snap.exists:
        data = {
            "uid": target_uid,
            "roles": ["student"],
            "admin_careers": [],
            "platform_admin": True,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        ref.set(data)
        return data

    data = snap.to_dict() or {}
    # Aseguramos student por si acaso
    roles = list(set((data.get("roles") or []) + ["student"]))
    
    update = {
        "platform_admin": True,
        "roles": roles,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    ref.set(update, merge=True)
    data.update(update)
    return data

def remove_platform_admin(target_uid: str) -> Dict:
    """
    Quita el privilegio de Platform Admin.
    Si el usuario no tiene carreras administradas, se le quita el rol 'admin'
    para asegurar que vuelva a ser 'student'.
    """
    ref = firestore_db.collection(ROLES_COLL).document(target_uid)
    snap = ref.get()
    
    if not snap.exists:
        return ensure_default_student(target_uid)

    data = snap.to_dict() or {}
    roles = list(data.get("roles") or [])
    admin_careers = list(data.get("admin_careers") or [])

    # Si no tiene carreras administradas, quitar 'admin'
    if not admin_careers and "admin" in roles:
        roles = [r for r in roles if r != "admin"]
    
    # Asegurar 'student'
    if "student" not in roles:
        roles.append("student")

    update = {
        "platform_admin": False,
        "roles": sorted(set(roles)),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    ref.set(update, merge=True)
    data.update(update)
    return data
