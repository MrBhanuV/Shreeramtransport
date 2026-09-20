"""
Genuine end-to-end browser test of the login flow, run against a LIVE
uvicorn server (backed by a real, seeded SQLite database), using a real
headless Chromium instance via Playwright. Exercises actual rendered
markup + actual browser JS execution (api-client.js +
17-srt-server-auth-bridge.js + the original extracted login script), not
just the backend API in isolation.

Usage: python3 scripts/e2e_login_test.py [base_url]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from e2e_helpers import (
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    CHROME_PATH,
    Reporter,
    classify_failed_response,
    is_app_console_error,
    new_page,
)

from playwright.sync_api import sync_playwright

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811"


def run(report: Reporter):
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME_PATH, args=["--no-sandbox"])
        app_console_errors = []
        unexpected_network_failures = []
        # The wrong-password test case below deliberately triggers a 401 on
        # this exact endpoint -- that is correct, expected behavior.
        expected_401_urls = {BASE_URL + "/api/auth/login"}

        page = new_page(browser)
        page.on("pageerror", lambda exc: app_console_errors.append(str(exc)))

        def on_console(msg):
            if msg.type == "error" and is_app_console_error(msg.text):
                app_console_errors.append(msg.text)

        def on_response(res):
            if res.status >= 400 and not classify_failed_response(
                res.url, res.status, expected_401_urls
            ):
                unexpected_network_failures.append(f"{res.status} {res.request.method} {res.url}")

        page.on("console", on_console)
        page.on("response", on_response)

        page.goto(BASE_URL + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        report.check("home page loads", page.locator("#pg-home").count() == 1)
        report.check(
            "home page is the active page on load",
            "active" in (page.locator("#pg-home").get_attribute("class") or ""),
        )

        page.click("text=Login")
        page.wait_for_selector("#pg-login.active", timeout=3000)
        report.check("login page becomes active after clicking Login", True)
        report.check("login form is visible", page.locator("#srt-login-form").is_visible())

        # Wrong credentials first -> expect inline error, no navigation, no
        # token stored. The resulting 401 is EXPECTED (see e2e_helpers) and
        # deliberately not treated as a console error.
        page.fill("#lu", ADMIN_EMAIL)
        page.fill("#lp", "totally-wrong-password")
        page.click("#lbtn")
        page.wait_for_selector("#lerr.show", timeout=5000)
        error_text = page.locator("#lerr").inner_text()
        report.check("wrong password shows inline error", len(error_text) > 0, error_text)
        report.check(
            "still on login page after failed login",
            "active" in (page.locator("#pg-login").get_attribute("class") or ""),
        )
        jwt_after_fail = page.evaluate("localStorage.getItem('srt_jwt_v1')")
        report.check("no JWT stored after failed login", not jwt_after_fail, repr(jwt_after_fail))

        # Correct credentials.
        page.fill("#lu", ADMIN_EMAIL)
        page.fill("#lp", ADMIN_PASSWORD)
        page.click("#lbtn")
        page.wait_for_selector("#pg-dash.active", timeout=5000)
        report.check("dashboard page becomes active after correct login", True)

        jwt_token = page.evaluate("localStorage.getItem('srt_jwt_v1')")
        report.check(
            "JWT access token stored in localStorage after login",
            bool(jwt_token) and len(jwt_token) > 20,
            repr(jwt_token),
        )

        current_user = page.evaluate(
            "typeof SRT_CURRENT_USER !== 'undefined' ? SRT_CURRENT_USER : null"
        )
        report.check(
            "SRT_CURRENT_USER populated with server data",
            current_user is not None and current_user.get("email") == ADMIN_EMAIL,
            str(current_user),
        )
        report.check(
            "SRT_CURRENT_USER role is admin (from server, not client-guessed)",
            current_user is not None and current_user.get("role") == "admin",
            str(current_user),
        )
        report.check(
            "SRT_CURRENT_USER has server-granted module permissions",
            current_user is not None
            and "inv" in (current_user.get("sections") or {})
            and "manage" in current_user["sections"]["inv"],
            str(current_user.get("sections") if current_user else None),
        )
        server_backed_flag = page.evaluate("window.SRT_SESSION_IS_SERVER_BACKED")
        report.check(
            "SRT_SESSION_IS_SERVER_BACKED flag set after login",
            server_backed_flag is True,
            repr(server_backed_flag),
        )

        api_check = page.evaluate(
            """
            async () => {
                const res = await fetch('/api/invoices?limit=5', {
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('srt_jwt_v1') }
                });
                return { status: res.status, count: (await res.json()).length };
            }
            """
        )
        report.check(
            "authenticated API call from the browser succeeds",
            api_check["status"] == 200,
            str(api_check),
        )
        report.check(
            "authenticated API call returns real seeded invoice rows",
            api_check["count"] == 5,
            str(api_check),
        )

        # Reload -- session should be silently restored from the stored JWT.
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(700)
        restored_user = page.evaluate(
            "typeof SRT_CURRENT_USER !== 'undefined' ? SRT_CURRENT_USER : null"
        )
        report.check(
            "session silently restored after page reload via stored JWT",
            restored_user is not None and restored_user.get("email") == ADMIN_EMAIL,
            str(restored_user),
        )
        restored_flag = page.evaluate("window.SRT_SESSION_IS_SERVER_BACKED")
        report.check(
            "SRT_SESSION_IS_SERVER_BACKED flag also set after silent restore",
            restored_flag is True,
            repr(restored_flag),
        )

        # Logout -> back to home page, JWT cleared, flag cleared.
        page.on("dialog", lambda dialog: dialog.accept())
        page.evaluate("doLogout()")
        page.wait_for_selector("#pg-home.active", timeout=3000)
        report.check("home page active again after logout", True)
        jwt_after_logout = page.evaluate("localStorage.getItem('srt_jwt_v1')")
        report.check(
            "JWT cleared from localStorage after logout", not jwt_after_logout, repr(jwt_after_logout)
        )
        flag_after_logout = page.evaluate("window.SRT_SESSION_IS_SERVER_BACKED")
        report.check(
            "SRT_SESSION_IS_SERVER_BACKED cleared after logout",
            flag_after_logout is False,
            repr(flag_after_logout),
        )

        report.check(
            "no uncaught JS errors / app-level console.error calls during the flow",
            len(app_console_errors) == 0,
            str(app_console_errors),
        )
        report.check(
            "no unexpected network failures during the flow (excluding known "
            "sandbox-blocked CDN calls and the intentional wrong-password 401)",
            len(unexpected_network_failures) == 0,
            str(unexpected_network_failures),
        )

        browser.close()


if __name__ == "__main__":
    report = Reporter()
    try:
        run(report)
    except Exception:
        # do not put sys.exit() in a `finally` block -- see
        # e2e_registration_test.py for why that silently swallows
        # exceptions and produces a misleading "0/0" result.
        import traceback

        traceback.print_exc()
        report.check("script completed without raising an unhandled exception", False, "see traceback above")
    ok = report.summary()
    sys.exit(0 if ok else 1)
