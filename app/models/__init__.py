"""Import every model module so Base.metadata is fully populated."""
from app.models.attendance import (  # noqa: F401
    AttendanceHoliday,
    AttendanceRecord,
    AttendanceStaff,
    PayrollMonthly,
)
from app.models.gps import GPSRecord  # noqa: F401
from app.models.simple_tables import (  # noqa: F401
    CompanyPayment,
    Expense,
    FreightRate,
    Invoice,
    Payment,
    ReceivedPayment,
    Trader,
    Vehicle,
)
from app.models.user import (  # noqa: F401
    RegistrationRequest,
    User,
    UserModuleAccess,
)
