from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Dict, Any

class CartItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    productId: str = Field(min_length=1, max_length=1_500)
    quantity: int = Field(ge=1, le=20)

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
