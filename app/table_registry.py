"""
Single source of truth describing the 8 "simple table" modules that all
share the exact same CRUD shape. Field lists mirror the original app's
`COLS` object 1:1.
"""
from dataclasses import dataclass

from app.models.simple_tables import (
    CompanyPayment,
    Expense,
    FreightRate,
    Invoice,
    Payment,
    ReceivedPayment,
    Trader,
    Vehicle,
)


@dataclass(frozen=True)
class TableSpec:
    module_id: str
    label: str
    model: type
    fields: tuple[str, ...]


TABLE_SPECS: dict[str, TableSpec] = {
    "inv": TableSpec(
        module_id="inv",
        label="Invoice",
        model=Invoice,
        fields=(
            "sr_no", "invoice_no", "invoice_date", "loading_date", "unloading_date",
            "lrn", "vehicle", "mt", "trader_name", "destination_city", "do_number",
            "pahuch_status", "invoice_status", "pahuch_upload_status",
            "invoice_upload_status", "vehicle_type", "company_freight",
            "company_total_amount", "gst_18", "bill_amount", "received_amount", "remark",
        ),
    ),
    "pay": TableSpec(
        module_id="pay",
        label="Payment",
        model=Payment,
        fields=(
            "sr_no", "payment_voucher_status", "loading_date", "unloading_date", "lrn",
            "vehicle", "mt", "trader_name", "destination_city", "freight",
            "total_amount", "do_number", "payment_status", "payment_mode_advance",
            "payment_advance_amt", "payment_date_advance", "payment_mode_final",
            "payment_final_amt", "payment_date_final", "payment_image_link_advance",
            "payment_image_link_final", "company_charges", "gps_charges",
            "party_difference", "difference_amount", "company_freight",
            "company_total_amount", "gst_18", "bill_amount", "received_amount",
        ),
    ),
    "cp": TableSpec(
        module_id="cp",
        label="Company Payment",
        model=CompanyPayment,
        fields=(
            "sr_no", "invoice_no", "lrn", "vehicle", "mt", "trader_name",
            "destination_city", "do_number", "freight", "amount", "gst_18",
            "total_amount", "submit_status", "remark",
        ),
    ),
    "rp": TableSpec(
        module_id="rp",
        label="Received Payment",
        model=ReceivedPayment,
        fields=(
            "sr_no", "invoice_number", "loading_date", "vehicle_number", "lrn", "mt",
            "trader_name", "city", "do_number", "invoice_amount", "received_amount",
            "received_date", "remaining_amount",
        ),
    ),
    "exp": TableSpec(
        module_id="exp",
        label="Expense",
        model=Expense,
        fields=("name", "date", "expense", "remark"),
    ),
    "fr": TableSpec(
        module_id="fr",
        label="Freight Rate",
        model=FreightRate,
        fields=("destination", "rate"),
    ),
    "trader": TableSpec(
        module_id="trader",
        label="Trader",
        model=Trader,
        fields=(
            "sr_no", "trader_name", "contact_person", "mobile_number",
            "alternate_mobile", "email", "city", "state", "gst_number", "address",
            "remark",
        ),
    ),
    "vehicle": TableSpec(
        module_id="vehicle",
        label="Vehicle",
        model=Vehicle,
        fields=(
            "sr_no", "vehicle_number", "truck_type", "owner_name", "owner_mobile",
            "alternate_mobile", "driver_name", "driver_mobile", "city", "state",
            "rc_number", "pan_number", "aadhaar_number", "rc_image_path", "remark",
        ),
    ),
}
