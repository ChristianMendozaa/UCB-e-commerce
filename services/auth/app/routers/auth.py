import logging
from datetime import datetime, timezone

import httpx
from app.config import (
    FIREBASE_WEB_API_KEY,
    SESSION_COOKIE_DOMAIN,
    SESSION_COOKIE_NAME,
    SESSION_COOKIE_SECURE,
    SESSION_EXPIRES_DELTA,
)
from app.schemas.auth import GoogleIdpLogin, RefreshRequest
from app.services.roles_service import ensure_default_student
from app.services.users_service import best_effort_materialize
from fastapi import APIRouter, HTTPException, Request, Response
from firebase_admin import auth as fb_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

BASE_ID_TOOLKIT = "https://identitytoolkit.googleapis.com/v1"
BASE_SECURE_TOKEN = "https://securetoken.googleapis.com/v1"


def _expire_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        domain=SESSION_COOKIE_DOMAIN,
        secure=SESSION_COOKIE_SECURE,
        httponly=True,
        samesite="lax",
    )

def _verify_id_token_with_skew(id_token: str, skew_seconds: int = 15):
    """
    Verifica el ID token. Si falla por 'Token used too early',
    reintenta con una tolerancia de reloj (clock skew).
    """
    try:
        return fb_auth.verify_id_token(id_token, check_revoked=True)
    except Exception as e:
        msg = str(e)
        if "Token used too early" in msg:
            logger.warning(
                "verify_id_token: 'used too early', reintentando con %ss de tolerancia",
                skew_seconds,
            )
            # IMPORTANTE: usar argumento keyword para evitar confundir el orden de params
            return fb_auth.verify_id_token(
                id_token,
                check_revoked=True,
                clock_skew_seconds=skew_seconds,
            )
        # Cualquier otro error se propaga igual
        raise


@router.post("/session/logout")
def logout(response: Response, request: Request):
    session_cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if session_cookie:
        try:
            decoded = fb_auth.verify_session_cookie(
                session_cookie,
                check_revoked=False,
            )
        except Exception:
            logger.info("Logout recibió una cookie inválida o expirada.")
        else:
            uid = decoded.get("uid")
            try:
                if uid:
                    # Firebase session cookies cannot be revoked individually.
                    # Logout therefore invalidates every active session for this user.
                    fb_auth.revoke_refresh_tokens(uid)
            except Exception:
                logger.exception(
                    "No se pudieron revocar las sesiones del usuario durante logout."
                )

    _expire_session_cookie(response)
    return {"ok": True}

@router.post("/google/login_or_register")
async def google_login_or_register(body: GoogleIdpLogin, response: Response):
    id_token = getattr(body, "id_token", None) or getattr(body, "provider_id_token", None)
    if not id_token:
        raise HTTPException(400, detail="Falta id_token")

    # 1) Verificar el ID token de Firebase con tolerancia
    try:
        decoded = _verify_id_token_with_skew(id_token, skew_seconds=15)
    except Exception:
        logger.exception("verify_id_token failed")
        raise HTTPException(401, detail="ID token inválido o revocado.")

    # 2) Crear cookie de sesión
    try:
        session_cookie = fb_auth.create_session_cookie(id_token, expires_in=SESSION_EXPIRES_DELTA)
    except Exception:
        logger.exception("create_session_cookie failed")
        raise HTTPException(400, detail="No se pudo crear la sesión.")

    expires_at = datetime.now(timezone.utc) + SESSION_EXPIRES_DELTA
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_cookie,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
        path="/",
        domain=SESSION_COOKIE_DOMAIN,
        max_age=int(SESSION_EXPIRES_DELTA.total_seconds()),
        expires=expires_at,
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
