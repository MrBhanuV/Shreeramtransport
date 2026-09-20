from app.seed import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD


def test_login_success(seeded_client):
    r = seeded_client.post(
        "/api/auth/login",
        json={"email": DEFAULT_ADMIN_EMAIL, "password": DEFAULT_ADMIN_PASSWORD},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert len(body["access_token"]) > 20


def test_login_wrong_password(seeded_client):
    r = seeded_client.post(
        "/api/auth/login", json={"email": DEFAULT_ADMIN_EMAIL, "password": "wrong-pass"}
    )
    assert r.status_code == 401


def test_login_unknown_email(seeded_client):
    r = seeded_client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "x"}
    )
    assert r.status_code == 401


def test_me_requires_token(seeded_client):
    r = seeded_client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_with_valid_token(seeded_client, admin_headers):
    r = seeded_client.get("/api/auth/me", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["email"] == DEFAULT_ADMIN_EMAIL
    assert body["user"]["role"] == "admin"
    assert "inv" in body["permissions"]
    assert "manage" in body["permissions"]["inv"]


def test_registration_request_then_approve_then_login(seeded_client, admin_headers):
    r = seeded_client.post(
        "/api/auth/register-request",
        json={
            "name": "New Staffer",
            "login_email": "new.staffer@example.com",
            "password": "S3curePass!",
            "designation": "Clerk",
            "department": "Operations",
        },
    )
    assert r.status_code == 201, r.text
    req_id = r.json()["id"]
    assert r.json()["status"] == "Pending"

    r2 = seeded_client.post(f"/api/auth/registration-requests/{req_id}/approve")
    assert r2.status_code == 401

    r3 = seeded_client.post(
        f"/api/auth/registration-requests/{req_id}/approve", headers=admin_headers
    )
    assert r3.status_code == 200, r3.text
    assert r3.json()["email"] == "new.staffer@example.com"

    r4 = seeded_client.post(
        "/api/auth/login",
        json={"email": "new.staffer@example.com", "password": "S3curePass!"},
    )
    assert r4.status_code == 200

    r5 = seeded_client.post(
        f"/api/auth/registration-requests/{req_id}/approve", headers=admin_headers
    )
    assert r5.status_code == 404


def test_registration_approve_with_permissions_grant(seeded_client, admin_headers):
    """Mirrors the original UI flow where the admin picks module/section
    permissions in the approval modal before accepting the request."""
    r = seeded_client.post(
        "/api/auth/register-request",
        json={
            "name": "Perm Staffer",
            "login_email": "perm.staffer@example.com",
            "password": "S3curePass!",
        },
    )
    req_id = r.json()["id"]

    r_approve = seeded_client.post(
        f"/api/auth/registration-requests/{req_id}/approve",
        json={"modules": {"inv": ["view"], "gps": ["view", "manage"]}},
        headers=admin_headers,
    )
    assert r_approve.status_code == 200, r_approve.text
    new_user_id = r_approve.json()["id"]

    r_login = seeded_client.post(
        "/api/auth/login",
        json={"email": "perm.staffer@example.com", "password": "S3curePass!"},
    )
    staff_headers = {"Authorization": f"Bearer {r_login.json()['access_token']}"}

    r_me = seeded_client.get("/api/auth/me", headers=staff_headers)
    perms = r_me.json()["permissions"]
    assert set(perms.keys()) == {"inv", "gps"}
    assert set(perms["inv"]) == {"view"}
    assert set(perms["gps"]) == {"view", "manage"}

    # Can view invoices (granted) but not create them (not granted).
    assert seeded_client.get("/api/invoices", headers=staff_headers).status_code == 200
    assert (
        seeded_client.post("/api/invoices", json={"vehicle": "X"}, headers=staff_headers).status_code
        == 403
    )
    # Can both view and manage GPS (both granted).
    assert seeded_client.get("/api/gps", headers=staff_headers).status_code == 200
    assert (
        seeded_client.post(
            "/api/gps", json={"vehicle_number": "MP1"}, headers=staff_headers
        ).status_code
        == 201
    )

    # Sanity: admin's own account is untouched by this.
    r_admin_me = seeded_client.get("/api/auth/me", headers=admin_headers)
    assert r_admin_me.json()["user"]["id"] != new_user_id


def test_registration_duplicate_pending_request_rejected(seeded_client, admin_headers):
    """Regression test: the original 100%-client-side app rejected a second
    registration request for an email that already had one Pending (it
    checked its own localStorage cache). That check was dropped when the
    workflow was bridged to the server (18-srt-registration-server-bridge.js
    called the API directly with no equivalent guard) -- found via
    scripts/e2e_registration_test.py producing two DB rows for the same
    email. Fixed server-side in register_request() so every browser/tab
    shares one consistent, authoritative check."""
    payload = {
        "name": "Duplicate Applicant",
        "login_email": "duplicate.applicant@example.com",
        "password": "FirstPass1!",
    }
    r1 = seeded_client.post("/api/auth/register-request", json=payload)
    assert r1.status_code == 201, r1.text

    r2 = seeded_client.post(
        "/api/auth/register-request", json={**payload, "password": "SecondPass1!"}
    )
    assert r2.status_code == 400
    assert "already pending" in r2.json()["detail"]

    # Only one row was actually created.
    pending = seeded_client.get(
        "/api/auth/registration-requests", params={"status_filter": "Pending"}, headers=admin_headers
    ).json()
    matching = [r for r in pending if r["login_email"] == payload["login_email"]]
    assert len(matching) == 1

    # Once the pending request is rejected, a fresh submission for the same
    # email is allowed again (not permanently blocked).
    req_id = matching[0]["id"]
    r_reject = seeded_client.post(
        f"/api/auth/registration-requests/{req_id}/reject", headers=admin_headers
    )
    assert r_reject.status_code == 200

    r3 = seeded_client.post(
        "/api/auth/register-request", json={**payload, "password": "ThirdPass1!"}
    )
    assert r3.status_code == 201, r3.text


def test_registration_reject_flow(seeded_client, admin_headers):
    r = seeded_client.post(
        "/api/auth/register-request",
        json={
            "name": "Rejected Person",
            "login_email": "rejected@example.com",
            "password": "whatever123",
        },
    )
    req_id = r.json()["id"]
    r2 = seeded_client.post(
        f"/api/auth/registration-requests/{req_id}/reject", headers=admin_headers
    )
    assert r2.status_code == 200
    assert r2.json()["status"] == "Rejected"
    r3 = seeded_client.post(
        "/api/auth/login", json={"email": "rejected@example.com", "password": "whatever123"}
    )
    assert r3.status_code == 401
