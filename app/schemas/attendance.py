from pydantic import BaseModel, ConfigDict


class StaffBase(BaseModel):
    name: str
    department: str | None = None
    designation: str | None = None
    monthly_salary: float = 0
    active: bool = True


class StaffCreate(StaffBase):
    id: str


class StaffUpdate(BaseModel):
    name: str | None = None
    department: str | None = None
    designation: str | None = None
    monthly_salary: float | None = None
    active: bool | None = None


class StaffOut(StaffBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


class DayStatus(BaseModel):
    status: str
    note: str | None = None


class HolidayCreate(BaseModel):
    date: str
    name: str = "Company Holiday"


class HolidayOut(HolidayCreate):
    model_config = ConfigDict(from_attributes=True)


class SalaryRow(BaseModel):
    staff_id: str
    name: str
    department: str | None
    designation: str | None
    monthly_salary: float
    working_days: int
    present: int
    wfh: int
    late: int
    half_day: int
    absent: int
    sundays: int
    holidays: int
    payable_days: float
    wfh_deduction: float
    final_salary: float
