import enum
import uuid

from sqlalchemy import Enum, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import UUIDPKMixin


class MemberRole(str, enum.Enum):
    owner = "owner"
    staff = "staff"


class BusinessMember(UUIDPKMixin, Base):
    __tablename__ = "business_members"

    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[MemberRole] = mapped_column(Enum(MemberRole, name="member_role"), default=MemberRole.owner)
    created_at: Mapped["DateTime"] = mapped_column(DateTime(timezone=True), server_default=func.now())
