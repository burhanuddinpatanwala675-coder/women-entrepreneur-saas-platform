import uuid
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator

from app.models.user import UserRole


class SignupRequest(BaseModel):
    full_name: str
    password: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_len(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("phone")
    @classmethod
    def require_contact(cls, v, info):
        return v


class LoginRequest(BaseModel):
    identifier: str  # email or phone
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    has_business: bool = False

    model_config = {"from_attributes": True}
