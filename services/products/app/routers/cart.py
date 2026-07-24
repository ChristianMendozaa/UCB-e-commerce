from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from app.deps.auth import get_current_user
from app.schemas.cart import CartOut, CartItemIn, CartEnrichedOut, CartFrontendOut
from app.repositories import cart_repo

router = APIRouter(
    prefix="/api/cart",
    tags=["Cart"]
)

@router.get("", response_model=CartOut)
def get_my_cart(user=Depends(get_current_user)):
    return cart_repo.get_cart(user["uid"])

@router.get("/chatbot", response_model=CartEnrichedOut)
def get_my_cart_chatbot(user=Depends(get_current_user)):
    return cart_repo.get_cart_enriched(user["uid"])

@router.get("/details", response_model=CartFrontendOut)
def get_my_cart_details_frontend(user=Depends(get_current_user)):
    return cart_repo.get_cart_frontend(user["uid"])

@router.post("/items", response_model=CartOut)
def add_item_to_cart(item: CartItemIn, user=Depends(get_current_user)):
    return cart_repo.add_item(user["uid"], item.productId, item.quantity)

@router.put("/items", response_model=CartOut)
def update_item_quantity(item: CartItemIn, user=Depends(get_current_user)):
    return cart_repo.update_item_quantity(user["uid"], item.productId, item.quantity)

@router.delete("/items/{product_id}", response_model=CartOut)
def remove_item_from_cart(product_id: str, user=Depends(get_current_user)):
    return cart_repo.remove_item(user["uid"], product_id)

@router.delete("", response_model=CartOut)
def clear_my_cart(user=Depends(get_current_user)):
    return cart_repo.clear_cart(user["uid"])
