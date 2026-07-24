# ====== SCHEMAS LOCALES ======
# ====== SCHEMAS LOCALES ======
from pydantic import BaseModel

class MakeAdminBody(BaseModel):
    uid: str
    career: str
    
class RemoveAdminBody(BaseModel):
    uid: str
    career: str

class MakePlatformAdminBody(BaseModel):
    uid: str

class RemovePlatformAdminBody(BaseModel):
    uid: str