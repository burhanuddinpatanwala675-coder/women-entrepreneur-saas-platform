import uuid
from typing import Optional, List

from pydantic import BaseModel


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    icon: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    sort_order: int

    model_config = {"from_attributes": True}


class CategoryTreeOut(CategoryOut):
    children: List["CategoryOut"] = []


class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
