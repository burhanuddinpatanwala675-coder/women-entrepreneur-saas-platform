import uuid
from datetime import datetime

from sqlalchemy import Numeric, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import UUIDPKMixin


class VoucherUsage(UUIDPKMixin, Base):
    __tablename__ = "voucher_usage"

    voucher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vouchers.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"))
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    discount_applied: Mapped[float] = mapped_column(Numeric(12, 2))
    used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
