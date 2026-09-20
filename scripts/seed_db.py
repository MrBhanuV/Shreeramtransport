"""CLI entrypoint used by the Docker container (and available for manual
local use) to seed the configured database: `python -m scripts.seed_db`.
Safe to run repeatedly -- seed_admin/seed_demo_data are both idempotent."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.seed import seed_all


def main() -> None:
    db = SessionLocal()
    try:
        seed_all(db)
        print("Seed complete: default admin ensured, demo data imported (if table was empty).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
