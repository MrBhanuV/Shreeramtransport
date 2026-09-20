from datetime import date


def test_attendance_requires_auth(client):
    assert client.get("/api/attendance/staff").status_code == 401


def test_staff_crud(seeded_client, admin_headers):
    r = seeded_client.post(
        "/api/attendance/staff",
        json={"id": "SRT999", "name": "Test Employee", "department": "QA", "monthly_salary": 15000},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text

    r_dup = seeded_client.post(
        "/api/attendance/staff",
        json={"id": "SRT999", "name": "Dup", "monthly_salary": 0},
        headers=admin_headers,
    )
    assert r_dup.status_code == 409

    r_list = seeded_client.get("/api/attendance/staff", headers=admin_headers)
    assert any(s["id"] == "SRT999" for s in r_list.json())
    assert len(r_list.json()) == 7  # 6 seeded + this one

    r_upd = seeded_client.put(
        "/api/attendance/staff/SRT999", json={"designation": "QA Lead"}, headers=admin_headers
    )
    assert r_upd.status_code == 200
    assert r_upd.json()["designation"] == "QA Lead"

    r_del = seeded_client.delete("/api/attendance/staff/SRT999", headers=admin_headers)
    assert r_del.status_code == 204


def test_day_records_set_and_get(seeded_client, admin_headers):
    r_set = seeded_client.put(
        "/api/attendance/records",
        params={"date": "2024-01-02"},
        json={"SRT001": {"status": "Present"}, "SRT002": {"status": "WFH", "note": "sick"}},
        headers=admin_headers,
    )
    assert r_set.status_code == 200, r_set.text
    assert r_set.json()["SRT001"]["status"] == "Present"
    assert r_set.json()["SRT002"]["note"] == "sick"

    r_get = seeded_client.get(
        "/api/attendance/records", params={"date": "2024-01-02"}, headers=admin_headers
    )
    assert r_get.status_code == 200
    assert r_get.json()["SRT001"]["status"] == "Present"

    r_bad = seeded_client.put(
        "/api/attendance/records",
        params={"date": "2024-01-03"},
        json={"SRT001": {"status": "Sleeping"}},
        headers=admin_headers,
    )
    assert r_bad.status_code == 422


def test_holiday_crud(seeded_client, admin_headers):
    r = seeded_client.post(
        "/api/attendance/holidays",
        json={"date": "2024-01-26", "name": "Republic Day"},
        headers=admin_headers,
    )
    assert r.status_code == 201
    r_dup = seeded_client.post(
        "/api/attendance/holidays",
        json={"date": "2024-01-26", "name": "Dup"},
        headers=admin_headers,
    )
    assert r_dup.status_code == 409
    r_list = seeded_client.get("/api/attendance/holidays", headers=admin_headers)
    assert any(h["date"] == "2024-01-26" for h in r_list.json())
    r_del = seeded_client.delete("/api/attendance/holidays/2024-01-26", headers=admin_headers)
    assert r_del.status_code == 204


def test_salary_calculation_matches_original_formula(seeded_client, admin_headers):
    seeded_client.post(
        "/api/attendance/staff",
        json={"id": "SRTSAL", "name": "Salary Test", "monthly_salary": 3000},
        headers=admin_headers,
    )

    year, month = 2024, 1
    sundays = {d for d in range(1, 32) if date(year, month, d).weekday() == 6}
    working_days = [d for d in range(1, 32) if d not in sundays]
    assert len(sundays) == 4
    assert len(working_days) == 27

    for d in working_days:
        key = f"{year}-{month:02d}-{d:02d}"
        r = seeded_client.put(
            "/api/attendance/records",
            params={"date": key},
            json={"SRTSAL": {"status": "Present"}},
            headers=admin_headers,
        )
        assert r.status_code == 200

    r_salary = seeded_client.get(
        "/api/attendance/salary", params={"year": year, "month": month}, headers=admin_headers
    )
    assert r_salary.status_code == 200
    row = next(x for x in r_salary.json() if x["staff_id"] == "SRTSAL")

    assert row["working_days"] == 27
    assert row["present"] == 27
    assert row["sundays"] == 4
    assert row["holidays"] == 0
    assert row["payable_days"] == 31
    assert row["wfh_deduction"] == 0
    assert row["final_salary"] == 3100
