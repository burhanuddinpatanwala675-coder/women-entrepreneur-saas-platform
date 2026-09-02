import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_business
from app.db.session import get_db
from app.models.business import Business
from app.models.customer import Customer
from app.models.order import Order
from app.schemas.customer import CustomerDetailOut, CustomerOut

router = APIRouter(prefix="/customers", tags=["customers"])


def _stats_for(db: Session, customer_id) -> dict:
    row = (
        db.query(func.count(Order.id), func.coalesce(func.sum(Order.total), 0), func.max(Order.created_at))
        .filter(Order.customer_id == customer_id, Order.status != "cancelled")
        .first()
    )
    return {"order_count": row[0] or 0, "total_spent": float(row[1] or 0), "last_order_at": row[2]}


@router.get("", response_model=list[CustomerOut])
def list_customers(business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    customers = db.query(Customer).filter(Customer.business_id == business.id).order_by(Customer.created_at.desc()).all()
    out = []
    for c in customers:
        stats = _stats_for(db, c.id)
        item = CustomerOut.model_validate(c)
        item.order_count = stats["order_count"]
        item.total_spent = stats["total_spent"]
        item.last_order_at = stats["last_order_at"]
        out.append(item)
    return out


@router.get("/{customer_id}", response_model=CustomerDetailOut)
def get_customer(customer_id: uuid.UUID, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.business_id == business.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    stats = _stats_for(db, customer.id)
    orders = db.query(Order).filter(Order.customer_id == customer.id).order_by(Order.created_at.desc()).all()
    out = CustomerDetailOut.model_validate(customer)
    out.order_count = stats["order_count"]
    out.total_spent = stats["total_spent"]
    out.last_order_at = stats["last_order_at"]
    out.orders = orders
    return out
