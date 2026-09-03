import uuid
from typing import Optional, List

from pydantic import BaseModel, Field

from app.models.product import ProductStatus


class ProductImageOut(BaseModel):
    id: uuid.UUID
    url: str
    sort_order: int
    is_primary: bool

    model_config = {"from_attributes": True}


class ProductImageCreate(BaseModel):
    url: str
    is_primary: bool = False


class ProductVariantOut(BaseModel):
    id: uuid.UUID
    name: str
    option_values: dict
    price: Optional[float] = None
    stock_quantity: int
    sku: Optional[str] = None

    model_config = {"from_attributes": True}


class ProductVariantCreate(BaseModel):
    name: str
    option_values: dict = {}
    price: Optional[float] = None
    stock_quantity: int = 0
    sku: Optional[str] = None


class ProductVariantUpdate(BaseModel):
    name: Optional[str] = None
    option_values: Optional[dict] = None
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    sku: Optional[str] = None


class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = Field(gt=0)
    sale_price: Optional[float] = None
    sku: Optional[str] = None
    stock_quantity: int = 0
    category_id: Optional[uuid.UUID] = None
    tags: List[str] = []
    images: List[ProductImageCreate] = []


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    sale_price: Optional[float] = None
    sku: Optional[str] = None
    stock_quantity: Optional[int] = None
    category_id: Optional[uuid.UUID] = None
    tags: Optional[List[str]] = None
    status: Optional[ProductStatus] = None


class ProductOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    price: float
    sale_price: Optional[float] = None
    sku: Optional[str] = None
    stock_quantity: int
    status: ProductStatus
    category_id: Optional[uuid.UUID] = None
    tags: List[str] = []
    images: List[ProductImageOut] = []
    variants: List[ProductVariantOut] = []

    model_config = {"from_attributes": True}
