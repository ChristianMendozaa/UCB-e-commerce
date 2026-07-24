from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class CartItemIn(BaseModel):
    productId: str
    quantity: int

class CartItemOut(BaseModel):
    productId: str
    quantity: int

from datetime import datetime

class CartOut(BaseModel):
    userId: str
    items: List[CartItemOut]
    updatedAt: Optional[datetime] = None

class CartItemEnriched(CartItemOut):
    name: Optional[str] = None
    price: Optional[float] = 0.0
    description: Optional[str] = None

class CartEnrichedOut(BaseModel):
    userId: str
    items: List[CartItemEnriched]
    updatedAt: Optional[datetime] = None

class CartItemFrontend(CartItemEnriched):
    image: Optional[str] = None
    category: Optional[str] = None
    career: Optional[str] = None
    stock: Optional[int] = 0

class CartFrontendOut(BaseModel):
    userId: str
    items: List[CartItemFrontend]
    updatedAt: Optional[datetime] = None
