from pydantic import BaseModel, EmailStr
from typing import Optional

# Registro por email/password con más campos (los guardarás en Firestore)
class EmailRegister(BaseModel):
    email: EmailStr
    password: str
    # campos extras tipo Google (opcionales)
    name: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    picture: Optional[str] = None
    locale: Optional[str] = None
    displayName: Optional[str] = None  # para compat

class EmailLogin(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class SessionResponse(BaseModel):
    ok: bool
    uid: str
    expiresAt: str

# Google IdP: login o registro con un solo endpoint
class GoogleIdpLogin(BaseModel):
    provider_id_token: str                     # ID token emitido por Google
    request_uri: Optional[str] = "http://localhost"  # requerido por la API
