import uuid
from typing import Optional
from datetime import datetime

from pydantic import BaseModel

from app.models.business import BusinessStatus


class AdminSellerOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: BusinessStatus
    owner_name: str = ""
    owner_email: Optional[str] = None
    owner_phone: Optional[str] = None
    product_count: int = 0
    order_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class SellerStatusUpdate(BaseModel):
    status: BusinessStatus


class AdminAnalyticsOut(BaseModel):
    total_sellers: int
    active_sellers: int
    suspended_sellers: int
    total_products: int
    total_orders: int
    orders_last_30_days: int
    total_customers: int
    gmv_total: float
    gmv_last_30_days: float
