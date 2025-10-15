from __future__ import annotations
from pydantic import BaseModel, Field, conint, confloat
from typing import List, Literal, Optional
from datetime import datetime

OrderStatus = Literal["pending", "confirmed", "shipped", "delivered"]

class OrderItemIn(BaseModel):
    productId: str = Field(..., min_length=1)
    quantity: conint(ge=1)

class CreateOrderIn(BaseModel):
    items: List[OrderItemIn]

class OrderItemOut(BaseModel):
    productId: str
    quantity: int
    price: confloat(ge=0)  # precio unitario confirmado por backend

class OrderOut(BaseModel):
    id: str
    userId: str
    items: List[OrderItemOut]
    total: float
    status: OrderStatus
    createdAt: datetime
    updatedAt: datetime

class UpdateStatusIn(BaseModel):
    status: OrderStatus
