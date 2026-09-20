import pytest

from app.table_registry import TABLE_SPECS

MODULE_URL = {
    "inv": "/api/invoices",
    "pay": "/api/payments",
    "cp": "/api/company-payments",
    "rp": "/api/received-payments",
    "exp": "/api/expenses",
    "fr": "/api/freight-rates",
    "trader": "/api/traders",
    "vehicle": "/api/vehicles",
}

SAMPLE_PAYLOAD = {
    "inv": {"invoice_no": "SRT/TEST/01", "vehicle": "MP09XX1234", "trader_name": "Test Trader"},
    "pay": {"vehicle": "MP09XX1234", "trader_name": "Test Trader", "payment_status": "Pending"},
    "cp": {"invoice_no": "SRT/TEST/01", "vehicle": "MP09XX1234", "submit_status": "Pending"},
    "rp": {"invoice_number": "SRT/TEST/01", "vehicle_number": "MP09XX1234"},
    "exp": {"name": "Test User", "date": "01 Jan 2027", "expense": "123", "remark": "Test"},
    "fr": {"destination": "TestCity", "rate": "1234"},
    "trader": {"trader_name": "Test Trader Co.", "city": "Chhindwara"},
    "vehicle": {"vehicle_number": "MP09XX1234", "owner_name": "Test Owner"},
}


@pytest.mark.parametrize("module_id", list(TABLE_SPECS.keys()))
def test_requires_auth(client, module_id):
    url = MODULE_URL[module_id]
    assert client.get(url).status_code == 401
    assert client.post(url, json={}).status_code == 401


@pytest.mark.parametrize("module_id", list(TABLE_SPECS.keys()))
def test_full_crud_cycle(seeded_client, admin_headers, module_id):
    url = MODULE_URL[module_id]

    payload = SAMPLE_PAYLOAD[module_id]
    r = seeded_client.post(url, json=payload, headers=admin_headers)
    assert r.status_code == 201, r.text
    created = r.json()
    item_id = created["id"]
    for k, v in payload.items():
        assert created[k] == v

    r_list = seeded_client.get(url, headers=admin_headers)
    assert r_list.status_code == 200
    assert any(row["id"] == item_id for row in r_list.json())

    r_get = seeded_client.get(f"{url}/{item_id}", headers=admin_headers)
    assert r_get.status_code == 200
    assert r_get.json()["id"] == item_id

    r_404 = seeded_client.get(f"{url}/999999", headers=admin_headers)
    assert r_404.status_code == 404

    first_field = next(iter(payload))
    r_upd = seeded_client.put(
        f"{url}/{item_id}", json={first_field: "UPDATED-VALUE"}, headers=admin_headers
    )
    assert r_upd.status_code == 200, r_upd.text
    assert r_upd.json()[first_field] == "UPDATED-VALUE"

    r_upd_404 = seeded_client.put(
        f"{url}/999999", json={first_field: "x"}, headers=admin_headers
    )
    assert r_upd_404.status_code == 404

    r_del = seeded_client.delete(f"{url}/{item_id}", headers=admin_headers)
    assert r_del.status_code == 204
    r_get_after = seeded_client.get(f"{url}/{item_id}", headers=admin_headers)
    assert r_get_after.status_code == 404

    r_del_404 = seeded_client.delete(f"{url}/999999", headers=admin_headers)
    assert r_del_404.status_code == 404


def test_freight_rate_duplicate_destination_conflicts(seeded_client, admin_headers):
    url = MODULE_URL["fr"]
    r1 = seeded_client.post(url, json={"destination": "UniqueCity", "rate": "1000"}, headers=admin_headers)
    assert r1.status_code == 201
    r2 = seeded_client.post(url, json={"destination": "UniqueCity", "rate": "2000"}, headers=admin_headers)
    assert r2.status_code == 409


@pytest.mark.parametrize("module_id", ["inv", "pay", "cp", "exp", "fr"])
def test_admin_can_delete_all_requested_module_records(seeded_client, admin_headers, module_id):
    url = MODULE_URL[module_id]
    before = seeded_client.get(url, headers=admin_headers, params={"limit": 500})
    assert before.status_code == 200
    assert before.json()

    deleted = seeded_client.delete(f"{url}/delete-all/confirm", headers=admin_headers)
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["deleted_count"] == len(before.json())

    after = seeded_client.get(url, headers=admin_headers, params={"limit": 500})
    assert after.status_code == 200
    assert after.json() == []


def test_non_admin_cannot_delete_all_records(seeded_client, admin_headers):
    r_user = seeded_client.post(
        "/api/users",
        json={
            "name": "Delete Viewer",
            "email": "delete-viewer@example.com",
            "password": "viewerpass1",
            "modules": {"inv": ["view"]},
        },
        headers=admin_headers,
    )
    assert r_user.status_code == 201, r_user.text

    r_login = seeded_client.post(
        "/api/auth/login",
        json={"email": "delete-viewer@example.com", "password": "viewerpass1"},
    )
    viewer_headers = {"Authorization": f"Bearer {r_login.json()['access_token']}"}

    deleted = seeded_client.delete(
        f"{MODULE_URL['exp']}/delete-all/confirm", headers=viewer_headers
    )
    assert deleted.status_code == 403


def test_seeded_demo_data_row_counts_match_original(seeded_client, admin_headers):
    assert len(seeded_client.get(MODULE_URL["inv"], headers=admin_headers, params={"limit": 500}).json()) == 141
    assert len(seeded_client.get(MODULE_URL["cp"], headers=admin_headers, params={"limit": 500}).json()) == 101
    assert len(seeded_client.get(MODULE_URL["exp"], headers=admin_headers, params={"limit": 500}).json()) == 14
    assert len(seeded_client.get(MODULE_URL["fr"], headers=admin_headers, params={"limit": 500}).json()) == 96


def test_non_admin_without_manage_section_gets_403(seeded_client, admin_headers):
    r_user = seeded_client.post(
        "/api/users",
        json={
            "name": "Viewer Only",
            "email": "viewer@example.com",
            "password": "viewerpass1",
            "modules": {"inv": ["view"]},
        },
        headers=admin_headers,
    )
    assert r_user.status_code == 201, r_user.text

    r_login = seeded_client.post(
        "/api/auth/login", json={"email": "viewer@example.com", "password": "viewerpass1"}
    )
    viewer_headers = {"Authorization": f"Bearer {r_login.json()['access_token']}"}

    r_view = seeded_client.get("/api/invoices", headers=viewer_headers)
    assert r_view.status_code == 200

    r_create = seeded_client.post(
        "/api/invoices", json={"vehicle": "X"}, headers=viewer_headers
    )
    assert r_create.status_code == 403
