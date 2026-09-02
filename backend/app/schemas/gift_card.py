import uuid
from typing import Optional
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.gift_card import GiftCardStatus


class GiftCardCreate(BaseModel):
    initial_balance: float = Field(gt=0)
    sender_name: Optional[str] = None
    recipient_name: str
    recipient_contact: str
    message: Optional[str] = None
    delivery_date: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class GiftCardOut(BaseModel):
    id: uuid.UUID
    code: str
    initial_balance: float
    current_balance: float
    sender_name: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_contact: Optional[str] = None
    message: Optional[str] = None
    delivery_date: Optional[datetime] = None
    status: GiftCardStatus
    expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
