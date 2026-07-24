from typing import Dict, List, Optional
from google.cloud import firestore
from app.core.firebase import firestore_db

CAREERS_COLL = "careers"

def list_careers() -> List[Dict]:
    """
    Devuelve una lista de carreras. Cada doc:
      { code: "SIS", name: "Ingeniería de Sistemas", createdAt, updatedAt }
    """
    docs = firestore_db.collection(CAREERS_COLL).order_by("code").stream()
    out = []
    for d in docs:
        data = d.to_dict() or {}
        data["id"] = d.id
        out.append(data)
    return out

def ensure_career(code: str, name: Optional[str] = None) -> Dict:
    """
    Crea (o mergea) una carrera. Idempotente.
    """
    code = (code or "").strip().upper()
    if not code:
        raise ValueError("code es obligatorio para career")
    ref = firestore_db.collection(CAREERS_COLL).document(code)
    snap = ref.get()

    payload = {
        "code": code,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    if name:
        payload["name"] = name

    if not snap.exists:
        payload["createdAt"] = firestore.SERVER_TIMESTAMP
        ref.set(payload)
        return payload

    ref.set(payload, merge=True)
    current = snap.to_dict() or {}
    current.update(payload)
    return current

def get_career(code: str) -> Optional[Dict]:
    if not code:
        return None
    doc = firestore_db.collection(CAREERS_COLL).document(code).get()
    return doc.to_dict() if doc.exists else None
