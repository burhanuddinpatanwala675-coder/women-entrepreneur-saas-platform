import uuid

from sqlalchemy import String, Numeric, Integer, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import UUIDPKMixin


class ProductVariant(UUIDPKMixin, Base):
    __tablename__ = "product_variants"

    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    option_values: Mapped[dict] = mapped_column(JSON, default=dict)
    price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0)
    sku: Mapped[str | None] = mapped_column(String(80), nullable=True)

    product = relationship("Product", back_populates="variants")
