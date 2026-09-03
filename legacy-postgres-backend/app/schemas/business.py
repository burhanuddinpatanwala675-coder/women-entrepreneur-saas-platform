import uuid
from typing import Optional

from pydantic import BaseModel

from app.models.business import BusinessStatus, BusinessTemplate


class BusinessCreate(BaseModel):
    name: str
    short_description: Optional[str] = None
    category_id: uuid.UUID


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    short_description: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    logo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    whatsapp_number: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    social_links: Optional[dict] = None
    template: Optional[BusinessTemplate] = None


class BusinessOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    short_description: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    logo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    whatsapp_number: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    social_links: dict = {}
    template: BusinessTemplate
    status: BusinessStatus
    onboarding_step: int
    storefront_path: str = ""

    model_config = {"from_attributes": True}


class StoreSettingsOut(BaseModel):
    template: str
    accent_color: str
    show_search: bool
    show_filters: bool
    cod_enabled: bool
    manual_payment_instructions: Optional[str] = None
    announcement_banner: Optional[str] = None

    model_config = {"from_attributes": True}


class StoreSettingsUpdate(BaseModel):
    template: Optional[str] = None
    accent_color: Optional[str] = None
    show_search: Optional[bool] = None
    show_filters: Optional[bool] = None
    cod_enabled: Optional[bool] = None
    manual_payment_instructions: Optional[str] = None
    announcement_banner: Optional[str] = None
