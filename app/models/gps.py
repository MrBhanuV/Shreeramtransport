from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import CreatedByMixin, TimestampMixin


class GPSRecord(TimestampMixin, CreatedByMixin, Base):
    __tablename__ = "gps_records"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    gps_id: Mapped[str | None] = mapped_column(String(60))
    date_issued: Mapped[str | None] = mapped_column(String(30))
    vehicle_number: Mapped[str | None] = mapped_column(String(30))
    gps_type: Mapped[str | None] = mapped_column(String(60))
    gps_amount: Mapped[str | None] = mapped_column(String(30))
    gps_return: Mapped[str | None] = mapped_column(String(30))
    return_date: Mapped[str | None] = mapped_column(String(30))
    amount_return: Mapped[str | None] = mapped_column(String(30))
    late_fee: Mapped[str | None] = mapped_column(String(30))
    balance_due: Mapped[str | None] = mapped_column(String(30))
    owner: Mapped[str | None] = mapped_column(String(120))
    mobile: Mapped[str | None] = mapped_column(String(20))
    remark: Mapped[str | None] = mapped_column(Text)
