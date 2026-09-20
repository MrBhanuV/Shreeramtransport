"""Seed logic shared by tests, local dev bootstrap, and the Docker
entrypoint. Reads the JSON files harvested straight from the original app's
JS so the demo data is identical to what the original prototype shipped
with, then creates the default admin account with full permissions."""
import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.attendance import AttendanceStaff, PayrollMonthly
from app.models.gps import GPSRecord
from app.models.simple_tables import CompanyPayment, Expense, FreightRate, Invoice, Payment
from app.models.user import User, UserModuleAccess, UserRole, UserStatus
from app.security import hash_password
from app.table_registry import TABLE_SPECS

SEED_DIR = Path(__file__).resolve().parent.parent / "db" / "seed"

DEFAULT_ADMIN_EMAIL = "srt.jspl@gmail.com"
DEFAULT_ADMIN_PASSWORD = "Srt@jspl2026"  # noqa: S105 -- original app's own default seed password

ALL_MODULES = {
    "inv": ["view", "manage", "transfer"],
    "pay": ["view", "manage", "transfer"],
    "cp": ["view", "manage", "transfer"],
    "rp": ["view", "manage", "transfer"],
    "gps": ["view", "manage", "transfer"],
    "att": ["attendance", "staff", "calendar", "salary"],
    "exp": ["view", "manage", "transfer"],
    "fr": ["view", "manage", "transfer"],
}

_LABELS = {
    "inv": {
        "sr_no": "Sr. No.", "invoice_no": "Invoice no.", "invoice_date": "Invoice date",
        "loading_date": "Loading Date", "unloading_date": "Unloading Date", "lrn": "L. R. N.",
        "vehicle": "Vehicle", "mt": "MT", "trader_name": "Trader Name",
        "destination_city": "Destination City", "do_number": "DO Number",
        "pahuch_status": "Pahuch Status", "invoice_status": "Invoice Status",
        "pahuch_upload_status": "Pahuch Upload Status",
        "invoice_upload_status": "Invoice Upload Status", "vehicle_type": "Vehicle Type",
        "company_freight": "Company Frieght", "company_total_amount": "Company Total Amount",
        "gst_18": "18% GST", "bill_amount": "Bill Amount", "received_amount": "Recieved Amount",
        "remark": "Remark",
    },
    "pay": {
        "sr_no": "Sr. No.", "payment_voucher_status": "Payment voucher status",
        "loading_date": "Loading Date", "unloading_date": "Unloading Date", "lrn": "L. R. N.",
        "vehicle": "Vehicle", "mt": "MT", "trader_name": "Trader Name",
        "destination_city": "Destination City", "freight": "Frieght",
        "total_amount": "Total Amount", "do_number": "DO Number",
        "payment_status": "Payment Status", "payment_mode_advance": "Payment Mode Advance",
        "payment_advance_amt": "Payment Advance AMT",
        "payment_date_advance": "Payment Date Advance",
        "payment_mode_final": "Payment Mode Final", "payment_final_amt": "Payment Final AMT",
        "payment_date_final": "Payment Date Final2",
        "payment_image_link_advance": "Payment Image Link Advance",
        "payment_image_link_final": "Payment Image Link Final",
        "company_charges": "Company Charges", "gps_charges": "GPS Charges",
        "party_difference": "Party Difference", "difference_amount": "Diffrence Amount",
        "company_freight": "Company Frieght", "company_total_amount": "Company Total Amount",
        "gst_18": "18% GST", "bill_amount": "Bill Amount", "received_amount": "Recieved Amount",
    },
    "cp": {
        "sr_no": "Sr. No.", "invoice_no": "Invoice No.", "lrn": "L. R. N.", "vehicle": "Vehicle",
        "mt": "MT", "trader_name": "Trader Name", "destination_city": "Destination City",
        "do_number": "DO Number", "freight": "Freight", "amount": "Amount",
        "gst_18": "GST 18%", "total_amount": "Total Amount", "submit_status": "Submit Status",
        "remark": "Remark",
    },
    "exp": {"name": "Name", "date": "Date", "expense": "Expense", "remark": "Remark"},
    "fr": {"destination": "destination", "rate": "rate"},
}


def _load_json(name: str):
    path = SEED_DIR / f"{name}.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _import_simple(db: Session, module_id: str, json_name: str, model):
    labels = _LABELS[module_id]
    rows = _load_json(json_name)
    for raw in rows:
        kwargs = {}
        for field, label in labels.items():
            value = raw.get(label)
            kwargs[field] = None if value in (None, "") else str(value)
        db.add(model(**kwargs))


def seed_admin(db: Session) -> User:
    existing = db.query(User).filter(User.email == DEFAULT_ADMIN_EMAIL).first()
    if existing:
        return existing
    admin = User(
        name="SRT Admin",
        email=DEFAULT_ADMIN_EMAIL,
        password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
        role=UserRole.admin,
        status=UserStatus.active,
        designation="Administrator",
        department="Administration",
        can_manage_access=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    for module_id, sections in ALL_MODULES.items():
        for section_id in sections:
            db.add(UserModuleAccess(user_id=admin.id, module_id=module_id, section_id=section_id))
    db.commit()
    return admin


def seed_demo_data(db: Session) -> None:
    if db.query(Invoice).first() is not None:
        return

    _import_simple(db, "inv", "INIT_INV", Invoice)
    _import_simple(db, "pay", "INIT_PAY", Payment)
    _import_simple(db, "cp", "INIT_CP", CompanyPayment)
    _import_simple(db, "exp", "INIT_EXP", Expense)
    db.commit()

    for row in _load_json("INIT_FR"):
        db.add(FreightRate(destination=row["destination"], rate=str(row["rate"])))
    db.commit()

    for row in _load_json("MONTHLY"):
        db.add(PayrollMonthly(month=row["month"], advance=row["advance"], final=row["final"]))
    db.commit()

    import random
    import time

    for i, row in enumerate(_load_json("INIT_GPS")):
        rid = f"g{int(time.time() * 1000)}{random.randint(1000, 9999)}{i}"
        db.add(
            GPSRecord(
                id=rid,
                gps_id=row.get("GPS ID"),
                vehicle_number=row.get("Vehicle number"),
                owner=row.get("Owner no") if row.get("Owner no") != "-" else None,
                mobile=row.get("mobile"),
            )
        )
    db.commit()

    staff_seed = [
        {"id": "SRT001", "name": "Junaid Mansuri", "department": "Management", "designation": "Manager"},
        {"id": "SRT002", "name": "Amit Kumar", "department": "Finance", "designation": "Accountant"},
        {"id": "SRT003", "name": "Vikash Kumar", "department": "Operations", "designation": "Supervisor"},
        {"id": "SRT004", "name": "Maqsood Ali", "department": "HR", "designation": "HR Executive"},
        {"id": "SRT005", "name": "Nandini Gokhe", "department": "Admin", "designation": "Coordinator"},
        {"id": "SRT006", "name": "Arvind Jatav", "department": "Operations", "designation": "Driver"},
    ]
    for s in staff_seed:
        db.add(AttendanceStaff(**s, monthly_salary=0))
    db.commit()


def seed_all(db: Session) -> None:
    seed_admin(db)
    seed_demo_data(db)


assert set(TABLE_SPECS.keys()) >= {"inv", "pay", "cp", "exp", "fr"}
