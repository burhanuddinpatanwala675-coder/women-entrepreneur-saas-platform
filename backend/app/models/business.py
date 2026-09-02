import enum
import uuid

from sqlalchemy import String, Enum, ForeignKey, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import UUIDPKMixin, TimestampMixin


class BusinessStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    pending = "pending"


class BusinessTemplate(str, enum.Enum):
    fashion = "fashion"
    beauty = "beauty"
    food = "food"
    handmade = "handmade"
    minimal = "minimal"


class Business(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "businesses"

    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    short_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    whatsapp_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    social_links: Mapped[dict] = mapped_column(JSON, default=dict)
    template: Mapped[BusinessTemplate] = mapped_column(
        Enum(BusinessTemplate, name="business_template"), default=BusinessTemplate.minimal
    )
    status: Mapped[BusinessStatus] = mapped_column(Enum(BusinessStatus, name="business_status"), default=BusinessStatus.active)
    onboarding_step: Mapped[int] = mapped_column(Integer, default=0)

    owner = relationship("User", back_populates="businesses", foreign_keys=[owner_user_id])
    category = relationship("Category")
