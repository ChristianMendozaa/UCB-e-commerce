from hmac import compare_digest

from fastapi import Header, HTTPException

from app.core.config import INTERNAL_API_TOKEN


def require_internal_token(x_internal_token: str = Header(...)) -> None:
    if not compare_digest(x_internal_token, INTERNAL_API_TOKEN):
        raise HTTPException(status_code=401, detail="Token interno inválido.")
