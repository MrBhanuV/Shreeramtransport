#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] waiting for database..."
python - <<'PY'
import sys
import time

from app.config import get_settings
from sqlalchemy import create_engine, text

settings = get_settings()
engine = create_engine(settings.sqlalchemy_database_url)
for attempt in range(30):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[entrypoint] database is ready")
        sys.exit(0)
    except Exception as e:  # noqa: BLE001
        print(f"[entrypoint] db not ready yet ({e}); retrying ({attempt + 1}/30)")
        time.sleep(2)
print("[entrypoint] database never became ready", file=sys.stderr)
sys.exit(1)
PY

echo "[entrypoint] running migrations..."
alembic upgrade head

echo "[entrypoint] seeding database (idempotent)..."
python -m scripts.seed_db

echo "[entrypoint] starting app..."
exec "$@"
