from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.attendance import AttendanceStaff
from app.models.gps import GPSRecord
from app.models.simple_tables import CompanyPayment, Expense, FreightRate, Invoice, Payment
from app.models.user import User

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def _num(value) -> float:
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return 0.0


@router.get("/kpi")
def kpi(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    invoices = db.query(Invoice).all()
    payments = db.query(Payment).all()
    company_payments = db.query(CompanyPayment).all()
    expenses = db.query(Expense).all()

    return {
        "inv_total": len(invoices),
        "pay_total": len(payments),
        "pay_complete": sum(1 for p in payments if p.payment_status == "Complete"),
        "pay_pending": sum(1 for p in payments if p.payment_status == "Pending"),
        "pay_advance": sum(1 for p in payments if p.payment_mode_advance not in (None, "-", "")),
        "cp_total": len(company_payments),
        "cp_complete": sum(1 for c in company_payments if c.submit_status == "Complete"),
        "gps_total": db.query(GPSRecord).count(),
        "exp_total": sum(_num(e.expense) for e in expenses),
        "exp_count": len(expenses),
        "fr_total": db.query(FreightRate).count(),
        "att_total": db.query(AttendanceStaff).count(),
    }
