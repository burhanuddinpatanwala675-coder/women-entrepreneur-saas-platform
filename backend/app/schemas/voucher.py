import uuid
from typing import Optional, List
from datetime import datetime

from pydantic import BaseModel

from app.models.voucher import DiscountType


class VoucherCreate(BaseModel):
    code: str
    discount_type: DiscountType
    discount_value: float
    min_purchase_amount: Optional[float] = None
    max_discount_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    usage_limit_per_customer: int = 1
    applicable_product_ids: Optional[List[uuid.UUID]] = None
    applicable_category_ids: Optional[List[uuid.UUID]] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class VoucherUpdate(BaseModel):
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[float] = None
    min_purchase_amount: Optional[float] = None
    max_discount_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    usage_limit_per_customer: Optional[int] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class VoucherOut(BaseModel):
    id: uuid.UUID
    code: str
    discount_type: DiscountType
    discount_value: float
    min_purchase_amount: Optional[float] = None
    max_discount_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    usage_limit_per_customer: int
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool
    times_used: int = 0

    model_config = {"from_attributes": True}
