import uuid
from typing import Optional, List
from datetime import datetime

from pydantic import BaseModel


class CustomerOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str
    email: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    order_count: int = 0
    total_spent: float = 0
    last_order_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CustomerOrderSummary(BaseModel):
    id: uuid.UUID
    order_number: str
    status: str
    total: float
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerDetailOut(CustomerOut):
    orders: List[CustomerOrderSummary] = []
