from pydantic import BaseModel, ConfigDict


class GPSRecordBase(BaseModel):
    gps_id: str | None = None
    date_issued: str | None = None
    vehicle_number: str | None = None
    gps_type: str | None = None
    gps_amount: str | None = None
    gps_return: str | None = None
    return_date: str | None = None
    amount_return: str | None = None
    late_fee: str | None = None
    balance_due: str | None = None
    owner: str | None = None
    mobile: str | None = None
    remark: str | None = None


class GPSRecordCreate(GPSRecordBase):
    pass


class GPSRecordUpdate(GPSRecordBase):
    pass


class GPSRecordOut(GPSRecordBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
