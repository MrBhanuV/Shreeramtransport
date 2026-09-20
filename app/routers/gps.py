import random
import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_section
from app.models.gps import GPSRecord
from app.models.user import User
from app.schemas.gps import GPSRecordCreate, GPSRecordOut, GPSRecordUpdate

router = APIRouter(prefix="/api/gps", tags=["GPS"])

view_dep = require_section("gps", "view")
manage_dep = require_section("gps", "manage")


def _new_id() -> str:
    return f"g{int(time.time() * 1000)}{random.randint(1000, 9999)}"


@router.get("", response_model=list[GPSRecordOut])
def list_gps(db: Session = Depends(get_db), _user: User = Depends(view_dep)):
    return db.scalars(select(GPSRecord).order_by(GPSRecord.date_issued.desc())).all()


@router.get("/{record_id}", response_model=GPSRecordOut)
def get_gps(record_id: str, db: Session = Depends(get_db), _user: User = Depends(view_dep)):
    obj = db.get(GPSRecord, record_id)
    if not obj:
        raise HTTPException(status_code=404, detail="GPS record not found")
    return obj


@router.post("", response_model=GPSRecordOut, status_code=201)
def create_gps(
    body: GPSRecordCreate, db: Session = Depends(get_db), user: User = Depends(manage_dep)
):
    obj = GPSRecord(id=_new_id(), created_by_id=user.id, **body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{record_id}", response_model=GPSRecordOut)
def update_gps(
    record_id: str,
    body: GPSRecordUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(manage_dep),
):
    obj = db.get(GPSRecord, record_id)
    if not obj:
        raise HTTPException(status_code=404, detail="GPS record not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{record_id}", status_code=204)
def delete_gps(
    record_id: str, db: Session = Depends(get_db), _user: User = Depends(manage_dep)
):
    obj = db.get(GPSRecord, record_id)
    if not obj:
        raise HTTPException(status_code=404, detail="GPS record not found")
    db.delete(obj)
    db.commit()
    return None
