"""
E2E coverage for session-persistence edge cases not covered by
e2e_login_test.py's happy-path reload check:
  1. A tampered/invalid JWT left in localStorage must be rejected on load
     (never trust the stored token's contents, only what the server
     confirms) and the app must fall back to a logged-out state cleanly.
  2. The "Remember email" checkbox actually persists the email across a
     full page reload and pre-fills the login form (srtPrepareLogin()).
  3. Unchecking "Remember email" on a later login clears any previously
     remembered address.

Usage: python3 scripts/e2e_session_persistence_test.py [base_url]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from e2e_helpers import ADMIN_EMAIL, ADMIN_PASSWORD, CHROME_PATH, Reporter, new_page

from playwright.sync_api import sync_playwright

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811"


def run(report: Reporter):
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME_PATH, args=["--no-sandbox"])
        page = new_page(browser)

        # --- Part 1: tampered/invalid token in localStorage -------------
        page.goto(BASE_URL + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(300)
        page.evaluate("localStorage.setItem('srt_jwt_v1', 'this-is-not-a-real-jwt')")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(700)  # allow the async silent-restore attempt to resolve

        current_user = page.evaluate(
            "typeof SRT_CURRENT_USER !== 'undefined' ? SRT_CURRENT_USER : 'UNDEF'"
        )
        report.check(
            "tampered JWT does not produce a signed-in session",
            current_user is None,
            repr(current_user),
        )
        jwt_after = page.evaluate("localStorage.getItem('srt_jwt_v1')")
        report.check(
            "tampered JWT is cleared from localStorage after the failed silent restore",
            not jwt_after,
            repr(jwt_after),
        )
        report.check(
            "app remains on the home page (not stuck on a broken dashboard state)",
            "active" in (page.locator("#pg-home").get_attribute("class") or ""),
        )

        # --- Part 2: "Remember email" persists across reload -------------
        page.click("text=Login")
        page.wait_for_selector("#pg-login.active", timeout=3000)
        page.check("#srt-login-remember")
        page.fill("#lu", ADMIN_EMAIL)
        page.fill("#lp", ADMIN_PASSWORD)
        page.click("#lbtn")
        page.wait_for_selector("#pg-dash.active", timeout=5000)

        remembered_after_login = page.evaluate("localStorage.getItem('srt_remembered_email_v1')")
        report.check(
            "checking 'Remember email' stores the address at login time",
            remembered_after_login == ADMIN_EMAIL,
            repr(remembered_after_login),
        )

        page.on("dialog", lambda dialog: dialog.accept())
        page.evaluate("doLogout()")
        page.wait_for_selector("#pg-home.active", timeout=3000)

        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(300)
        page.click("text=Login")
        page.wait_for_selector("#pg-login.active", timeout=3000)
        prefilled_email = page.input_value("#lu")
        remember_checked = page.is_checked("#srt-login-remember")
        report.check(
            "remembered email pre-fills the login form after reload + reopening the login page",
            prefilled_email == ADMIN_EMAIL,
            repr(prefilled_email),
        )
        report.check(
            "'Remember email' checkbox reflects the remembered state on re-open",
            remember_checked is True,
        )

        # --- Part 3: unchecking "Remember email" clears it on next login --
        page.uncheck("#srt-login-remember")
        page.fill("#lu", ADMIN_EMAIL)
        page.fill("#lp", ADMIN_PASSWORD)
        page.click("#lbtn")
        page.wait_for_selector("#pg-dash.active", timeout=5000)
        remembered_after_uncheck = page.evaluate("localStorage.getItem('srt_remembered_email_v1')")
        report.check(
            "unchecking 'Remember email' before login clears the previously remembered address",
            remembered_after_uncheck is None,
            repr(remembered_after_uncheck),
        )

        # Clean up: log out so this script leaves no session behind for
        # whichever suite runs next.
        page.evaluate("doLogout()")
        page.wait_for_selector("#pg-home.active", timeout=3000)

        browser.close()


if __name__ == "__main__":
    report = Reporter()
    try:
        run(report)
    except Exception:
        # IMPORTANT: never put sys.exit() inside a `finally` block -- that
        # silently discards any exception propagating from run(), producing
        # a misleading "0/0 checks passed" with no traceback (this exact
        # bug was found and fixed during development of this test suite;
        # see e2e_login_test.py's git history / conversation record).
        import traceback

        traceback.print_exc()
        report.check("script completed without raising an unhandled exception", False, "see traceback above")
    ok = report.summary()
    sys.exit(0 if ok else 1)
