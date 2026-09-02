import uuid

from sqlalchemy import String, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import UUIDPKMixin


class StoreSettings(UUIDPKMixin, Base):
    __tablename__ = "store_settings"

    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), unique=True, index=True)
    template: Mapped[str] = mapped_column(String(40), default="minimal")
    accent_color: Mapped[str] = mapped_column(String(20), default="#D6336C")
    show_search: Mapped[bool] = mapped_column(Boolean, default=True)
    show_filters: Mapped[bool] = mapped_column(Boolean, default=True)
    cod_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    manual_payment_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    announcement_banner: Mapped[str | None] = mapped_column(Text, nullable=True)
