# app/schemas/products.py
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime

class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field("", max_length=2000)
    price: float = Field(..., ge=0)
    category: str = Field(..., min_length=1, max_length=100)
    career: str = Field(..., min_length=1, max_length=50)  # clave de carrera (p.ej. "SIS")
    stock: int = Field(0, ge=0)
    image: Optional[str] = ""

    @validator("category", "career")
    def strip_lower(cls, v: str):
        return v.strip()

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    price: Optional[float] = Field(None, ge=0)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    career: Optional[str] = Field(None, min_length=1, max_length=50)
    stock: Optional[int] = Field(None, ge=0)
    image: Optional[str] = None

class ProductOut(ProductBase):
    id: str
    createdAt: datetime
    updatedAt: datetime
    createdBy: Optional[str] = None

class ProductList(BaseModel):
    items: List[ProductOut]
    next_cursor: Optional[str] = None  # opcional para paginación sencilla por fecha

class ProductFilters(BaseModel):
    q: Optional[str] = None
    category: Optional[str] = None
    career: Optional[str] = None
    limit: int = 50
    cursor: Optional[str] = None  # ISO datetime para start_after (createdAt)
