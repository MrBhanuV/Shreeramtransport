from enum import Enum as PyEnum

from sqlalchemy import Enum, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import TimestampMixin


class AttendanceStatus(str, PyEnum):
    present = "Present"
    wfh = "WFH"
    absent = "Absent"
    late = "Late"
    half_day = "Half-Day"


class AttendanceStaff(TimestampMixin, Base):
    __tablename__ = "attendance_staff"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    department: Mapped[str | None] = mapped_column(String(80))
    designation: Mapped[str | None] = mapped_column(String(120))
    monthly_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    active: Mapped[bool] = mapped_column(default=True)


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("staff_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    staff_id: Mapped[str] = mapped_column(ForeignKey("attendance_staff.id"), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[AttendanceStatus] = mapped_column(Enum(AttendanceStatus), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)


class AttendanceHoliday(Base):
    __tablename__ = "attendance_holidays"

    date: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(150), default="Company Holiday")


class PayrollMonthly(Base):
    __tablename__ = "payroll_monthly"

    month: Mapped[str] = mapped_column(String(20), primary_key=True)
    advance: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    final: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
