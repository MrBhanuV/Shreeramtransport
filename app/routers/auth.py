from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models.user import (
    RegistrationRequest,
    RegistrationStatus,
    User,
    UserModuleAccess,
    UserStatus,
)
from pydantic import BaseModel

from app.schemas.user import (
    LoginRequest,
    MeResponse,
    RegistrationRequestCreate,
    RegistrationRequestOut,
    TokenResponse,
    UserOut,
)


class ApprovalBody(BaseModel):
    """Optional module/section permission grants chosen by the admin at
    approval time -- mirrors the original UI's permission-editor step in
    the registration-approval modal (openRegistrationApprovalModal /
    srtCollectPermissions in the legacy JS)."""

    modules: dict[str, list[str]] = {}
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if user.status != UserStatus.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    token = create_access_token(user.email, {"role": user.role.value})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user)):
    return MeResponse(user=UserOut.model_validate(user), permissions=user.permissions)


@router.post(
    "/register-request", response_model=RegistrationRequestOut, status_code=status.HTTP_201_CREATED
)
def register_request(body: RegistrationRequestCreate, db: Session = Depends(get_db)):
    login_email = body.login_email.strip().lower()
    existing_user = db.query(User).filter(User.email == login_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    # Mirrors a check the original 100%-client-side app performed locally
    # (06-srt-registration-workflow-script.js::submitRegistrationRequest(),
    # against its own localStorage-cached request list): a second
    # registration request for an email that already has one Pending must
    # be rejected, not silently accepted as a duplicate row. Enforced here
    # server-side -- the single source of truth every browser/tab shares --
    # rather than only in a local cache, which would not catch two
    # different browsers/tabs submitting the same email concurrently.
    existing_pending = (
        db.query(RegistrationRequest)
        .filter(
            RegistrationRequest.login_email == login_email,
            RegistrationRequest.status == RegistrationStatus.pending,
        )
        .first()
    )
    if existing_pending:
        raise HTTPException(
            status_code=400,
            detail="A registration request for this login email is already pending.",
        )
    req = RegistrationRequest(
        name=body.name,
        login_email=login_email,
        personal_email=body.personal_email,
        phone=body.phone,
        aadhaar=body.aadhaar,
        designation=body.designation,
        department=body.department,
        employee_id=body.employee_id,
        location=body.location,
        password_hash=hash_password(body.password),
        current_address=body.current_address,
        permanent_address=body.permanent_address,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get("/registration-requests", response_model=list[RegistrationRequestOut])
def list_registration_requests(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    q = db.query(RegistrationRequest)
    if status_filter:
        q = q.filter(RegistrationRequest.status == status_filter)
    return q.order_by(RegistrationRequest.created_at.desc()).all()


@router.post("/registration-requests/{req_id}/approve", response_model=UserOut)
def approve_registration(
    req_id: int,
    body: ApprovalBody = ApprovalBody(),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    req = db.get(RegistrationRequest, req_id)
    if not req or req.status != RegistrationStatus.pending:
        raise HTTPException(status_code=404, detail="No pending registration request with that id")
    new_user = User(
        name=req.name,
        email=req.login_email,
        personal_email=req.personal_email,
        password_hash=req.password_hash,
        phone=req.phone,
        designation=req.designation,
        department=req.department,
        employee_id=req.employee_id,
        location=req.location,
        aadhaar=req.aadhaar,
        current_address=req.current_address,
        permanent_address=req.permanent_address,
    )
    db.add(new_user)
    req.status = RegistrationStatus.approved
    req.decided_at = datetime.now(timezone.utc)
    req.decided_by_id = admin.id
    db.commit()
    db.refresh(new_user)
    if body.modules:
        grant_default_permissions(db, new_user, body.modules)
    return new_user


@router.post("/registration-requests/{req_id}/reject", response_model=RegistrationRequestOut)
def reject_registration(
    req_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    req = db.get(RegistrationRequest, req_id)
    if not req or req.status != RegistrationStatus.pending:
        raise HTTPException(status_code=404, detail="No pending registration request with that id")
    req.status = RegistrationStatus.rejected
    req.decided_at = datetime.now(timezone.utc)
    req.decided_by_id = admin.id
    db.commit()
    db.refresh(req)
    return req


def grant_default_permissions(db: Session, user: User, modules: dict[str, list[str]]):
    for module_id, sections in modules.items():
        for section_id in sections:
            db.add(UserModuleAccess(user_id=user.id, module_id=module_id, section_id=section_id))
    db.commit()
