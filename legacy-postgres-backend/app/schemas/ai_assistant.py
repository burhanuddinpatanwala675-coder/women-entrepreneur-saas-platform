from typing import Optional, List

from pydantic import BaseModel


class AIStatusOut(BaseModel):
    configured: bool
    provider: str
    message: str


class ProductContentRequest(BaseModel):
    product_name: Optional[str] = None
    category: Optional[str] = None
    keywords: Optional[str] = None


class ProductContentOut(BaseModel):
    title: str
    description: str
    tags: List[str]
    social_caption: str
