import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Numeric, Enum, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import UUIDPKMixin, TimestampMixin


class GiftCardStatus(str, enum.Enum):
    active = "active"
    redeemed = "redeemed"
    expired = "expired"
    cancelled = "cancelled"


class GiftCard(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "gift_cards"

    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    initial_balance: Mapped[float] = mapped_column(Numeric(12, 2))
    current_balance: Mapped[float] = mapped_column(Numeric(12, 2))
    sender_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    recipient_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    recipient_contact: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[GiftCardStatus] = mapped_column(Enum(GiftCardStatus, name="gift_card_status"), default=GiftCardStatus.active)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
