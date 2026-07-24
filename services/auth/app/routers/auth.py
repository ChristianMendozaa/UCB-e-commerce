from fastapi import APIRouter, Response, HTTPException, status, Request
from datetime import datetime, timezone
import httpx

from firebase_admin import auth as fb_auth
from app.config import (
    FIREBASE_WEB_API_KEY, SESSION_EXPIRES_DELTA, SESSION_COOKIE_NAME,
    SESSION_COOKIE_DOMAIN, SESSION_COOKIE_SECURE
)
from app.schemas.auth import EmailRegister, EmailLogin, RefreshRequest, GoogleIdpLogin
from app.schemas.user import LoginWithIdToken
from app.services.users_service import best_effort_materialize
from app.services.roles_service import ensure_default_student
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

BASE_ID_TOOLKIT = "https://identitytoolkit.googleapis.com/v1"
BASE_SECURE_TOKEN = "https://securetoken.googleapis.com/v1"

def _verify_id_token_with_skew(id_token: str, skew_seconds: int = 15):
    """
    Verifica el ID token. Si falla por 'Token used too early',
    reintenta con una tolerancia de reloj (clock skew).
    """
    try:
        return fb_auth.verify_id_token(id_token)
    except Exception as e:
        msg = str(e)
        if "Token used too early" in msg:
            logger.warning(
                "verify_id_token: 'used too early', reintentando con %ss de tolerancia",
                skew_seconds,
            )
            # IMPORTANTE: usar argumento keyword para evitar confundir el orden de params
            return fb_auth.verify_id_token(id_token, clock_skew_seconds=skew_seconds)
        # Cualquier otro error se propaga igual
        raise


@router.post("/session/logout")
def logout(response: Response, request: Request):
    # Opcional: ver qué cookie llega
    # sc = request.cookies.get(SESSION_COOKIE_NAME)
    # print("Cookie de sesión recibida:", sc)

    # ✅ Borrar cookie host-only (SIN domain)
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
    )

    # ✅ Refuerzo: setear cookie vacía expirada con mismos flags
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value="",
        max_age=0,
        expires=0,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )

    # (Opcional) Por si antes se definió cookie con `domain`, intentarlo también:
    for d in [".vercel.app", "vercel.app"]:
        try:
            response.delete_cookie(SESSION_COOKIE_NAME, path="/", domain=d)
        except Exception:
            pass

    return {"ok": True}

@router.post("/google/login_or_register")
async def google_login_or_register(body: GoogleIdpLogin, response: Response):
    id_token = getattr(body, "id_token", None) or getattr(body, "provider_id_token", None)
    if not id_token:
        raise HTTPException(400, detail="Falta id_token")

    # 1) Verificar el ID token de Firebase con tolerancia
    try:
        decoded = _verify_id_token_with_skew(id_token, skew_seconds=15)
    except Exception as e:
        logger.exception("verify_id_token failed")
        raise HTTPException(401, detail=f"ID token inválido: {e}")

    # 2) Crear cookie de sesión
    try:
        session_cookie = fb_auth.create_session_cookie(id_token, expires_in=SESSION_EXPIRES_DELTA)
    except Exception as e:
        logger.exception("create_session_cookie failed")
        raise HTTPException(400, detail=f"No se pudo crear la sesión: {e}")

    expires_at = datetime.now(timezone.utc) + SESSION_EXPIRES_DELTA
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_cookie,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
        path="/",
        expires=int(expires_at.timestamp()),
    )

    # 3) Materializar perfil sin romper el flujo si falla
    uid = decoded.get("uid")
    base_profile = {
        "uid": uid,
        "email": decoded.get("email"),
        "displayName": decoded.get("name"),
        "photoURL": decoded.get("picture"),
        "providers": "google.com",
    }
    try:
        best_effort_materialize(uid, base_profile)
        # ✅ Rol por defecto en colección `roles`
        ensure_default_student(uid)
    except Exception as e:
        logger.warning("best_effort_materialize/ensure_default_student falló (continuo): %s", e)

    return {"ok": True, "uid": uid, "expiresAt": expires_at.isoformat()}

@router.post("/token/refresh")
async def refresh_token(body: RefreshRequest):
    params = {"key": FIREBASE_WEB_API_KEY}
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            f"{BASE_SECURE_TOKEN}/token",
            params=params,
            data={"grant_type": "refresh_token", "refresh_token": body.refresh_token},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=400, detail=r.text)
    data = r.json()
    return {
        "id_token": data.get("id_token"),
        "refresh_token": data.get("refresh_token"),
        "user_id": data.get("user_id"),
        "expires_in": data.get("expires_in"),
        "token_type": data.get("token_type"),
        "project_id": data.get("project_id"),
    }
