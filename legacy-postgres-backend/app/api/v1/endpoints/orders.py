import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.api.v1.deps import get_current_business
from app.db.session import get_db
from app.models.business import Business
from app.models.order import Order, OrderStatus
from app.schemas.order import OrderOut, OrderStatusUpdate

router = APIRouter(prefix="/orders", tags=["orders"])


def _to_out(order: Order) -> OrderOut:
    out = OrderOut.model_validate(order)
    if order.customer:
        out.customer_name = order.customer.name
        out.customer_phone = order.customer.phone
    return out


@router.get("", response_model=list[OrderOut])
def list_orders(
    status_filter: Optional[OrderStatus] = Query(None, alias="status"),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Order)
        .options(joinedload(Order.items), joinedload(Order.customer))
        .filter(Order.business_id == business.id)
    )
    if status_filter:
        query = query.filter(Order.status == status_filter)
    orders = query.order_by(Order.created_at.desc()).all()
    return [_to_out(o) for o in orders]


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: uuid.UUID, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    order = (
        db.query(Order)
        .options(joinedload(Order.items), joinedload(Order.customer))
        .filter(Order.id == order_id, Order.business_id == business.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _to_out(order)


VALID_TRANSITIONS = {
    OrderStatus.new: {OrderStatus.confirmed, OrderStatus.cancelled},
    OrderStatus.confirmed: {OrderStatus.preparing, OrderStatus.cancelled},
    OrderStatus.preparing: {OrderStatus.ready, OrderStatus.cancelled},
    OrderStatus.ready: {OrderStatus.dispatched, OrderStatus.cancelled},
    OrderStatus.dispatched: {OrderStatus.delivered},
    OrderStatus.delivered: set(),
    OrderStatus.cancelled: set(),
}


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_order_status(order_id: uuid.UUID, payload: OrderStatusUpdate, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    order = (
        db.query(Order)
        .options(joinedload(Order.items), joinedload(Order.customer))
        .filter(Order.id == order_id, Order.business_id == business.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if payload.status != order.status and payload.status not in VALID_TRANSITIONS.get(order.status, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move an order from '{order.status.value}' to '{payload.status.value}'",
        )

    order.status = payload.status
    db.commit()
    db.refresh(order)
    return _to_out(order)
