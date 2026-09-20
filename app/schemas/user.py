from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    personal_email: str | None = None
    role: str
    status: str
    phone: str | None = None
    designation: str | None = None
    department: str | None = None
    employee_id: str | None = None
    location: str | None = None
    aadhaar: str | None = None
    current_address: str | None = None
    permanent_address: str | None = None
    photo_url: str | None = None
    can_manage_access: bool = False


class MeResponse(BaseModel):
    user: UserOut
    permissions: dict[str, list[str]]


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    personal_email: str | None = None
    role: str = "staff"
    status: str = "Active"
    phone: str | None = None
    designation: str | None = None
    department: str | None = None
    employee_id: str | None = None
    location: str | None = None
    aadhaar: str | None = None
    current_address: str | None = None
    permanent_address: str | None = None
    can_manage_access: bool = False
    modules: dict[str, list[str]] = {}


class UserUpdate(BaseModel):
    name: str | None = None
    password: str | None = None
    personal_email: str | None = None
    role: str | None = None
    status: str | None = None
    phone: str | None = None
    designation: str | None = None
    department: str | None = None
    employee_id: str | None = None
    location: str | None = None
    aadhaar: str | None = None
    current_address: str | None = None
    permanent_address: str | None = None
    can_manage_access: bool | None = None
    modules: dict[str, list[str]] | None = None


class RegistrationRequestCreate(BaseModel):
    name: str
    login_email: str
    personal_email: str | None = None
    phone: str | None = None
    aadhaar: str | None = None
    designation: str | None = None
    department: str | None = None
    employee_id: str | None = None
    location: str | None = None
    password: str
    current_address: str | None = None
    permanent_address: str | None = None


class RegistrationRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    login_email: str
    personal_email: str | None = None
    phone: str | None = None
    aadhaar: str | None = None
    designation: str | None = None
    department: str | None = None
    employee_id: str | None = None
    location: str | None = None
    current_address: str | None = None
    permanent_address: str | None = None
    status: str
    created_at: datetime
