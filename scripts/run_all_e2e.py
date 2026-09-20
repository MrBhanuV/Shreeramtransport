"""
Single entrypoint to run the entire E2E suite against a fresh, seeded
database and a freshly-started live server: resets the test SQLite DB,
starts uvicorn as a subprocess, waits for /health, runs every
e2e_*_test.py script in this directory in sequence, then always shuts the
server down (even on failure).

Usage: python3 scripts/run_all_e2e.py
Exit code is 0 only if every suite passed.
"""
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "e2e.db"
PORT = 8811
BASE_URL = f"http://127.0.0.1:{PORT}"

SUITES = [
    "e2e_login_test.py",
    "e2e_stale_credential_regression_test.py",
    "e2e_session_persistence_test.py",
    "e2e_disabled_account_test.py",
    "e2e_registration_test.py",
    "e2e_permissions_test.py",
]


def reset_database():
    if DB_PATH.exists():
        DB_PATH.unlink()
    code = (
        "import sys; sys.path.insert(0, '.')\n"
        "from app.database import Base, engine, SessionLocal\n"
        "import app.models\n"
        "from app.seed import seed_all\n"
        "Base.metadata.create_all(bind=engine)\n"
        "db = SessionLocal()\n"
        "seed_all(db)\n"
        "db.close()\n"
    )
    subprocess.run(
        [sys.executable, "-c", code],
        cwd=ROOT,
        env={**os.environ, "DATABASE_URL": f"sqlite:///{DB_PATH.name}"},
        check=True,
    )
    print("[runner] database reset and seeded")


def wait_for_health(proc, timeout=15):
    import urllib.error
    import urllib.request

    print(f"[runner] waiting for health, child pid={proc.pid}")
    start = time.time()
    deadline = start + timeout
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        poll_result = proc.poll()
        elapsed = time.time() - start
        if poll_result is not None:
            print(f"[runner] t={elapsed:.1f}s attempt={attempt}: process exited, code={poll_result}")
            raise RuntimeError(f"server process exited early with code {poll_result}")
        try:
            with urllib.request.urlopen(f"{BASE_URL}/health", timeout=1) as resp:
                if resp.status == 200:
                    print(f"[runner] t={elapsed:.1f}s: /health is up, warming up '/'...")
                    # /health alone isn't sufficient: it was observed that
                    # the FIRST real page load (GET /, which renders the
                    # ~130KB legacy_full.html Jinja2 template for the first
                    # time and triggers the OS's first disk reads of ~50
                    # static CSS/JS/media files) can take longer than a
                    # freshly-launched Chromium's default 30s navigation
                    # timeout, causing e2e_login_test.py's very first
                    # page.goto() to time out even though the server was
                    # technically "healthy". Performing one full warm-up
                    # request here -- before any browser suite starts --
                    # ensures template compilation and first-touch disk
                    # I/O are already paid for.
                    with urllib.request.urlopen(f"{BASE_URL}/", timeout=20) as home_resp:
                        if home_resp.status == 200:
                            print(f"[runner] t={time.time() - start:.1f}s: server is warmed up and healthy")
                            return
        except (urllib.error.URLError, ConnectionRefusedError, TimeoutError) as e:
            print(f"[runner] t={elapsed:.1f}s attempt={attempt}: not ready yet ({e})")
        time.sleep(0.5)
    raise RuntimeError("server never became healthy within timeout")


def main():
    reset_database()

    server_log = open(ROOT / "e2e_server.log", "w")
    server = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn", "app.main:app",
            "--host", "127.0.0.1", "--port", str(PORT),
        ],
        cwd=ROOT,
        env={**os.environ, "DATABASE_URL": f"sqlite:///{DB_PATH.name}"},
        stdout=server_log,
        stderr=subprocess.STDOUT,
    )

    overall_ok = True
    try:
        wait_for_health(server)
        for suite in SUITES:
            print(f"\n{'=' * 70}\nRUNNING {suite}\n{'=' * 70}")
            # This sandboxed environment has only 2 CPUs and limited free
            # RAM; launching a full Chromium instance per suite, six times
            # in a row, was observed to occasionally cause a single
            # navigation to stall past even a 45s timeout under transient
            # contention (confirmed via `free -h` / `nproc` at the time,
            # and by the fact that a full re-run with no code changes
            # passed cleanly) -- this is environment noise, not
            # application behavior. One retry keeps the suite reliable
            # without masking a genuine, reproducible failure: if a suite
            # fails twice in a row, that's reported as a real failure.
            max_attempts = 2
            for attempt in range(1, max_attempts + 1):
                result = subprocess.run(
                    [sys.executable, str(ROOT / "scripts" / suite), BASE_URL],
                    cwd=ROOT,
                )
                if result.returncode == 0:
                    break
                if attempt < max_attempts:
                    print(f"[runner] {suite} failed on attempt {attempt}/{max_attempts}, retrying...")
                    time.sleep(2)
            if result.returncode != 0:
                overall_ok = False
                print(f"[runner] {suite} FAILED after {max_attempts} attempts (exit {result.returncode})")
            else:
                print(f"[runner] {suite} passed" + (f" (on retry {attempt})" if attempt > 1 else ""))
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
        server_log.close()

    print(f"\n{'=' * 70}")
    print("ALL E2E SUITES PASSED" if overall_ok else "ONE OR MORE E2E SUITES FAILED")
    print(f"{'=' * 70}")
    sys.exit(0 if overall_ok else 1)


if __name__ == "__main__":
    main()
