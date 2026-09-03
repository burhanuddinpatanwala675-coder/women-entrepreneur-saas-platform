import enum
import uuid

from sqlalchemy import String, Numeric, Enum, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import UUIDPKMixin, TimestampMixin


class OrderStatus(str, enum.Enum):
    new = "new"
    confirmed = "confirmed"
    preparing = "preparing"
    ready = "ready"
    dispatched = "dispatched"
    delivered = "delivered"
    cancelled = "cancelled"


class OrderChannel(str, enum.Enum):
    whatsapp = "whatsapp"
    storefront_cart = "storefront_cart"


class PaymentMethod(str, enum.Enum):
    cod = "cod"
    manual = "manual"
    unpaid = "unpaid"


class Order(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "orders"

    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    order_number: Mapped[str] = mapped_column(String(40), index=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus, name="order_status"), default=OrderStatus.new)
    channel: Mapped[OrderChannel] = mapped_column(Enum(OrderChannel, name="order_channel"), default=OrderChannel.whatsapp)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    voucher_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("vouchers.id", ondelete="SET NULL"), nullable=True)
    gift_card_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("gift_cards.id", ondelete="SET NULL"), nullable=True)
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod, name="payment_method"), default=PaymentMethod.unpaid)
    whatsapp_message_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    customer = relationship("Customer")
