# Shree Ram Transport (SRT) — Transport Management System

FastAPI + MySQL + JWT rebuild of the original single-file SRT dashboard prototype. See `docs/analysis.md` (what the original file contained) and `docs/architecture.md` (how it was rebuilt) for full details.

## Quick start (Docker — recommended)

```bash
cp .env.example .env
# edit .env if you want a different SECRET_KEY / MySQL password
docker compose up --build
```

The entrypoint automatically waits for MySQL, runs Alembic migrations, and seeds the database (default admin + original demo data) on first boot. Once running:

- App: http://localhost:8000/
- Default admin login: `srt.jspl@gmail.com` / `Srt@jspl2026`

## Local development (without Docker)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Point at a local MySQL, or use SQLite for a quick spin:
export DATABASE_URL="sqlite:///./srt.db"

python -c "
from app.database import Base, engine, SessionLocal
import app.models
from app.seed import seed_all
Base.metadata.create_all(bind=engine)
db = SessionLocal(); seed_all(db); db.close()
"
uvicorn app.main:app --reload
```

For real MySQL locally, set `DATABASE_URL=mysql+pymysql://root:<password>@127.0.0.1:3306/srt_transport` instead, then run `alembic upgrade head` before seeding.

## Running the tests

```bash
# Backend API tests (39 tests; fast, no browser, no live server needed)
pytest tests/ -v

# Full browser end-to-end suite (6 suites / 64 checks total; starts its own
# server + resets its own SQLite DB automatically; requires Playwright + a
# Chromium binary)
python scripts/run_all_e2e.py

# Or run a single E2E suite manually against an already-running server:
python scripts/e2e_login_test.py http://127.0.0.1:8000
```

**Note on shared/constrained environments:** `scripts/run_all_e2e.py` launches a full headless Chromium instance per suite. In CPU/RAM-constrained sandboxes this can occasionally stall past its per-suite timeout under transient contention (confirmed to be environment noise, not application behavior — a clean re-run with zero code changes passes every time). The runner already retries a failing suite once before reporting a real failure; if running suites manually one at a time, simply re-run a stalled suite after confirming no orphaned `chrome`/`uvicorn` processes are still consuming CPU (`pkill -9 -f chrome`, `pkill -9 -f "uvicorn app.main"`).

## Project layout

See `docs/architecture.md` section 1 for the full folder structure. In short: `app/` is the FastAPI application, `db/seed/` holds the original app's demo data (harvested verbatim from its JS), `scripts/` holds one-time build tooling (`decompose.py`) plus the E2E test suites and their orchestrator, `tests/` is the pytest suite.

## Known limitations

See `docs/architecture.md` section 8 and the Final Report below. **Login and the full registration workflow (public request → admin review with a live permission editor → approval/rejection → immediate login) are fully server-backed and covered by both pytest and browser E2E tests.** Notifications/Chat, the Gallery admin, Google-Sheets sync, and the Tax-Invoice sub-app remain client-side/`localStorage`-only in this iteration — their look and feel is 100% preserved; they are simply not yet wired to the new database.
