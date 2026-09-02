import enum
import uuid
from datetime import datetime

from sqlalchemy import Numeric, Enum, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import UUIDPKMixin


class GiftCardTxnType(str, enum.Enum):
    issue = "issue"
    redeem = "redeem"
    refund = "refund"


class GiftCardTransaction(UUIDPKMixin, Base):
    __tablename__ = "gift_card_transactions"

    gift_card_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gift_cards.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    type: Mapped[GiftCardTxnType] = mapped_column(Enum(GiftCardTxnType, name="gift_card_txn_type"))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    balance_after: Mapped[float] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
