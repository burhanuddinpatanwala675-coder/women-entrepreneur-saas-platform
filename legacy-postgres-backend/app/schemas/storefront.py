import uuid
from typing import Optional, List

from pydantic import BaseModel

from app.schemas.product import ProductImageOut, ProductVariantOut
from app.models.product import ProductStatus


class PublicBusinessOut(BaseModel):
    name: str
    slug: str
    short_description: Optional[str] = None
    logo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    whatsapp_number: Optional[str] = None
    social_links: dict = {}
    template: str
    category_name: Optional[str] = None
    accent_color: str = "#D6336C"
    show_search: bool = True
    show_filters: bool = True
    announcement_banner: Optional[str] = None

    model_config = {"from_attributes": True}


class PublicProductOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    price: float
    sale_price: Optional[float] = None
    stock_quantity: int
    status: ProductStatus
    tags: List[str] = []
    images: List[ProductImageOut] = []
    variants: List[ProductVariantOut] = []
    is_orderable: bool = True

    model_config = {"from_attributes": True}


class PublicProductDetailOut(PublicProductOut):
    related_products: List["PublicProductOut"] = []


class VoucherValidateRequest(BaseModel):
    code: str
    subtotal: float
    product_ids: List[uuid.UUID] = []
    customer_phone: Optional[str] = None


class VoucherValidateResponse(BaseModel):
    valid: bool
    discount_amount: float = 0
    message: str
