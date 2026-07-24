from typing import Optional, List, Literal
from pydantic import BaseModel, EmailStr

class UpdateProfile(BaseModel):
    displayName: Optional[str] = None
    photoURL: Optional[str] = None
    phoneNumber: Optional[str] = None

class LoginWithIdToken(BaseModel):
    id_token: str

RoleLiteral = Literal["student", "teacher", "admin"]

class MeResponse(BaseModel):
    uid: str
    email: Optional[str] = None
    displayName: Optional[str] = None
    photoURL: Optional[str] = None

    # perfil legado (podría contener career simple)
    profile: Optional[dict] = None

    # roles
    role: str                   # primario: "admin" o "student"
    roles: List[str]            # lista completa
    is_admin: bool

    # carreras (nuevas)
    careers: List[str] = []     # <-- NUEVO: todas las carreras a las que pertenece
    admin_careers: List[str] = []  # ya existía pero lo dejamos explícito

    # opcional: superadmin
    platform_admin: bool = False