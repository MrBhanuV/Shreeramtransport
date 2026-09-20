from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.table_registry import TABLE_SPECS


class DuplicateError(Exception):
    pass


def list_rows(db: Session, module_id: str, skip: int = 0, limit: int = 500):
    spec = TABLE_SPECS[module_id]
    stmt = select(spec.model).order_by(spec.model.id).offset(skip).limit(limit)
    return db.scalars(stmt).all()


def count_rows(db: Session, module_id: str) -> int:
    spec = TABLE_SPECS[module_id]
    return db.query(spec.model).count()


def get_row(db: Session, module_id: str, row_id: int):
    spec = TABLE_SPECS[module_id]
    return db.get(spec.model, row_id)


def create_row(db: Session, module_id: str, data: dict, created_by_id: int | None):
    spec = TABLE_SPECS[module_id]
    payload = {k: v for k, v in data.items() if k in spec.fields}
    obj = spec.model(**payload)
    if hasattr(obj, "created_by_id"):
        obj.created_by_id = created_by_id
    db.add(obj)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise DuplicateError(str(e.orig)) from e
    db.refresh(obj)
    return obj


def update_row(db: Session, module_id: str, row_id: int, data: dict):
    spec = TABLE_SPECS[module_id]
    obj = db.get(spec.model, row_id)
    if obj is None:
        return None
    for k, v in data.items():
        if k in spec.fields and v is not None:
            setattr(obj, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise DuplicateError(str(e.orig)) from e
    db.refresh(obj)
    return obj


def delete_row(db: Session, module_id: str, row_id: int) -> bool:
    spec = TABLE_SPECS[module_id]
    obj = db.get(spec.model, row_id)
    if obj is None:
        return False
    db.delete(obj)
    db.commit()
    return True


def delete_all_rows(db: Session, module_id: str) -> int:
    """Delete all rows from a table. Returns count of deleted rows."""
    spec = TABLE_SPECS[module_id]
    count = db.query(spec.model).count()
    db.query(spec.model).delete()
    db.commit()
    return count
