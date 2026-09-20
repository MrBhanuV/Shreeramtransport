from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.routers import attendance, auth, dashboard, gps, users
from app.routers.generic_router import ALL_GENERIC_ROUTERS

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Shree Ram Transport", version="1.0.0")

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(gps.router)
app.include_router(attendance.router)
app.include_router(dashboard.router)
for r in ALL_GENERIC_ROUTERS:
    app.include_router(r)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse, tags=["pages"])
def app_shell(request: Request):
    response = templates.TemplateResponse(request, "legacy_full.html", {})
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return response
