import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.deps import require_admin
from app.db.session import get_db
from app.models.business import Business
from app.models.category import Category
from app.models.customer import Customer
from app.models.order import Order, OrderStatus
from app.models.product import Product
from app.models.user import User
from app.schemas.admin import AdminAnalyticsOut, AdminSellerOut, SellerStatusUpdate
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/sellers", response_model=list[AdminSellerOut])
def list_sellers(db: Session = Depends(get_db)):
    businesses = db.query(Business).order_by(Business.created_at.desc()).all()
    out = []
    for b in businesses:
        owner = db.get(User, b.owner_user_id)
        item = AdminSellerOut.model_validate(b)
        item.owner_name = owner.full_name if owner else "—"
        item.owner_email = owner.email if owner else None
        item.owner_phone = owner.phone if owner else None
        item.product_count = db.query(Product).filter(Product.business_id == b.id).count()
        item.order_count = db.query(Order).filter(Order.business_id == b.id).count()
        out.append(item)
    return out


@router.patch("/sellers/{business_id}/status", response_model=AdminSellerOut)
def update_seller_status(business_id: uuid.UUID, payload: SellerStatusUpdate, db: Session = Depends(get_db)):
    business = db.get(Business, business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Seller not found")
    business.status = payload.status
    db.commit()
    db.refresh(business)
    owner = db.get(User, business.owner_user_id)
    item = AdminSellerOut.model_validate(business)
    item.owner_name = owner.full_name if owner else "—"
    item.owner_email = owner.email if owner else None
    item.owner_phone = owner.phone if owner else None
    item.product_count = db.query(Product).filter(Product.business_id == business.id).count()
    item.order_count = db.query(Order).filter(Order.business_id == business.id).count()
    return item


@router.get("/categories", response_model=list[CategoryOut])
def admin_list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.sort_order).all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
def admin_create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    from app.services.slugify import unique_slug
    slug = unique_slug(db, Category, payload.name)
    category = Category(name=payload.name, slug=slug, icon=payload.icon, parent_id=payload.parent_id)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/categories/{category_id}", response_model=CategoryOut)
def admin_update_category(category_id: uuid.UUID, payload: CategoryUpdate, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=204)
def admin_delete_category(category_id: uuid.UUID, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if category:
        db.delete(category)
        db.commit()


@router.get("/analytics", response_model=AdminAnalyticsOut)
def analytics(db: Session = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=30)
    total_sellers = db.query(Business).count()
    active_sellers = db.query(Business).filter(Business.status == "active").count()
    suspended_sellers = db.query(Business).filter(Business.status == "suspended").count()
    total_products = db.query(Product).count()
    total_orders = db.query(Order).count()
    orders_30d = db.query(Order).filter(Order.created_at >= since).count()
    total_customers = db.query(Customer).count()
    gmv_total = db.query(func.coalesce(func.sum(Order.total), 0)).filter(Order.status != OrderStatus.cancelled).scalar()
    gmv_30d = (
        db.query(func.coalesce(func.sum(Order.total), 0))
        .filter(Order.status != OrderStatus.cancelled, Order.created_at >= since)
        .scalar()
    )
    return AdminAnalyticsOut(
        total_sellers=total_sellers,
        active_sellers=active_sellers,
        suspended_sellers=suspended_sellers,
        total_products=total_products,
        total_orders=total_orders,
        orders_last_30_days=orders_30d,
        total_customers=total_customers,
        gmv_total=float(gmv_total or 0),
        gmv_last_30_days=float(gmv_30d or 0),
    )
