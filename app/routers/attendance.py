import calendar
import math
from datetime import date as date_cls
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_section
from app.models.attendance import (
    AttendanceHoliday,
    AttendanceRecord,
    AttendanceStaff,
)
from app.models.user import User
from app.schemas.attendance import (
    DayStatus,
    HolidayCreate,
    HolidayOut,
    SalaryRow,
    StaffCreate,
    StaffOut,
    StaffUpdate,
)

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])

view_staff = require_section("att", "staff")
manage_staff = require_section("att", "staff")
view_att = require_section("att", "attendance")
manage_att = require_section("att", "attendance")
view_salary = require_section("att", "salary")
view_calendar = require_section("att", "calendar")

VALID_STATUSES = {"Present", "WFH", "Absent", "Late", "Half-Day"}


@router.get("/staff", response_model=list[StaffOut])
def list_staff(db: Session = Depends(get_db), _user: User = Depends(view_staff)):
    return db.scalars(select(AttendanceStaff).order_by(AttendanceStaff.id)).all()


@router.post("/staff", response_model=StaffOut, status_code=201)
def create_staff(
    body: StaffCreate, db: Session = Depends(get_db), _user: User = Depends(manage_staff)
):
    if db.get(AttendanceStaff, body.id):
        raise HTTPException(status_code=409, detail=f"Staff id {body.id} already exists")
    obj = AttendanceStaff(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/staff/{staff_id}", response_model=StaffOut)
def update_staff(
    staff_id: str,
    body: StaffUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(manage_staff),
):
    obj = db.get(AttendanceStaff, staff_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Staff not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/staff/{staff_id}", status_code=204)
def delete_staff(
    staff_id: str, db: Session = Depends(get_db), _user: User = Depends(manage_staff)
):
    obj = db.get(AttendanceStaff, staff_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Staff not found")
    db.delete(obj)
    db.commit()
    return None


@router.get("/records", response_model=dict[str, DayStatus])
def get_day_records(
    date: str = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _user: User = Depends(view_att),
):
    rows = db.scalars(select(AttendanceRecord).where(AttendanceRecord.date == date)).all()
    return {r.staff_id: DayStatus(status=r.status.value, note=r.note) for r in rows}


@router.put("/records", response_model=dict[str, DayStatus])
def set_day_records(
    date: str = Query(..., description="YYYY-MM-DD"),
    body: dict[str, DayStatus] = ...,
    db: Session = Depends(get_db),
    _user: User = Depends(manage_att),
):
    for staff_id, day in body.items():
        if day.status not in VALID_STATUSES:
            raise HTTPException(status_code=422, detail=f"Invalid status '{day.status}'")
        existing = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.staff_id == staff_id, AttendanceRecord.date == date)
            .first()
        )
        if existing:
            existing.status = day.status
            existing.note = day.note
        else:
            db.add(AttendanceRecord(staff_id=staff_id, date=date, status=day.status, note=day.note))
    db.commit()
    rows = db.scalars(select(AttendanceRecord).where(AttendanceRecord.date == date)).all()
    return {r.staff_id: DayStatus(status=r.status.value, note=r.note) for r in rows}


@router.get("/holidays", response_model=list[HolidayOut])
def list_holidays(db: Session = Depends(get_db), _user: User = Depends(view_calendar)):
    return db.scalars(select(AttendanceHoliday).order_by(AttendanceHoliday.date)).all()


@router.post("/holidays", response_model=HolidayOut, status_code=201)
def create_holiday(
    body: HolidayCreate, db: Session = Depends(get_db), _user: User = Depends(manage_att)
):
    if db.get(AttendanceHoliday, body.date):
        raise HTTPException(status_code=409, detail="Holiday already set for that date")
    obj = AttendanceHoliday(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/holidays/{holiday_date}", status_code=204)
def delete_holiday(
    holiday_date: str, db: Session = Depends(get_db), _user: User = Depends(manage_att)
):
    obj = db.get(AttendanceHoliday, holiday_date)
    if not obj:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(obj)
    db.commit()
    return None


def _month_cutoff_day(year: int, month0: int) -> int:
    now = datetime.now(timezone.utc).date()
    first = date_cls(year, month0 + 1, 1)
    if first > now:
        return 0
    if year == now.year and month0 == now.month - 1:
        return now.day
    return calendar.monthrange(year, month0 + 1)[1]


def compute_salary(db: Session, staff: AttendanceStaff, year: int, month0: int) -> SalaryRow:
    end_day = _month_cutoff_day(year, month0)
    holidays = {
        h.date
        for h in db.scalars(
            select(AttendanceHoliday).where(
                AttendanceHoliday.date.like(f"{year}-{month0 + 1:02d}-%")
            )
        )
    }
    records = {
        r.date: r.status.value
        for r in db.scalars(
            select(AttendanceRecord).where(
                AttendanceRecord.staff_id == staff.id,
                AttendanceRecord.date.like(f"{year}-{month0 + 1:02d}-%"),
            )
        )
    }

    present = wfh = absent = late = half_day = working_days = sundays_count = holidays_count = 0
    for day in range(1, end_day + 1):
        key = f"{year}-{month0 + 1:02d}-{day:02d}"
        d = date_cls(year, month0 + 1, day)
        if key in holidays:
            holidays_count += 1
            continue
        if d.weekday() == 6:
            sundays_count += 1
            continue
        working_days += 1
        status = records.get(key, "")
        if status == "Present":
            present += 1
        elif status == "WFH":
            wfh += 1
        elif status == "Absent":
            absent += 1
        elif status == "Late":
            late += 1
        elif status == "Half-Day":
            half_day += 1

    monthly_salary = float(staff.monthly_salary or 0)
    daily_rate = monthly_salary / 30
    payable_days = present + wfh + late + (half_day * 0.5) + sundays_count + holidays_count
    wfh_deduction = wfh * 100
    gross_earned = daily_rate * payable_days
    final_salary = max(0.0, math.ceil(gross_earned - wfh_deduction)) if monthly_salary > 0 else 0.0

    return SalaryRow(
        staff_id=staff.id,
        name=staff.name,
        department=staff.department,
        designation=staff.designation,
        monthly_salary=monthly_salary,
        working_days=working_days,
        present=present,
        wfh=wfh,
        late=late,
        half_day=half_day,
        absent=absent,
        sundays=sundays_count,
        holidays=holidays_count,
        payable_days=payable_days,
        wfh_deduction=wfh_deduction,
        final_salary=final_salary,
    )


@router.get("/salary", response_model=list[SalaryRow])
def get_salary(
    year: int = Query(..., description="e.g. 2026"),
    month: int = Query(..., ge=1, le=12, description="1-12"),
    db: Session = Depends(get_db),
    _user: User = Depends(view_salary),
):
    staff_list = db.scalars(select(AttendanceStaff).where(AttendanceStaff.active.is_(True))).all()
    return [compute_salary(db, st, year, month - 1) for st in staff_list]
