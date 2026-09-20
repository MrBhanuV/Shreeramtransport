"""Shared helpers for the Playwright-driven E2E scripts in this directory."""
import re

CHROME_PATH = "/opt/pw-browsers/chromium-1208/chrome-linux64/chrome"
ADMIN_EMAIL = "srt.jspl@gmail.com"
ADMIN_PASSWORD = "Srt@jspl2026"

# Default Playwright navigation timeout (30s) was observed to occasionally
# be too tight for this app's first page load in this sandboxed environment
# (a ~130KB server-rendered template + ~50 static assets on first touch).
# run_all_e2e.py's wait_for_health() now performs a warm-up GET before any
# suite starts, which should eliminate this in practice; this larger
# per-page timeout is kept as a second, independent safety margin so an
# individual suite run directly against an already-warm server (as during
# development) isn't needlessly flaky either.
NAVIGATION_TIMEOUT_MS = 45_000


def new_page(browser):
    """Creates a page with a more generous navigation timeout than
    Playwright's 30s default (see NAVIGATION_TIMEOUT_MS above). Use this
    instead of calling `browser.new_page()` directly in every suite."""
    page = browser.new_page()
    page.set_default_navigation_timeout(NAVIGATION_TIMEOUT_MS)
    return page

# NOTE: Chromium's browser-generated console message for a failed resource
# load ("Failed to load resource: the server responded with a status of
# 403 ()") deliberately does NOT include the failing URL, so it cannot be
# reliably distinguished from any other failed request by text alone. Do
# NOT try to filter these by matching console message text (that was tried
# and doesn't work). Instead:
#   - Track real JS runtime problems via `page.on('pageerror')` and any
#     explicit `console.error(...)` calls made BY the app's own code (which
#     DO carry meaningful, matchable text) -- see `is_app_console_error`.
#   - Track HTTP failures separately via `page.on('response')`, and
#     classify each by URL against `EXPECTED_FAILING_URL_PATTERNS` below.

EXPECTED_FAILING_URL_PATTERNS = [
    # Blocked in this sandboxed test environment (no outbound internet
    # access to third-party domains); loads fine with real internet access.
    re.compile(r"^https://fonts\.googleapis\.com/"),
    re.compile(r"^https://cdnjs\.cloudflare\.com/"),
    # Browser's automatic favicon probe; harmless, unrelated to app logic.
    re.compile(r"/favicon\.ico$"),
]


def classify_failed_response(
    url: str,
    status: int,
    expected_401_urls: set[str] | None = None,
    expected_failures: set[tuple[int, str]] | None = None,
) -> bool:
    """Returns True if this failed request is an already-understood,
    acceptable failure (not a bug), False if it's unexpected and should
    fail the test.

    `expected_401_urls` (legacy, kept for backward compatibility with
    scripts that only ever expect a 401 on one known URL, e.g. the
    wrong-password login attempt).

    `expected_failures` (general form): a set of exact (status, url) pairs
    that a test intentionally triggers as part of a negative-path
    assertion elsewhere in the same script (e.g. a duplicate-registration
    400, or a permission-denial 403) -- those are the correct, desired
    server response for that request and must not also be flagged as an
    "unexpected" failure by a separate, blanket network-error check.
    """
    if any(p.search(url) for p in EXPECTED_FAILING_URL_PATTERNS):
        return True
    if expected_401_urls and status == 401 and url in expected_401_urls:
        return True
    if expected_failures and (status, url) in expected_failures:
        return True
    return False


def is_app_console_error(text: str) -> bool:
    """True for console messages that originate from the app's own JS
    (thrown exceptions, explicit console.error calls) as opposed to the
    browser's generic network-failure notices, which carry no useful text
    and are handled separately via response classification."""
    return not text.startswith("Failed to load resource:")


class Reporter:
    """Tiny pass/fail tracker shared by every E2E script, so a single
    assertion failure doesn't abort the whole run before later checks have
    had a chance to record their own pass/fail status."""

    def __init__(self):
        self.results = []

    def check(self, name: str, condition: bool, detail: str = ""):
        status = "PASS" if condition else "FAIL"
        self.results.append((name, status, detail))
        print(f"[{status}] {name}" + (f" -- {detail}" if detail and not condition else ""))
        return condition

    def summary(self) -> bool:
        passed = sum(1 for _, s, _ in self.results if s == "PASS")
        total = len(self.results)
        print(f"\n=== {passed}/{total} checks passed ===")
        for name, status, detail in self.results:
            if status == "FAIL":
                print(f"  FAILED: {name}  ({detail})")
        return passed == total
