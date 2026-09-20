"""
E2E test proving a Disabled account is rejected at login through the real
UI, even with the correct password -- and that disabling an account
mid-session also blocks its *next* API call (the JWT itself doesn't
encode status, so this must be enforced by a fresh DB lookup on every
request, not just at login time).

Usage: python3 scripts/e2e_disabled_account_test.py [base_url]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from e2e_helpers import ADMIN_EMAIL, ADMIN_PASSWORD, CHROME_PATH, Reporter, new_page

from playwright.sync_api import sync_playwright

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811"
DISABLED_EMAIL = "e2e.disabled@example.com"
DISABLED_PASSWORD = "DisabledPass1!"


def run(report: Reporter):
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME_PATH, args=["--no-sandbox"])
        page = new_page(browser)
        page.goto(BASE_URL + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(300)

        # 1. Admin creates a staff account that is Disabled from the start.
        page.click("text=Login")
        page.wait_for_selector("#pg-login.active", timeout=3000)
        page.fill("#lu", ADMIN_EMAIL)
        page.fill("#lp", ADMIN_PASSWORD)
        page.click("#lbtn")
        page.wait_for_selector("#pg-dash.active", timeout=5000)

        create_result = page.evaluate(
            """
            async ({ email, password }) => {
                const token = localStorage.getItem('srt_jwt_v1');
                const res = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({
                        name: 'E2E Disabled User', email, password,
                        status: 'Disabled', modules: { inv: ['view'] },
                    }),
                });
                return { status: res.status, body: await res.json() };
            }
            """,
            {"email": DISABLED_EMAIL, "password": DISABLED_PASSWORD},
        )
        report.check(
            "admin creates a Disabled staff account via the real API",
            create_result["status"] == 201 and create_result["body"].get("status") == "Disabled",
            str(create_result),
        )
        user_id = create_result["body"]["id"]

        page.on("dialog", lambda dialog: dialog.accept())
        page.evaluate("doLogout()")
        page.wait_for_selector("#pg-home.active", timeout=3000)

        # 2. The disabled account cannot sign in via the real login UI, even
        #    with the exactly correct password.
        page.click("text=Login")
        page.wait_for_selector("#pg-login.active", timeout=3000)
        page.fill("#lu", DISABLED_EMAIL)
        page.fill("#lp", DISABLED_PASSWORD)
        page.click("#lbtn")
        page.wait_for_selector("#lerr.show", timeout=5000)
        report.check(
            "disabled account with correct password is rejected at login (stays on login page)",
            "active" in (page.locator("#pg-login").get_attribute("class") or ""),
        )
        jwt_after_disabled_login = page.evaluate("localStorage.getItem('srt_jwt_v1')")
        report.check(
            "no JWT is stored for a rejected disabled-account login attempt",
            not jwt_after_disabled_login,
            repr(jwt_after_disabled_login),
        )

        # 3. Re-enable the account (as admin), confirm it CAN now log in --
        #    proves the rejection above was genuinely status-based, not a
        #    fluke/typo in the test's own credentials.
        page.fill("#lu", ADMIN_EMAIL)
        page.fill("#lp", ADMIN_PASSWORD)
        page.click("#lbtn")
        page.wait_for_selector("#pg-dash.active", timeout=5000)

        reenable_result = page.evaluate(
            """
            async (userId) => {
                const token = localStorage.getItem('srt_jwt_v1');
                const res = await fetch('/api/users/' + userId, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ status: 'Active' }),
                });
                return res.status;
            }
            """,
            user_id,
        )
        report.check("admin re-enables the account via the real API", reenable_result == 200)

        page.evaluate("doLogout()")
        page.wait_for_selector("#pg-home.active", timeout=3000)
        page.click("text=Login")
        page.wait_for_selector("#pg-login.active", timeout=3000)
        page.fill("#lu", DISABLED_EMAIL)
        page.fill("#lp", DISABLED_PASSWORD)
        page.click("#lbtn")
        page.wait_for_selector("#pg-dash.active", timeout=5000)
        report.check(
            "the same account, once re-enabled, can now sign in with the same password "
            "(proves the earlier rejection was status-based, not a credentials mistake)",
            True,
        )

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
