import random
import string
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.business import Business, BusinessStatus
from app.models.category import Category
from app.models.customer import Customer
from app.models.gift_card import GiftCard, GiftCardStatus
from app.models.gift_card_transaction import GiftCardTransaction, GiftCardTxnType
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.product import Product, ProductStatus
from app.models.product_variant import ProductVariant
from app.models.store_settings import StoreSettings
from app.models.voucher import Voucher
from app.models.voucher_usage import VoucherUsage
from app.schemas.gift_card import GiftCardCreate, GiftCardOut
from app.schemas.order import OrderCreateRequest, OrderCreateResponse, OrderOut
from app.schemas.storefront import (
    PublicBusinessOut,
    PublicProductDetailOut,
    PublicProductOut,
    VoucherValidateRequest,
    VoucherValidateResponse,
)
from app.services.stock import recompute_product_status
from app.services.vouchers import VoucherError, validate_and_calculate
from app.services.whatsapp import build_order_message, build_whatsapp_link

router = APIRouter(prefix="/public/stores", tags=["public-storefront"])

NON_ORDERABLE_STATUSES = {ProductStatus.sold, ProductStatus.out_of_stock, ProductStatus.hidden}


def _get_active_business(slug: str, db: Session) -> Business:
    business = db.query(Business).filter(Business.slug == slug).first()
    if not business or business.status == BusinessStatus.suspended:
        raise HTTPException(status_code=404, detail="Store not found or currently unavailable")
    return business


def _to_public_product(p: Product) -> PublicProductOut:
    out = PublicProductOut.model_validate(p)
    out.is_orderable = p.status not in NON_ORDERABLE_STATUSES and p.stock_quantity > 0
    return out


@router.get("/{slug}", response_model=PublicBusinessOut)
def get_store(slug: str, db: Session = Depends(get_db)):
    business = _get_active_business(slug, db)
    settings_row = db.query(StoreSettings).filter(StoreSettings.business_id == business.id).first()
    category = db.get(Category, business.category_id) if business.category_id else None

    out = PublicBusinessOut.model_validate(business)
    out.category_name = category.name if category else None
    if settings_row:
        out.accent_color = settings_row.accent_color
        out.show_search = settings_row.show_search
        out.show_filters = settings_row.show_filters
        out.announcement_banner = settings_row.announcement_banner
        out.template = settings_row.template or business.template.value
    return out


@router.get("/{slug}/products", response_model=list[PublicProductOut])
def list_store_products(
    slug: str,
    search: Optional[str] = None,
    category_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
):
    business = _get_active_business(slug, db)
    query = (
        db.query(Product)
        .options(joinedload(Product.images), joinedload(Product.variants))
        .filter(Product.business_id == business.id, Product.status != ProductStatus.hidden)
    )
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    if category_id:
        query = query.filter(Product.category_id == category_id)
    products = query.order_by(Product.created_at.desc()).all()
    return [_to_public_product(p) for p in products]


@router.get("/{slug}/products/{product_id}", response_model=PublicProductDetailOut)
def get_store_product(slug: str, product_id: uuid.UUID, db: Session = Depends(get_db)):
    business = _get_active_business(slug, db)
    product = (
        db.query(Product)
        .options(joinedload(Product.images), joinedload(Product.variants))
        .filter(Product.id == product_id, Product.business_id == business.id, Product.status != ProductStatus.hidden)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    related = (
        db.query(Product)
        .options(joinedload(Product.images), joinedload(Product.variants))
        .filter(
            Product.business_id == business.id,
            Product.id != product.id,
            Product.status != ProductStatus.hidden,
            Product.category_id == product.category_id,
        )
        .limit(4)
        .all()
    )

    out = PublicProductDetailOut.model_validate(product)
    out.is_orderable = product.status not in NON_ORDERABLE_STATUSES and product.stock_quantity > 0
    out.related_products = [_to_public_product(p) for p in related]
    return out


@router.post("/{slug}/vouchers/validate", response_model=VoucherValidateResponse)
def validate_voucher(slug: str, payload: VoucherValidateRequest, db: Session = Depends(get_db)):
    business = _get_active_business(slug, db)
    voucher = (
        db.query(Voucher)
        .filter(Voucher.business_id == business.id, Voucher.code == payload.code.strip().upper())
        .first()
    )
    if not voucher:
        return VoucherValidateResponse(valid=False, message="Voucher code not found")

    customer = None
    if payload.customer_phone:
        customer = db.query(Customer).filter(Customer.business_id == business.id, Customer.phone == payload.customer_phone).first()

    try:
        discount = validate_and_calculate(
            db, voucher, payload.subtotal, str(customer.id) if customer else None, [str(p) for p in payload.product_ids]
        )
    except VoucherError as e:
        return VoucherValidateResponse(valid=False, message=str(e))

    return VoucherValidateResponse(valid=True, discount_amount=discount, message="Voucher applied!")


def _next_order_number(db: Session, business: Business) -> str:
    count = db.query(Order).filter(Order.business_id == business.id).count()
    prefix = "".join(ch for ch in business.slug.upper() if ch.isalnum())[:4] or "ORD"
    return f"{prefix}-{count + 1:04d}"


@router.post("/{slug}/orders", response_model=OrderCreateResponse, status_code=201)
def create_order(slug: str, payload: OrderCreateRequest, db: Session = Depends(get_db)):
    business = _get_active_business(slug, db)
    if not payload.items:
        raise HTTPException(status_code=400, detail="Your cart is empty")

    customer = db.query(Customer).filter(Customer.business_id == business.id, Customer.phone == payload.customer.phone).first()
    if not customer:
        customer = Customer(business_id=business.id, name=payload.customer.name, phone=payload.customer.phone, email=payload.customer.email)
        db.add(customer)
        db.flush()
    else:
        customer.name = payload.customer.name
        if payload.customer.email:
            customer.email = payload.customer.email

    order_items = []
    subtotal = 0.0
    touched_products = []

    for item in payload.items:
        product = db.query(Product).filter(Product.id == item.product_id, Product.business_id == business.id).first()
        if not product:
            raise HTTPException(status_code=404, detail="One of the products in your cart no longer exists")
        if product.status in NON_ORDERABLE_STATUSES:
            raise HTTPException(status_code=400, detail=f"'{product.name}' is sold out and cannot be ordered")

        variant = None
        variant_price = None
        if item.product_variant_id:
            variant = db.query(ProductVariant).filter(ProductVariant.id == item.product_variant_id, ProductVariant.product_id == product.id).first()
            if not variant:
                raise HTTPException(status_code=404, detail="Selected variant not found")
            if variant.stock_quantity < item.quantity:
                raise HTTPException(status_code=400, detail=f"Not enough stock for '{product.name}' ({variant.name})")
            variant_price = float(variant.price) if variant.price is not None else None
        else:
            if product.stock_quantity < item.quantity:
                raise HTTPException(status_code=400, detail=f"Not enough stock for '{product.name}'")

        unit_price = variant_price if variant_price is not None else float(product.sale_price or product.price)
        line_total = round(unit_price * item.quantity, 2)
        subtotal += line_total

        order_items.append(OrderItem(
            product_id=product.id,
            product_variant_id=variant.id if variant else None,
            product_name_snapshot=product.name,
            variant_name_snapshot=variant.name if variant else None,
            unit_price=unit_price,
            quantity=item.quantity,
            line_total=line_total,
        ))

        if variant:
            variant.stock_quantity -= item.quantity
        else:
            product.stock_quantity -= item.quantity
        recompute_product_status(product)
        touched_products.append(product)

    subtotal = round(subtotal, 2)
    discount_total = 0.0
    voucher = None
    if payload.voucher_code:
        voucher = db.query(Voucher).filter(Voucher.business_id == business.id, Voucher.code == payload.voucher_code.strip().upper()).first()
        if not voucher:
            raise HTTPException(status_code=400, detail="Voucher code not found")
        try:
            discount_total = validate_and_calculate(db, voucher, subtotal, str(customer.id), [str(i.product_id) for i in payload.items])
        except VoucherError as e:
            raise HTTPException(status_code=400, detail=str(e))

    gift_card = None
    gift_card_applied = 0.0
    if payload.gift_card_code:
        gift_card = db.query(GiftCard).filter(GiftCard.business_id == business.id, GiftCard.code == payload.gift_card_code.strip().upper()).first()
        if not gift_card or gift_card.status != GiftCardStatus.active:
            raise HTTPException(status_code=400, detail="Gift card not found or no longer active")
        remaining_after_voucher = max(subtotal - discount_total, 0)
        gift_card_applied = min(float(gift_card.current_balance), remaining_after_voucher)

    total = max(round(subtotal - discount_total - gift_card_applied, 2), 0)

    order = Order(
        business_id=business.id,
        customer_id=customer.id,
        order_number=_next_order_number(db, business),
        status=OrderStatus.new,
        channel=payload.channel,
        subtotal=subtotal,
        discount_total=discount_total + gift_card_applied,
        total=total,
        voucher_id=voucher.id if voucher else None,
        gift_card_id=gift_card.id if gift_card else None,
        payment_method=payload.payment_method,
        notes=payload.notes,
    )
    order.items = order_items
    db.add(order)
    db.flush()

    if voucher:
        db.add(VoucherUsage(voucher_id=voucher.id, order_id=order.id, customer_id=customer.id, discount_applied=discount_total))
    if gift_card and gift_card_applied > 0:
        gift_card.current_balance = float(gift_card.current_balance) - gift_card_applied
        if gift_card.current_balance <= 0:
            gift_card.status = GiftCardStatus.redeemed
        db.add(GiftCardTransaction(
            gift_card_id=gift_card.id, order_id=order.id, type=GiftCardTxnType.redeem,
            amount=gift_card_applied, balance_after=gift_card.current_balance,
        ))

    db.commit()
    db.refresh(order)

    whatsapp_link = None
    if payload.channel == "whatsapp" and business.whatsapp_number:
        message = build_order_message(order, business.name, f"/store/{business.slug}")
        whatsapp_link = build_whatsapp_link(business.whatsapp_number, message)
        order.whatsapp_message_sent = True
        db.commit()

    out = OrderOut.model_validate(order)
    out.customer_name = customer.name
    out.customer_phone = customer.phone
    return OrderCreateResponse(order=out, whatsapp_link=whatsapp_link)


def _generate_gift_code() -> str:
    return "GC-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


@router.post("/{slug}/gift-cards/purchase", response_model=GiftCardOut, status_code=201)
def purchase_gift_card(slug: str, payload: GiftCardCreate, db: Session = Depends(get_db)):
    business = _get_active_business(slug, db)
    code = _generate_gift_code()
    while db.query(GiftCard).filter(GiftCard.code == code).first():
        code = _generate_gift_code()

    gift_card = GiftCard(
        business_id=business.id,
        code=code,
        initial_balance=payload.initial_balance,
        current_balance=payload.initial_balance,
        sender_name=payload.sender_name,
        recipient_name=payload.recipient_name,
        recipient_contact=payload.recipient_contact,
        message=payload.message,
        delivery_date=payload.delivery_date,
        expires_at=payload.expires_at,
    )
    db.add(gift_card)
    db.flush()
    db.add(GiftCardTransaction(gift_card_id=gift_card.id, type=GiftCardTxnType.issue, amount=payload.initial_balance, balance_after=payload.initial_balance))
    db.commit()
    db.refresh(gift_card)
    return gift_card


@router.get("/{slug}/gift-cards/{code}/check", response_model=GiftCardOut)
def check_gift_card(slug: str, code: str, db: Session = Depends(get_db)):
    business = _get_active_business(slug, db)
    gift_card = db.query(GiftCard).filter(GiftCard.business_id == business.id, GiftCard.code == code.strip().upper()).first()
    if not gift_card:
        raise HTTPException(status_code=404, detail="Gift card not found")
    return gift_card
