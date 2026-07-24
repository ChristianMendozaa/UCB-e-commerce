from app.core.firebase import firestore_db
from typing import Optional, Dict
from google.cloud import firestore

COLLECTION = "users"  # <-- importante

def upsert_profile(uid: str, data: Dict) -> Dict:
    ref = firestore_db.collection(COLLECTION).document(uid)
    ref.set({**data, "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True)
    return ref.get().to_dict()

def get_profile(uid: str) -> Optional[Dict]:
    doc = firestore_db.collection(COLLECTION).document(uid).get()
    return doc.to_dict() if doc.exists else None

def delete_profile(uid: str) -> None:
    firestore_db.collection(COLLECTION).document(uid).delete()

def best_effort_materialize(uid: str, base: Dict) -> None:
    try:
        firestore_db.collection(COLLECTION).document(uid).set(
            {**base, "updatedAt": firestore.SERVER_TIMESTAMP},
            merge=True
        )
    except Exception as e:
        # Evita silenciar por completo, deja al menos un log para depurar:
        print(f"[WARN] best_effort_materialize failed for {uid}: {e}")
