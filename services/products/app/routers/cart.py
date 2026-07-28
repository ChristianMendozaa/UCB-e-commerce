from fastapi import APIRouter, Depends, Header, HTTPException, status
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

def _apply_cart_command(command):
    try:
        return command()
    except cart_repo.CartValidationError as exc:
        detail = str(exc)
        code = status.HTTP_409_CONFLICT if "Stock" in detail else status.HTTP_422_UNPROCESSABLE_ENTITY
        if "no encontrado" in detail:
            code = status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=code, detail=detail) from exc


@router.post("/items", response_model=CartOut)
def add_item_to_cart(
    item: CartItemIn,
    user=Depends(get_current_user),
    idempotency_key: str | None = Header(
        default=None,
        alias="Idempotency-Key",
        min_length=1,
        max_length=200,
    ),
):
    return _apply_cart_command(
        lambda: cart_repo.add_item(
            user["uid"],
            item.productId,
            item.quantity,
            idempotency_key,
        )
    )

@router.put("/items", response_model=CartOut)
def update_item_quantity(
    item: CartItemIn,
    user=Depends(get_current_user),
    idempotency_key: str | None = Header(
        default=None,
        alias="Idempotency-Key",
        min_length=1,
        max_length=200,
    ),
):
    return _apply_cart_command(
        lambda: cart_repo.update_item_quantity(
            user["uid"],
            item.productId,
            item.quantity,
            idempotency_key,
        )
    )

@router.delete("/items/{product_id}", response_model=CartOut)
def remove_item_from_cart(
    product_id: str,
    user=Depends(get_current_user),
    idempotency_key: str | None = Header(
        default=None,
        alias="Idempotency-Key",
        min_length=1,
        max_length=200,
    ),
):
    return _apply_cart_command(
        lambda: cart_repo.remove_item(user["uid"], product_id, idempotency_key)
    )

@router.delete("", response_model=CartOut)
def clear_my_cart(
    user=Depends(get_current_user),
    idempotency_key: str | None = Header(
        default=None,
        alias="Idempotency-Key",
        min_length=1,
        max_length=200,
    ),
):
    return _apply_cart_command(
        lambda: cart_repo.clear_cart(user["uid"], idempotency_key)
    )
