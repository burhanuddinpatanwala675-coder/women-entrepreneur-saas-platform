import uuid
from typing import Optional, List
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.order import OrderStatus, OrderChannel, PaymentMethod


class OrderItemIn(BaseModel):
    product_id: uuid.UUID
    product_variant_id: Optional[uuid.UUID] = None
    quantity: int = Field(gt=0, default=1)


class CustomerIn(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None


class OrderCreateRequest(BaseModel):
    customer: CustomerIn
    items: List[OrderItemIn]
    channel: OrderChannel = OrderChannel.whatsapp
    voucher_code: Optional[str] = None
    gift_card_code: Optional[str] = None
    payment_method: PaymentMethod = PaymentMethod.unpaid
    notes: Optional[str] = None


class OrderItemOut(BaseModel):
    id: uuid.UUID
    product_id: Optional[uuid.UUID] = None
    product_variant_id: Optional[uuid.UUID] = None
    product_name_snapshot: str
    variant_name_snapshot: Optional[str] = None
    unit_price: float
    quantity: int
    line_total: float

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: uuid.UUID
    order_number: str
    status: OrderStatus
    channel: OrderChannel
    subtotal: float
    discount_total: float
    total: float
    payment_method: PaymentMethod
    notes: Optional[str] = None
    created_at: datetime
    items: List[OrderItemOut] = []
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None

    model_config = {"from_attributes": True}


class OrderCreateResponse(BaseModel):
    order: OrderOut
    whatsapp_link: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
