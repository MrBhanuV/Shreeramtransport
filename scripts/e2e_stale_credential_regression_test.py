"""
Dedicated regression test for the "stale admin credential" bug found while
building the auth bridge: srtLoadAccounts() (a pre-existing legacy function
in 05-srt-account-management-script.js) force-clears SRT_CURRENT_USER
whenever it finds a locally-cached admin account whose `credentialRevision`
doesn't match the app's hardcoded SRT_ADMIN_CREDENTIAL_REVISION constant --
a safeguard from the original 100%-client-side build for detecting "your
browser has an outdated cached admin password". Immediately after our new
server-backed login, this fired spuriously and logged the admin right back
out, because the legacy code had no concept of a server-confirmed session.

THE FIX (see scripts/decompose.py, section 3d, and the file header of
17-srt-server-auth-bridge.js) patches the exact wipe condition, at
decompose time, to also require `!window.SRT_SESSION_IS_SERVER_BACKED`.

This test proves two things, not just one:
  1. THE BUG STAYS FIXED: with a real server-backed session active, forcing
     the exact original trigger condition (a locally-cached admin account
     with a stale/mismatched credentialRevision) no longer clears the
     session.
  2. THE FIX IS SCOPED, NOT A BLANKET DISABLE: for a session that is NOT
     server-backed (SRT_SESSION_IS_SERVER_BACKED explicitly false, e.g. a
     hypothetical future purely-local code path), the original legacy
     safeguard still fires exactly as it did before -- we verified the
     narrow root cause and patched only that, per the "preserve behavior"
     project rule, rather than disabling the safeguard altogether.

Usage: python3 scripts/e2e_stale_credential_regression_test.py [base_url]
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
        page.goto(BASE_URL + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(300)

        # 1. Real server-backed login via the actual UI (not a shortcut --
        #    this is exactly the flow a real admin would use).
        page.click("text=Login")
        page.wait_for_selector("#pg-login.active", timeout=3000)
        page.fill("#lu", ADMIN_EMAIL)
        page.fill("#lp", ADMIN_PASSWORD)
        page.click("#lbtn")
        page.wait_for_selector("#pg-dash.active", timeout=5000)

        server_backed = page.evaluate("window.SRT_SESSION_IS_SERVER_BACKED")
        report.check(
            "precondition: session is server-backed after real login",
            server_backed is True,
            repr(server_backed),
        )

        # 2. Reproduce the EXACT original trigger: a locally-cached admin
        #    account whose credentialRevision does not match
        #    SRT_ADMIN_CREDENTIAL_REVISION, then call the real legacy
        #    srtLoadAccounts() function directly (not a re-implementation --
        #    the actual shipped function).
        result = page.evaluate(
            """
            () => {
                const accounts = srtGetAccounts();
                const admin = accounts.find(a => a.id === 'admin');
                if (!admin) return { error: 'no local admin mirror found' };
                admin.credentialRevision = 'DELIBERATELY-STALE-REVISION';
                srtSaveAccounts(accounts);
                srtLoadAccounts(); // the real, unmodified legacy function
                return {
                    currentUserAfter: (typeof SRT_CURRENT_USER !== 'undefined' && SRT_CURRENT_USER)
                        ? SRT_CURRENT_USER.email : null,
                    serverBackedAfter: window.SRT_SESSION_IS_SERVER_BACKED,
                };
            }
            """
        )
        report.check(
            "srtLoadAccounts() ran against a deliberately-stale admin credentialRevision",
            "error" not in result,
            str(result),
        )
        report.check(
            "REGRESSION CHECK: admin session survives the stale-credential trigger "
            "while server-backed (this is the bug that was fixed)",
            result.get("currentUserAfter") == ADMIN_EMAIL,
            str(result),
        )

        # 3. Confirm the session is still fully functional afterwards (not
        #    just present in memory, but actually still able to call
        #    protected APIs with its stored token).
        api_status = page.evaluate(
            """
            async () => {
                const res = await fetch('/api/auth/me', {
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('srt_jwt_v1') },
                });
                return res.status;
            }
            """
        )
        report.check(
            "session remains genuinely authenticated (not just cosmetically non-null) "
            "after surviving the stale-credential trigger",
            api_status == 200,
            str(api_status),
        )

        # 4. Prove the fix is correctly SCOPED: with SRT_SESSION_IS_SERVER_BACKED
        #    explicitly false, the original legacy safeguard must still behave
        #    exactly as it did before our change -- i.e. it DOES clear
        #    SRT_CURRENT_USER for a stale-credential admin mirror. This
        #    guards against a future edit accidentally turning the one-line
        #    patch into a blanket "never wipe" bypass.
        scoped_result = page.evaluate(
            """
            () => {
                window.SRT_SESSION_IS_SERVER_BACKED = false;
                const accounts = srtGetAccounts();
                const admin = accounts.find(a => a.id === 'admin');
                admin.credentialRevision = 'ANOTHER-STALE-REVISION';
                srtSaveAccounts(accounts);
                srtLoadAccounts();
                return (typeof SRT_CURRENT_USER !== 'undefined') ? SRT_CURRENT_USER : 'UNDEF';
            }
            """
        )
        report.check(
            "legacy safeguard still fires as originally designed for a "
            "non-server-backed session (fix is scoped, not a blanket disable)",
            scoped_result is None,
            repr(scoped_result),
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
