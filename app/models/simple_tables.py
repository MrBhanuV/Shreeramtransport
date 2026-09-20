"""
The 8 "simple table" modules. All business-data columns are stored as
String, mirroring the original SPA exactly (every value there was a plain
JSON string, including "-" sentinels for "not entered yet"). Aggregations
parse these strings defensively at read-time, exactly like the original
client-side JS did.
"""
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import CreatedByMixin, TimestampMixin


class Invoice(TimestampMixin, CreatedByMixin, Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    sr_no: Mapped[str | None] = mapped_column(String(20))
    invoice_no: Mapped[str | None] = mapped_column(String(50))
    invoice_date: Mapped[str | None] = mapped_column(String(30))
    loading_date: Mapped[str | None] = mapped_column(String(30))
    unloading_date: Mapped[str | None] = mapped_column(String(30))
    lrn: Mapped[str | None] = mapped_column(String(50))
    vehicle: Mapped[str | None] = mapped_column(String(30))
    mt: Mapped[str | None] = mapped_column(String(20))
    trader_name: Mapped[str | None] = mapped_column(String(150))
    destination_city: Mapped[str | None] = mapped_column(String(120))
    do_number: Mapped[str | None] = mapped_column(String(150))
    pahuch_status: Mapped[str | None] = mapped_column(String(60))
    invoice_status: Mapped[str | None] = mapped_column(String(60))
    pahuch_upload_status: Mapped[str | None] = mapped_column(String(60))
    invoice_upload_status: Mapped[str | None] = mapped_column(String(60))
    vehicle_type: Mapped[str | None] = mapped_column(String(60))
    company_freight: Mapped[str | None] = mapped_column(String(30))
    company_total_amount: Mapped[str | None] = mapped_column(String(30))
    gst_18: Mapped[str | None] = mapped_column(String(30))
    bill_amount: Mapped[str | None] = mapped_column(String(30))
    received_amount: Mapped[str | None] = mapped_column(String(30))
    remark: Mapped[str | None] = mapped_column(Text)


class Payment(TimestampMixin, CreatedByMixin, Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    sr_no: Mapped[str | None] = mapped_column(String(20))
    payment_voucher_status: Mapped[str | None] = mapped_column(String(60))
    loading_date: Mapped[str | None] = mapped_column(String(30))
    unloading_date: Mapped[str | None] = mapped_column(String(30))
    lrn: Mapped[str | None] = mapped_column(String(50))
    vehicle: Mapped[str | None] = mapped_column(String(30))
    mt: Mapped[str | None] = mapped_column(String(20))
    trader_name: Mapped[str | None] = mapped_column(String(150))
    destination_city: Mapped[str | None] = mapped_column(String(120))
    freight: Mapped[str | None] = mapped_column(String(30))
    total_amount: Mapped[str | None] = mapped_column(String(30))
    do_number: Mapped[str | None] = mapped_column(String(150))
    payment_status: Mapped[str | None] = mapped_column(String(60))
    payment_mode_advance: Mapped[str | None] = mapped_column(String(60))
    payment_advance_amt: Mapped[str | None] = mapped_column(String(30))
    payment_date_advance: Mapped[str | None] = mapped_column(String(30))
    payment_mode_final: Mapped[str | None] = mapped_column(String(60))
    payment_final_amt: Mapped[str | None] = mapped_column(String(30))
    payment_date_final: Mapped[str | None] = mapped_column(String(30))
    payment_image_link_advance: Mapped[str | None] = mapped_column(String(500))
    payment_image_link_final: Mapped[str | None] = mapped_column(String(500))
    company_charges: Mapped[str | None] = mapped_column(String(30))
    gps_charges: Mapped[str | None] = mapped_column(String(30))
    party_difference: Mapped[str | None] = mapped_column(String(30))
    difference_amount: Mapped[str | None] = mapped_column(String(30))
    company_freight: Mapped[str | None] = mapped_column(String(30))
    company_total_amount: Mapped[str | None] = mapped_column(String(30))
    gst_18: Mapped[str | None] = mapped_column(String(30))
    bill_amount: Mapped[str | None] = mapped_column(String(30))
    received_amount: Mapped[str | None] = mapped_column(String(30))


class CompanyPayment(TimestampMixin, CreatedByMixin, Base):
    __tablename__ = "company_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    sr_no: Mapped[str | None] = mapped_column(String(20))
    invoice_no: Mapped[str | None] = mapped_column(String(50))
    lrn: Mapped[str | None] = mapped_column(String(50))
    vehicle: Mapped[str | None] = mapped_column(String(30))
    mt: Mapped[str | None] = mapped_column(String(20))
    trader_name: Mapped[str | None] = mapped_column(String(150))
    destination_city: Mapped[str | None] = mapped_column(String(120))
    do_number: Mapped[str | None] = mapped_column(String(150))
    freight: Mapped[str | None] = mapped_column(String(30))
    amount: Mapped[str | None] = mapped_column(String(30))
    gst_18: Mapped[str | None] = mapped_column(String(30))
    total_amount: Mapped[str | None] = mapped_column(String(30))
    submit_status: Mapped[str | None] = mapped_column(String(60))
    remark: Mapped[str | None] = mapped_column(Text)


class ReceivedPayment(TimestampMixin, CreatedByMixin, Base):
    __tablename__ = "received_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    sr_no: Mapped[str | None] = mapped_column(String(20))
    invoice_number: Mapped[str | None] = mapped_column(String(50))
    loading_date: Mapped[str | None] = mapped_column(String(30))
    vehicle_number: Mapped[str | None] = mapped_column(String(30))
    lrn: Mapped[str | None] = mapped_column(String(50))
    mt: Mapped[str | None] = mapped_column(String(20))
    trader_name: Mapped[str | None] = mapped_column(String(150))
    city: Mapped[str | None] = mapped_column(String(120))
    do_number: Mapped[str | None] = mapped_column(String(150))
    invoice_amount: Mapped[str | None] = mapped_column(String(30))
    received_amount: Mapped[str | None] = mapped_column(String(30))
    received_date: Mapped[str | None] = mapped_column(String(30))
    remaining_amount: Mapped[str | None] = mapped_column(String(30))


class Expense(TimestampMixin, CreatedByMixin, Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str | None] = mapped_column(String(120))
    date: Mapped[str | None] = mapped_column(String(30))
    expense: Mapped[str | None] = mapped_column(String(30))
    remark: Mapped[str | None] = mapped_column(Text)


class FreightRate(TimestampMixin, CreatedByMixin, Base):
    __tablename__ = "freight_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    destination: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    rate: Mapped[str | None] = mapped_column(String(30))


class Trader(TimestampMixin, CreatedByMixin, Base):
    __tablename__ = "traders"

    id: Mapped[int] = mapped_column(primary_key=True)
    sr_no: Mapped[str | None] = mapped_column(String(20))
    trader_name: Mapped[str | None] = mapped_column(String(150))
    contact_person: Mapped[str | None] = mapped_column(String(120))
    mobile_number: Mapped[str | None] = mapped_column(String(20))
    alternate_mobile: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(190))
    city: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(120))
    gst_number: Mapped[str | None] = mapped_column(String(30))
    address: Mapped[str | None] = mapped_column(String(255))
    remark: Mapped[str | None] = mapped_column(Text)


class Vehicle(TimestampMixin, CreatedByMixin, Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    sr_no: Mapped[str | None] = mapped_column(String(20))
    vehicle_number: Mapped[str | None] = mapped_column(String(30))
    truck_type: Mapped[str | None] = mapped_column(String(60))
    owner_name: Mapped[str | None] = mapped_column(String(120))
    owner_mobile: Mapped[str | None] = mapped_column(String(20))
    alternate_mobile: Mapped[str | None] = mapped_column(String(20))
    driver_name: Mapped[str | None] = mapped_column(String(120))
    driver_mobile: Mapped[str | None] = mapped_column(String(20))
    city: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(120))
    rc_number: Mapped[str | None] = mapped_column(String(30))
    pan_number: Mapped[str | None] = mapped_column(String(20))
    aadhaar_number: Mapped[str | None] = mapped_column(String(20))
    rc_image_path: Mapped[str | None] = mapped_column(String(255))
    remark: Mapped[str | None] = mapped_column(Text)
