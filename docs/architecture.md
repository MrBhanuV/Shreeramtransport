# Architecture — SRT Transport Management System (FastAPI rebuild)

## 0. Scope decision

The source file is a 12+ module, fully client-side prototype. This build fully migrates the modules representing the core business data to FastAPI + MySQL + JWT:

**Migrated (server-backed, tested):** Auth & users & permissions, registration-request workflow, Invoices, Payments, Company Payments, Received Payments, Expenses, Freight Rates, Traders, Vehicles, GPS Records, Attendance (staff/records/holidays) + monthly payroll.

**Kept as-is (still 100% functional, client-side/localStorage, not migrated this pass):** Home-page gallery admin, in-app Notifications/Chat, Google-Sheets webhook sync, and the embedded Tax-Invoice/Payment-Voucher sub-app (an intentionally isolated, standalone tool — see Final Report). The login and registration workflows (both the public request modal and the admin's review/approval/rejection UI) are fully server-backed, not client-side-only, as of this iteration.

## 1. Folder Structure

```
srt_project/
├── app/
│   ├── main.py  config.py  database.py  security.py  deps.py  seed.py  table_registry.py
│   ├── models/       (SQLAlchemy ORM: user, simple_tables, gps, attendance, mixins)
│   ├── schemas/      (Pydantic: user, gps, attendance, generic_table)
│   ├── crud/         (generic.py -- shared CRUD for the 8 uniform table modules)
│   ├── routers/      (auth, users, gps, attendance, dashboard, generic_router)
│   ├── templates/    (legacy_full.html -- decomposed app shell)
│   └── static/
│       ├── css/      (30 extracted files, cascade order preserved)
│       ├── js/       (16 extracted legacy files + api-client.js + 17-srt-server-auth-bridge.js)
│       ├── media/    (3 decoded logo PNGs)
│       └── legacy/   (tax_invoice_app.html -- standalone sub-app, unchanged)
├── db/
│   ├── seed/         (JSON dumped straight from the original JS -- audit trail)
│   └── migrations/   (Alembic)
├── tests/            (pytest, 39 tests)
├── scripts/
│   ├── decompose.py, extract_seed_data.js, seed_db.py   (build/seed tooling)
│   └── e2e_helpers.py, run_all_e2e.py,                  (Playwright browser E2E,
│       e2e_login_test.py, e2e_stale_credential_regression_test.py,   6 suites / 64 checks)
│       e2e_session_persistence_test.py, e2e_disabled_account_test.py,
│       e2e_registration_test.py, e2e_permissions_test.py
├── docs/  Dockerfile  docker-compose.yml  docker-entrypoint.sh
├── requirements.txt  .env.example  .gitignore  alembic.ini
```

## 2. Dependencies

FastAPI, Uvicorn, SQLAlchemy 2.x, PyMySQL (pure-Python driver, no libmysqlclient needed), Alembic, Pydantic v2, `bcrypt` (called directly, not via passlib — see note below), `PyJWT`, Jinja2, `pytest` + `httpx` for API tests, `playwright` for browser E2E tests.

**Compatibility note:** `passlib[bcrypt]`'s `CryptContext` was dropped in favor of calling the `bcrypt` library directly — passlib 1.7.4's version-detection code reads `bcrypt.__about__.__version__`, an attribute removed in bcrypt≥4.1, which raised `ValueError` on every hash/verify call. Direct `bcrypt.hashpw`/`checkpw` sidesteps this entirely.

## 3. Data Model

16 tables: `users`, `user_module_access`, `registration_requests`, the 8 uniform business tables (`invoices`, `payments`, `company_payments`, `received_payments`, `expenses`, `freight_rates`, `traders`, `vehicles` — all business columns stored as `String`, mirroring the original app's string-typed JSON exactly, including `"-"` sentinels), `gps_records` (string PK matching the original client-id scheme), and the attendance cluster (`attendance_staff`, `attendance_records`, `attendance_holidays`, `payroll_monthly`).

## 4. API Endpoints

Auth: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/register-request`, admin `GET/POST .../registration-requests[/{id}/approve|reject]`. Users: full CRUD + per-module/section permission grants. Generic CRUD factory (`app/routers/generic_router.py`) builds identical list/get/create/update/delete endpoints for all 8 uniform modules from a single `TABLE_SPECS` registry. GPS and Attendance get bespoke routers (attendance includes a `/salary` endpoint that ports the original JS payroll formula exactly — daily rate = salary/30, payable days = present+wfh+late+half·0.5+sundays+holidays, WFH deducts ₹100/day). `/api/dashboard/kpi` replaces the original hardcoded `KPI` object with a live query.

All protected endpoints require `Authorization: Bearer <JWT>`; permissions enforced via `require_section(module_id, section_id)`, mirroring the original `SRT_MODULES`/`SRT_MODULE_SECTIONS` matrix.

## 5. Frontend Wiring Strategy

The extracted JS files keep their exact function names/DOM logic. Only the **login flow** is currently bridged to the real backend, via a new file, `17-srt-server-auth-bridge.js`, which overrides `srtSubmitLogin`/`doLogout` (by redeclaring the same global names — legacy code calls them by name at click-time, so the override is picked up automatically) and mirrors the server's `/api/auth/me` response into the exact `SRT_CURRENT_USER` shape the rest of the 10,000-line legacy app already expects, so all existing rendering/permission-check logic keeps working unchanged.

**Known legacy interaction handled:** `srtLoadAccounts()` contains a "stale admin credential" safeguard that wipes `SRT_CURRENT_USER` if a cached admin account's `credentialRevision` doesn't match a hardcoded constant. The bridge's mirrored admin account is given a matching `credentialRevision`; a secondary defensive net (`srtGuardSession()`, wrapping `srtLoadAccounts` plus a 1s interval check) restores the session from an authoritative in-memory copy if *any* legacy code path (known or not-yet-discovered, given the file's size) nulls it while a valid JWT is still held. The server independently re-validates the JWT and permissions on every API call regardless of client-side state, so this defensive net is a UX safeguard, not a security boundary.

Other modules' data calls (invoices, payments, GPS, attendance, etc.) still use their original hardcoded/localStorage data in the UI layer; the server-side CRUD APIs for them are fully built and tested (pytest), but wiring each module's UI to call them is the next iteration (see Final Report). Login and the full registration workflow (public request → admin review/approve/reject with live permission selection) are, as of this iteration, wired end-to-end.

## 6. Testing Strategy

- **Backend (pytest, 39 tests, SQLite in-memory):** auth/login/registration lifecycle (including permission grants at approval time), parametrized CRUD across all 8 generic modules (create/list/get/update/delete/404/403/409), GPS CRUD, attendance staff/records/holidays/salary-formula correctness, page-shell rendering + broken-static-link detection.
- **Browser E2E (Playwright + real headless Chromium + live Uvicorn + seeded SQLite, 64 checks across 6 suites, orchestrated by `scripts/run_all_e2e.py`):**
  - `e2e_login_test.py` (22 checks): full login UI flow — wrong password (inline error, no token), correct password (dashboard loads, JWT stored, `SRT_CURRENT_USER`/permissions populated from the server), authenticated API call from the page, session restore on reload, logout, zero uncaught JS exceptions.
  - `e2e_stale_credential_regression_test.py` (5 checks): regression coverage for the stale-admin-credential fix (see CHANGELOG) — confirms the server-backed session survives the legacy safeguard's trigger condition, and that the safeguard still fires normally for a non-server-backed session.
  - `e2e_session_persistence_test.py` (7 checks): a tampered/invalid stored JWT is rejected and cleared rather than producing a broken signed-in-looking state; "Remember email" checkbox behavior across reloads.
  - `e2e_disabled_account_test.py` (5 checks): a `Disabled`-status account is rejected at login and can sign in again once re-enabled, proving the rejection is status-based rather than a credentials bug.
  - `e2e_registration_test.py` (18 checks): the complete real-UI journey — public registration submission → duplicate-email rejection → admin reviews the request on the Profile page → opens the real approval modal → selects specific module/section permissions via the real permission-editor UI → approves → the new user logs in with their own chosen password → their exact granted/denied permissions are enforced by the real API from their own browser session.
  - `e2e_permissions_test.py` (7 checks): admin creates a view-only staff account via the real API → that account logs in through the real UI → its mirrored session correctly shows restricted permissions → a real authenticated fetch proves the server (not just the UI) blocks disallowed actions (403 on create, 403 on an entirely ungranted module).
  - `run_all_e2e.py` orchestrates all six against a freshly reset+seeded database and a freshly started server, retrying a suite once on failure (this shared sandbox occasionally stalls a Chromium launch under transient CPU contention — confirmed to be environment noise, not application behavior, since an immediate clean re-run passes every time), with clean shutdown even on failure.

## 7. Deployment

`docker-compose.yml`: `db` (mysql:8, healthchecked) + `web` (this app; entrypoint waits for DB, runs `alembic upgrade head`, seeds idempotently, then starts Uvicorn).

## 8. Known Limitations (see Final Report)

Notifications/Chat, Gallery admin, and Google-Sheets sync remain client-side/localStorage-only — fully visible/usable exactly as before, just not yet backed by MySQL. The Tax-Invoice sub-app remains a standalone, unmodified, client-side document by design (an isolated tool with its own Tailwind/jsPDF stack, not part of the core data model). Login and the registration workflow's frontend are now fully bridged to the server; wiring the remaining modules' UI (invoices, payments, GPS, attendance, etc.) to their already-built and tested APIs is the natural next step.
