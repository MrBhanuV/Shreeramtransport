import re
from pathlib import Path

APP_STATIC = Path(__file__).resolve().parent.parent / "app" / "static"


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_app_shell_renders_all_three_pages(client):
    r = client.get("/")
    assert r.status_code == 200
    html = r.text
    assert 'id="pg-home"' in html
    assert 'id="pg-login"' in html
    assert 'id="pg-dash"' in html
    assert "<style" not in html
    assert "base64," not in html


def test_no_broken_static_links_in_rendered_shell(client):
    r = client.get("/")
    html = r.text
    paths = set(re.findall(r'(?:href|src)="(/static/[^"]+)"', html))
    assert len(paths) > 30
    missing = [p for p in paths if not (APP_STATIC / p[len("/static/"):]).exists()]
    assert not missing, f"broken static references: {missing}"


def test_static_css_and_js_and_media_serve_200(client):
    for path in [
        "/static/css/01-base-01.css",
        "/static/js/02-core-02.js",
        "/static/js/api-client.js",
        "/static/js/17-srt-server-auth-bridge.js",
        "/static/media/logo-f4835a481d13.png",
    ]:
        r = client.get(path)
        assert r.status_code == 200, path
