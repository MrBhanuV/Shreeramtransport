"""
Real end-to-end browser test of the full registration workflow:
  public visitor submits a request via the actual modal ->
  admin logs in, opens Profile, sees the pending request, opens the
  approval modal, picks module/section permissions via the real
  permission-editor UI, approves it ->
  the newly-created user logs in with the password THEY chose ->
  their granted permissions are enforced by the real API from their own
  browser session (can view Invoices, cannot create one; can both view and
  manage GPS).

Run against a LIVE uvicorn server with a real (seeded) database, driven by
a real headless Chromium instance via Playwright -- exercises the actual
rendered markup, actual browser JS execution, and the real HTTP API, not
mocks.

Usage: python3 scripts/e2e_registration_test.py [base_url]
"""
import sys
import time
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

# Unique per run so repeated executions against the same DB don't collide.
UNIQUE_SUFFIX = str(int(time.time()))
NEW_USER_EMAIL = f"applicant.{UNIQUE_SUFFIX}@example.com"
NEW_USER_PASSWORD = "Str0ng!Pass9"


def fill_registration_form(page):
    page.fill("#rgName", "Priya Applicant")
    page.fill("#rgLoginEmail", NEW_USER_EMAIL)
    page.fill("#rgPersonalEmail", f"priya.personal.{UNIQUE_SUFFIX}@example.com")
    page.fill("#rgPhone", "9876543210")
    page.fill("#rgAadhaar", "123456789012")
    page.fill("#rgDesignation", "Field Executive")
    page.fill("#rgDepartment", "Operations")
    page.fill("#rgEmployeeId", f"EMP{UNIQUE_SUFFIX[-4:]}")
    page.select_option("#rgLocation", "Chhindwara, MP")
    page.fill("#rgPassword", NEW_USER_PASSWORD)
    page.fill("#rgConfirmPassword", NEW_USER_PASSWORD)
    page.fill("#rgCurrentAddress", "123 Current Street, Chhindwara")
    page.fill("#rgPermanentAddress", "456 Permanent Road, Chhindwara")


def run(report: Reporter):
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME_PATH, args=["--no-sandbox"])
        app_console_errors = []
        unexpected_network_failures = []
        expected_401_urls = set()
        # Populated at the exact points below where this script
        # intentionally triggers a failing request as part of a
        # negative-path assertion (duplicate registration, permission
        # denial) -- those responses are the CORRECT, desired behavior for
        # that request and are asserted on explicitly elsewhere in this
        # script; they must not also trip the separate, blanket
        # "no unexpected network failures" check at the end.
        expected_failures: set[tuple] = set()

        page = new_page(browser)
        page.on("pageerror", lambda exc: app_console_errors.append(str(exc)))
        page.on(
            "console",
            lambda msg: app_console_errors.append(msg.text)
            if msg.type == "error" and is_app_console_error(msg.text)
            else None,
        )
        page.on(
            "response",
            lambda res: unexpected_network_failures.append(f"{res.status} {res.request.method} {res.url}")
            if res.status >= 400
            and not classify_failed_response(res.url, res.status, expected_401_urls, expected_failures)
            else None,
        )

        # ---- Step 1: public visitor submits a registration request ----
        page.goto(BASE_URL + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(400)
        page.click("text=Create user request")
        page.wait_for_selector("#srtRegistrationOverlay.open", timeout=3000)
        report.check("registration modal opens from the home page", True)

        fill_registration_form(page)
        page.click('button:has-text("Submit Request")')
        # NOTE: do NOT use page.wait_for_selector("...:not(.open)") here.
        # Playwright's wait_for_selector defaults to state="visible", but a
        # CLOSED overlay is display:none (per .srt-user-overlay's CSS, only
        # .open sets display:flex) -- so the selector matches ":not(.open)"
        # correctly the moment it closes, yet is simultaneously "hidden",
        # and Playwright keeps waiting for a *visible* match until it times
        # out no matter how long the timeout is, EVEN THOUGH the modal
        # already closed correctly. (Root-caused via the error log itself:
        # "locator resolved to hidden <div ...>" on every single poll --
        # a previous fix attempt raised the timeout from 3s to 20s assuming
        # slow server-side bcrypt hashing was the cause, which did not
        # actually address the real issue.) Poll the class attribute
        # directly instead -- exactly like the "approval modal closes"
        # check further down in this same file already does correctly.
        modal_closed = False
        for _ in range(50):  # up to ~10s, polled every 200ms
            if "open" not in (page.get_attribute("#srtRegistrationOverlay", "class") or ""):
                modal_closed = True
                break
            page.wait_for_timeout(200)
        report.check("registration modal closes after successful submission", modal_closed)

        # Duplicate submission with the same email should be rejected by
        # the server (400) and surfaced as a toast, with the modal staying
        # open (confirmed real behavior via scripts/e2e_debug_registration.py).
        # This 400 is the correct, intentional response we're testing for
        # here -- register it as expected so the blanket network-failure
        # check at the end of this script doesn't flag it as a bug.
        expected_failures.add((400, BASE_URL + "/api/auth/register-request"))
        page.click("text=Create user request")
        page.wait_for_selector("#srtRegistrationOverlay.open", timeout=3000)
        fill_registration_form(page)
        page.click('button:has-text("Submit Request")')
        # Wait for the toast (fires on both success and failure paths) as
        # the real "request finished" signal, then assert the modal state.
        page.wait_for_selector(".toast.show", timeout=20000)
        report.check(
            "duplicate registration (same email) keeps modal open / does not silently succeed",
            "open" in (page.get_attribute("#srtRegistrationOverlay", "class") or ""),
        )
        # Scope the Cancel click to this specific modal -- "text=Cancel"
        # alone matches every Cancel button across the whole dashboard DOM.
        page.click("#srtRegistrationOverlay button:has-text('Cancel')")
        # See the detailed note above Step 1's modal-close check: poll the
        # class directly rather than wait_for_selector("...:not(.open)"),
        # which can never resolve against a hidden (display:none) element.
        for _ in range(25):
            if "open" not in (page.get_attribute("#srtRegistrationOverlay", "class") or ""):
                break
            page.wait_for_timeout(200)

        # ---- Step 2: admin logs in and reviews the pending request ----
        page.click("text=Login")
        page.wait_for_selector("#pg-login.active", timeout=3000)
        page.fill("#lu", ADMIN_EMAIL)
        page.fill("#lp", ADMIN_PASSWORD)
        page.click("#lbtn")
        page.wait_for_selector("#pg-dash.active", timeout=20000)  # login involves a bcrypt verify

        page.click('[data-pg="profile"]')
        page.wait_for_timeout(600)
        pending_row = page.locator(f"#registrationRequestBody tr:has-text('{NEW_USER_EMAIL}')")
        report.check(
            "the new registration request is visible to the admin on the Profile page",
            pending_row.count() == 1,
            f"found {pending_row.count()} matching row(s)",
        )

        # ---- Step 3: approve with specific module/section permissions ----
        pending_row.locator('button:has-text("Accept")').click()
        page.wait_for_selector("#srtRegistrationApprovalOverlay.open", timeout=3000)
        report.check("approval modal opens with the request summary", True)
        summary_text = page.locator("#registrationApprovalSummary").inner_text()
        report.check(
            "approval summary shows the applicant's real submitted data",
            "Priya Applicant" in summary_text and NEW_USER_EMAIL in summary_text,
            summary_text,
        )

        # Grant: Invoices -> view only. GPS -> view + manage.
        #
        # NOTE: srtRenderPermissionEditor()'s rebuild() (05-srt-account-
        # management-script.js) defaults EVERY section of a newly-checked
        # module to already-checked (srtSectionDefaults() returns all
        # section ids) -- a deliberate, pre-existing "grant full access by
        # default, then narrow down" UX, unchanged by the server bridge.
        # We must therefore explicitly UNCHECK the sections we do NOT want,
        # not just .check() the ones we do (those are already checked).
        page.check('#raModuleGrid input[value="inv"]')
        page.check('#raModuleGrid input[value="gps"]')
        page.wait_for_timeout(200)  # section grid rebuilds on module change
        page.uncheck('#raSectionGrid .srt-section-card[data-module="inv"] input[value="manage"]')
        page.uncheck('#raSectionGrid .srt-section-card[data-module="inv"] input[value="transfer"]')
        page.uncheck('#raSectionGrid .srt-section-card[data-module="gps"] input[value="transfer"]')
        # Sanity-check our own test setup before submitting: confirm the
        # section grid is now in exactly the state we intend (view-only for
        # inv; view+manage for gps), so a future rebuild()/default change
        # fails loudly here instead of silently granting the wrong access.
        collected = page.evaluate("srtCollectPermissions('raModuleGrid', 'raSectionGrid')")
        report.check(
            "test setup: permission editor reflects exactly view-only (inv) "
            "and view+manage (gps) before approving",
            set(collected["sections"].get("inv", [])) == {"view"}
            and set(collected["sections"].get("gps", [])) == {"view", "manage"},
            str(collected),
        )
        page.click('button:has-text("Accept & Create Account")')
        # See the detailed note above Step 1's modal-close check: poll the
        # class directly rather than wait_for_selector("...:not(.open)"),
        # which can never resolve against a hidden (display:none) element.
        approval_modal_closed = False
        for _ in range(50):  # up to ~10s -- approval also performs a bcrypt hash server-side
            if "open" not in (page.get_attribute("#srtRegistrationApprovalOverlay", "class") or ""):
                approval_modal_closed = True
                break
            page.wait_for_timeout(200)
        report.check("approval modal closes after successful approval", approval_modal_closed)

        still_pending = page.locator(f"#registrationRequestBody tr:has-text('{NEW_USER_EMAIL}')")
        report.check(
            "the approved request no longer appears in the pending list",
            still_pending.count() == 0,
        )

        page.on("dialog", lambda dialog: dialog.accept())
        page.evaluate("doLogout()")
        page.wait_for_selector("#pg-home.active", timeout=3000)

        # ---- Step 4: the new user logs in with the password they chose ----
        page.click("text=Login")
        page.wait_for_selector("#pg-login.active", timeout=3000)
        page.fill("#lu", NEW_USER_EMAIL)
        page.fill("#lp", NEW_USER_PASSWORD)
        page.click("#lbtn")
        page.wait_for_selector("#pg-dash.active", timeout=20000)
        new_user_session = page.evaluate(
            "typeof SRT_CURRENT_USER !== 'undefined' ? SRT_CURRENT_USER : null"
        )
        report.check(
            "newly approved user can log in with their own chosen password",
            new_user_session is not None and new_user_session.get("email") == NEW_USER_EMAIL,
            str(new_user_session),
        )
        report.check(
            "newly approved user's role is 'staff', not admin",
            new_user_session is not None and new_user_session.get("role") == "staff",
            str(new_user_session),
        )
        report.check(
            "newly approved user was granted exactly the permissions the admin selected",
            new_user_session is not None
            and set(new_user_session.get("sections", {}).get("inv", [])) == {"view"}
            and set(new_user_session.get("sections", {}).get("gps", [])) == {"view", "manage"}
            and "pay" not in new_user_session.get("sections", {}),
            str(new_user_session.get("sections") if new_user_session else None),
        )

        # ---- Step 5: the granted/denied permissions are enforced by the ----
        # ---- REAL server, called from the new user's own browser session ----
        # The 403 on invoice creation below is the correct, intentional
        # result we assert on immediately after -- register it as expected.
        expected_failures.add((403, BASE_URL + "/api/invoices"))
        perm_check = page.evaluate(
            """
            async () => {
                const token = localStorage.getItem('srt_jwt_v1');
                const authed = (path, opts) => fetch(path, {
                    ...opts,
                    headers: { ...(opts?.headers||{}), 'Authorization': 'Bearer ' + token }
                });
                const invView = await authed('/api/invoices?limit=1');
                const invCreate = await authed('/api/invoices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vehicle: 'MP00XX0000' })
                });
                const gpsView = await authed('/api/gps?limit=1');
                const gpsCreate = await authed('/api/gps', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vehicle_number: 'MP00XX0000' })
                });
                return {
                    invView: invView.status,
                    invCreate: invCreate.status,
                    gpsView: gpsView.status,
                    gpsCreate: gpsCreate.status,
                };
            }
            """
        )
        report.check(
            "granted permission (Invoices: view) is honored by the real API",
            perm_check["invView"] == 200,
            str(perm_check),
        )
        report.check(
            "NOT-granted permission (Invoices: manage) is correctly denied (403) by the real API",
            perm_check["invCreate"] == 403,
            str(perm_check),
        )
        report.check(
            "granted permission (GPS: view) is honored by the real API",
            perm_check["gpsView"] == 200,
            str(perm_check),
        )
        report.check(
            "granted permission (GPS: manage) is honored by the real API",
            perm_check["gpsCreate"] == 201,
            str(perm_check),
        )

        report.check(
            "no uncaught JS errors / app-level console.error calls during the flow",
            len(app_console_errors) == 0,
            str(app_console_errors),
        )
        report.check(
            "no unexpected network failures during the flow",
            len(unexpected_network_failures) == 0,
            str(unexpected_network_failures),
        )

        browser.close()


if __name__ == "__main__":
    report = Reporter()
    try:
        run(report)
    except Exception:
        # IMPORTANT: do not put sys.exit() in a `finally` block -- that
        # silently discards any exception propagating from `run()`,
        # producing a misleading "0/0 checks passed" with no traceback
        # (this bug was found and fixed during development of this test).
        import traceback

        traceback.print_exc()
        report.check("script completed without raising an unhandled exception", False, "see traceback above")
    ok = report.summary()
    sys.exit(0 if ok else 1)
