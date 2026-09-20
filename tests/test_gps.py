def test_gps_requires_auth(client):
    assert client.get("/api/gps").status_code == 401


def test_gps_full_crud_cycle(seeded_client, admin_headers):
    r = seeded_client.post(
        "/api/gps",
        json={
            "vehicle_number": "MP09XY1234",
            "gps_id": "TESTGPS001",
            "owner": "Test Owner",
            "mobile": "9999999999",
            "gps_type": "Standard",
        },
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["id"].startswith("g")
    gid = created["id"]

    r_list = seeded_client.get("/api/gps", headers=admin_headers)
    assert r_list.status_code == 200
    assert any(row["id"] == gid for row in r_list.json())
    assert len(r_list.json()) == 17  # 16 seeded (INIT_GPS) + this one

    r_upd = seeded_client.put(
        f"/api/gps/{gid}", json={"remark": "Updated remark"}, headers=admin_headers
    )
    assert r_upd.status_code == 200
    assert r_upd.json()["remark"] == "Updated remark"

    r_del = seeded_client.delete(f"/api/gps/{gid}", headers=admin_headers)
    assert r_del.status_code == 204
    assert seeded_client.get(f"/api/gps/{gid}", headers=admin_headers).status_code == 404
