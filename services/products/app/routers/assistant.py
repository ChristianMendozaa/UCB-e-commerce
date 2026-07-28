from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.firebase import firestore_db
from app.deps.auth import get_current_user


router = APIRouter(prefix="/api/assistant", tags=["assistant"])
_COLLECTION = "assistant_preferences"


class AssistantPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    career: Optional[str] = Field(default=None, max_length=100)
    budget_min: Optional[float] = Field(default=None, ge=0)
    budget_max: Optional[float] = Field(default=None, ge=0)
    categories: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("career")
    @classmethod
    def clean_career(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("categories")
    @classmethod
    def clean_categories(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        if any(len(item) > 100 for item in cleaned):
            raise ValueError("Categoría demasiado larga.")
        return list(dict.fromkeys(cleaned))

    @model_validator(mode="after")
    def validate_budget(self):
        if (
            self.budget_min is not None
            and self.budget_max is not None
            and self.budget_max < self.budget_min
        ):
            raise ValueError("budget_max no puede ser menor a budget_min")
        return self


@router.get("/preferences", response_model=AssistantPreferences)
def get_preferences(user=Depends(get_current_user)):
    snapshot = firestore_db.collection(_COLLECTION).document(user["uid"]).get()
    if not snapshot.exists:
        return AssistantPreferences()
    data = snapshot.to_dict() or {}
    return AssistantPreferences.model_validate(
        {
            key: data.get(key)
            for key in ("career", "budget_min", "budget_max", "categories")
            if key in data
        }
    )


@router.patch("/preferences", response_model=AssistantPreferences)
def update_preferences(
    payload: AssistantPreferences,
    user=Depends(get_current_user),
):
    data = payload.model_dump()
    firestore_db.collection(_COLLECTION).document(user["uid"]).set(
        {
            **data,
            "updatedAt": datetime.utcnow(),
        },
        merge=True,
    )
    return payload


@router.delete("/preferences", status_code=status.HTTP_204_NO_CONTENT)
def delete_preferences(user=Depends(get_current_user)):
    firestore_db.collection(_COLLECTION).document(user["uid"]).delete()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
