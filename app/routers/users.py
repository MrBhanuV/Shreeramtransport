from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models.user import User, UserModuleAccess
from app.routers.auth import grant_default_permissions
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.security import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return db.query(User).order_by(User.id).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)
):
    if db.query(User).filter(User.email == body.email.strip().lower()).first():
        raise HTTPException(status_code=400, detail="Email already in use")
    user = User(
        name=body.name,
        email=body.email.strip().lower(),
        personal_email=body.personal_email,
        password_hash=hash_password(body.password),
        role=body.role,
        status=body.status,
        phone=body.phone,
        designation=body.designation,
        department=body.department,
        employee_id=body.employee_id,
        location=body.location,
        aadhaar=body.aadhaar,
        current_address=body.current_address,
        permanent_address=body.permanent_address,
        can_manage_access=body.can_manage_access,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    if body.modules:
        grant_default_permissions(db, user, body.modules)
    return user


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data = body.model_dump(exclude_unset=True, exclude={"password", "modules"})
    for k, v in data.items():
        setattr(user, k, v)
    if body.password:
        user.password_hash = hash_password(body.password)
    if body.modules is not None:
        db.query(UserModuleAccess).filter(UserModuleAccess.user_id == user.id).delete()
        db.commit()
        grant_default_permissions(db, user, body.modules)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return None
