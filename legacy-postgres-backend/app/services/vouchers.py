from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.voucher import Voucher, DiscountType
from app.models.voucher_usage import VoucherUsage


class VoucherError(ValueError):
    pass


def validate_and_calculate(
    db: Session, voucher: Voucher, subtotal: float, customer_id: Optional[str], product_ids: list[str]
) -> float:
    if not voucher.is_active:
        raise VoucherError("This voucher is no longer active")

    now = datetime.now(timezone.utc)
    if voucher.starts_at and voucher.starts_at > now:
        raise VoucherError("This voucher is not active yet")
    if voucher.expires_at and voucher.expires_at < now:
        raise VoucherError("This voucher has expired")

    if voucher.min_purchase_amount and subtotal < float(voucher.min_purchase_amount):
        raise VoucherError(f"Minimum purchase of Rs. {voucher.min_purchase_amount:,.0f} required for this voucher")

    if voucher.applicable_product_ids:
        if not set(product_ids) & set(voucher.applicable_product_ids):
            raise VoucherError("This voucher does not apply to any items in your cart")

    if voucher.usage_limit is not None:
        total_used = db.query(VoucherUsage).filter(VoucherUsage.voucher_id == voucher.id).count()
        if total_used >= voucher.usage_limit:
            raise VoucherError("This voucher has reached its usage limit")

    if customer_id and voucher.usage_limit_per_customer:
        used_by_customer = (
            db.query(VoucherUsage)
            .filter(VoucherUsage.voucher_id == voucher.id, VoucherUsage.customer_id == customer_id)
            .count()
        )
        if used_by_customer >= voucher.usage_limit_per_customer:
            raise VoucherError("You have already used this voucher the maximum number of times")

    if voucher.discount_type == DiscountType.percentage:
        discount = subtotal * (float(voucher.discount_value) / 100)
    else:
        discount = float(voucher.discount_value)

    if voucher.max_discount_amount:
        discount = min(discount, float(voucher.max_discount_amount))

    return round(min(discount, subtotal), 2)
