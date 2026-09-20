"""Dynamically builds Create/Update/Out Pydantic schemas for each of the 8
"simple table" modules from the shared `TABLE_SPECS` registry."""
from pydantic import ConfigDict, create_model

from app.table_registry import TABLE_SPECS

_schema_cache: dict[str, tuple[type, type, type]] = {}


def get_schemas(module_id: str) -> tuple[type, type, type]:
    if module_id in _schema_cache:
        return _schema_cache[module_id]

    spec = TABLE_SPECS[module_id]
    create_fields = {name: (str | None, None) for name in spec.fields}
    update_fields = {name: (str | None, None) for name in spec.fields}
    out_fields = {name: (str | None, None) for name in spec.fields}
    out_fields["id"] = (int, ...)

    create_schema = create_model(f"{spec.label}Create".replace(" ", ""), **create_fields)
    update_schema = create_model(f"{spec.label}Update".replace(" ", ""), **update_fields)
    out_schema = create_model(
        f"{spec.label}Out".replace(" ", ""),
        __config__=ConfigDict(from_attributes=True),
        **out_fields,
    )
    _schema_cache[module_id] = (create_schema, update_schema, out_schema)
    return _schema_cache[module_id]
