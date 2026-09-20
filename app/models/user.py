from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, PyEnum):
    admin = "admin"
    staff = "staff"


class UserStatus(str, PyEnum):
    active = "Active"
    disabled = "Disabled"


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(190), unique=True, index=True, nullable=False)
    personal_email: Mapped[str | None] = mapped_column(String(190), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.staff, nullable=False)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus), default=UserStatus.active, nullable=False
    )
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    employee_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    location: Mapped[str | None] = mapped_column(String(150), nullable=True)
    aadhaar: Mapped[str | None] = mapped_column(String(20), nullable=True)
    current_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    permanent_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    can_manage_access: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    access_grants: Mapped[list["UserModuleAccess"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def permissions(self) -> dict[str, list[str]]:
        out: dict[str, list[str]] = {}
        for grant in self.access_grants:
            out.setdefault(grant.module_id, []).append(grant.section_id)
        return out

    def has_section(self, module_id: str, section_id: str) -> bool:
        if self.role == UserRole.admin:
            return True
        return section_id in self.permissions.get(module_id, [])


class UserModuleAccess(Base):
    __tablename__ = "user_module_access"
    __table_args__ = (UniqueConstraint("user_id", "module_id", "section_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    module_id: Mapped[str] = mapped_column(String(30), nullable=False)
    section_id: Mapped[str] = mapped_column(String(30), nullable=False)

    user: Mapped[User] = relationship(back_populates="access_grants")


class RegistrationStatus(str, PyEnum):
    pending = "Pending"
    approved = "Approved"
    rejected = "Rejected"


class RegistrationRequest(Base):
    __tablename__ = "registration_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    login_email: Mapped[str] = mapped_column(String(190), nullable=False)
    personal_email: Mapped[str | None] = mapped_column(String(190), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    aadhaar: Mapped[str | None] = mapped_column(String(20), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    employee_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    location: Mapped[str | None] = mapped_column(String(150), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    current_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    permanent_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[RegistrationStatus] = mapped_column(
        Enum(RegistrationStatus), default=RegistrationStatus.pending, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    decided_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
