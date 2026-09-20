from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud import generic as crud
from app.crud.generic import DuplicateError
from app.database import get_db
from app.deps import require_admin, require_section
from app.models.user import User
from app.schemas.generic_table import get_schemas
from app.table_registry import TABLE_SPECS


def build_router(module_id: str, url_prefix: str) -> APIRouter:
    spec = TABLE_SPECS[module_id]
    CreateSchema, UpdateSchema, OutSchema = get_schemas(module_id)
    router = APIRouter(prefix=url_prefix, tags=[spec.label])

    view_dep = require_section(module_id, "view")
    manage_dep = require_section(module_id, "manage")

    @router.get("", response_model=list[OutSchema])
    def list_items(
        skip: int = 0,
        limit: int = 500,
        db: Session = Depends(get_db),
        _user: User = Depends(view_dep),
    ):
        return crud.list_rows(db, module_id, skip, limit)

    @router.get("/{item_id}", response_model=OutSchema)
    def get_item(item_id: int, db: Session = Depends(get_db), _user: User = Depends(view_dep)):
        obj = crud.get_row(db, module_id, item_id)
        if obj is None:
            raise HTTPException(status_code=404, detail=f"{spec.label} {item_id} not found")
        return obj

    @router.post("", response_model=OutSchema, status_code=201)
    def create_item(
        body: CreateSchema,
        db: Session = Depends(get_db),
        user: User = Depends(manage_dep),
    ):
        try:
            return crud.create_row(db, module_id, body.model_dump(), user.id)
        except DuplicateError as e:
            raise HTTPException(status_code=409, detail=str(e)) from e

    @router.put("/{item_id}", response_model=OutSchema)
    def update_item(
        item_id: int,
        body: UpdateSchema,
        db: Session = Depends(get_db),
        _user: User = Depends(manage_dep),
    ):
        try:
            obj = crud.update_row(db, module_id, item_id, body.model_dump(exclude_unset=True))
        except DuplicateError as e:
            raise HTTPException(status_code=409, detail=str(e)) from e
        if obj is None:
            raise HTTPException(status_code=404, detail=f"{spec.label} {item_id} not found")
        return obj

    @router.delete("/delete-all/confirm")
    def delete_all_items(
        db: Session = Depends(get_db), _user: User = Depends(require_admin)
    ):
        count = crud.delete_all_rows(db, module_id)
        return {"message": f"Deleted all {count} {spec.label.lower()} records", "deleted_count": count}

    @router.delete("/{item_id}", status_code=204)
    def delete_item(
        item_id: int, db: Session = Depends(get_db), _user: User = Depends(require_admin)
    ):
        ok = crud.delete_row(db, module_id, item_id)
        if not ok:
            raise HTTPException(status_code=404, detail=f"{spec.label} {item_id} not found")
        return None

    return router


ALL_GENERIC_ROUTERS = [
    build_router("inv", "/api/invoices"),
    build_router("pay", "/api/payments"),
    build_router("cp", "/api/company-payments"),
    build_router("rp", "/api/received-payments"),
    build_router("exp", "/api/expenses"),
    build_router("fr", "/api/freight-rates"),
    build_router("trader", "/api/traders"),
    build_router("vehicle", "/api/vehicles"),
]
