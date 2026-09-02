import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Numeric, Integer, Enum, ForeignKey, Boolean, DateTime, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import UUIDPKMixin, TimestampMixin


class DiscountType(str, enum.Enum):
    percentage = "percentage"
    fixed = "fixed"


class Voucher(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "vouchers"
    __table_args__ = (UniqueConstraint("business_id", "code", name="uq_voucher_business_code"),)

    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(40))
    discount_type: Mapped[DiscountType] = mapped_column(Enum(DiscountType, name="discount_type"))
    discount_value: Mapped[float] = mapped_column(Numeric(12, 2))
    min_purchase_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    max_discount_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    usage_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    usage_limit_per_customer: Mapped[int] = mapped_column(Integer, default=1)
    applicable_product_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    applicable_category_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
