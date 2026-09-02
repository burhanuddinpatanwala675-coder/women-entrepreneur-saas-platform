import enum
import uuid

from sqlalchemy import String, Numeric, Integer, Enum, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import UUIDPKMixin, TimestampMixin


class ProductStatus(str, enum.Enum):
    available = "available"
    low_stock = "low_stock"
    out_of_stock = "out_of_stock"
    sold = "sold"
    hidden = "hidden"


class Product(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "products"

    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(220), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(12, 2))
    sale_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    sku: Mapped[str | None] = mapped_column(String(80), nullable=True)
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[ProductStatus] = mapped_column(Enum(ProductStatus, name="product_status"), default=ProductStatus.available)
    previous_status: Mapped[ProductStatus | None] = mapped_column(
        Enum(ProductStatus, name="product_status_prev"), nullable=True
    )
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=3)
    tags: Mapped[list] = mapped_column(JSON, default=list)

    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.sort_order")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    category = relationship("Category")
