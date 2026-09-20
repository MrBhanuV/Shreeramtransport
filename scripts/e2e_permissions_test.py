"""
E2E test proving section-level permission enforcement is real and
server-side, not just a UI convention -- driven through the actual login
page, using a real (non-admin) staff account created via the admin API.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from e2e_helpers import ADMIN_EMAIL, ADMIN_PASSWORD, CHROME_PATH, Reporter, new_page

from playwright.sync_api import sync_playwright

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8811"
VIEWER_EMAIL = "e2e.viewer@example.com"
VIEWER_PASSWORD = "ViewerPass1!"


def run(report: Reporter):
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME_PATH, args=["--no-sandbox"])
        page = new_page(browser)
        page.goto(BASE_URL + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(300)

        # 1. Admin signs in via the real UI, then creates -- via the real
        #    admin API, using the browser-held token -- a staff account
        #    granted ONLY "view" on invoices (no "manage").
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
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token,
                    },
                    body: JSON.stringify({
                        name: 'E2E Viewer',
                        email,
                        password,
                        modules: { inv: ['view'] },
                    }),
                });
                return { status: res.status, body: await res.json() };
            }
            """,
            {"email": VIEWER_EMAIL, "password": VIEWER_PASSWORD},
        )
        report.check(
            "admin creates a view-only staff account via the real API",
            create_result["status"] == 201,
            str(create_result),
        )

        # 2. Admin logs out (real UI).
        page.on("dialog", lambda dialog: dialog.accept())
        page.evaluate("doLogout()")
        page.wait_for_selector("#pg-home.active", timeout=3000)

        # 3. The view-only staffer signs in through the REAL login page UI.
        page.click("text=Login")
        page.wait_for_selector("#pg-login.active", timeout=3000)
        page.fill("#lu", VIEWER_EMAIL)
        page.fill("#lp", VIEWER_PASSWORD)
        page.click("#lbtn")
        page.wait_for_selector("#pg-dash.active", timeout=5000)
        report.check("view-only staffer reaches the dashboard via the real login UI", True)

        viewer_session = page.evaluate(
            "typeof SRT_CURRENT_USER !== 'undefined' ? SRT_CURRENT_USER : null"
        )
        report.check(
            "server-mirrored session correctly reports staff role (not admin)",
            viewer_session is not None and viewer_session.get("role") != "admin",
            str(viewer_session),
        )
        report.check(
            "server-mirrored session grants ONLY 'view' on invoices, no 'manage'",
            viewer_session is not None
            and viewer_session.get("sections", {}).get("inv") == ["view"],
            str(viewer_session.get("sections") if viewer_session else None),
        )

        # 4. Prove the restriction is enforced SERVER-SIDE: a real fetch from
        #    this authenticated browser session can list invoices (allowed)
        #    but cannot create one (403, not just hidden by the UI).
        view_result = page.evaluate(
            """
            async () => {
                const res = await fetch('/api/invoices?limit=1', {
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('srt_jwt_v1') },
                });
                return res.status;
            }
            """
        )
        report.check("view-only staffer CAN list invoices (view granted)", view_result == 200, str(view_result))

        create_attempt = page.evaluate(
            """
            async () => {
                const res = await fetch('/api/invoices', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('srt_jwt_v1'),
                    },
                    body: JSON.stringify({ vehicle: 'SHOULD-NOT-BE-CREATED' }),
                });
                return res.status;
            }
            """
        )
        report.check(
            "view-only staffer is SERVER-SIDE blocked (403) from creating an invoice",
            create_attempt == 403,
            str(create_attempt),
        )

        # 5. Also confirm a module the staffer was never granted at all
        #    (e.g. GPS) is fully blocked, not just invoices-manage.
        gps_attempt = page.evaluate(
            """
            async () => {
                const res = await fetch('/api/gps', {
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('srt_jwt_v1') },
                });
                return res.status;
            }
            """
        )
        report.check(
            "view-only staffer is SERVER-SIDE blocked (403) from an ungranted module (GPS)",
            gps_attempt == 403,
            str(gps_attempt),
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
