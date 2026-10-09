import asyncio

from account_service.core import DAY

from .conftest import sign_in

PROJECT = {"app": "mathme-3d-studio", "version": 1, "name": "Bridge", "nodes": []}


def make_org(client, **over):
    sign_in(client, "owner@mathme.app", "Owner")
    body = {"name": "Green Valley School", "billingState": "Karnataka", "billingEmail": "accounts@gvs.edu", **over}
    oid = client.post("/api/admin/orgs", json=body).json()["id"]
    org = next(o for o in client.get("/api/admin/orgs").json()["orgs"] if o["id"] == oid)
    codes = {c["role"]: c["code"] for c in org["codes"]}
    return oid, codes


def test_enquiry_reaches_the_owner(client, svc):
    r = client.post(
        "/api/enquiries",
        json={"institution": "Green Valley School", "contactName": "Ms Iyer", "email": "iyer@gvs.edu", "students": 80},
    )
    assert r.status_code == 200
    subjects = [m.subject for m in svc.email.sent]
    assert "MathMe campus enquiry: Green Valley School" in subjects
    assert len(subjects) == 1  # nothing goes to the typed-in address
    bot = client.post(
        "/api/enquiries",
        json={"institution": "Spam", "contactName": "Bot", "email": "b@b.co", "website": "http://spam"},
    )
    assert bot.status_code == 200
    sign_in(client, "owner@mathme.app")
    assert len(client.get("/api/admin/enquiries").json()["enquiries"]) == 1


def test_admin_is_owner_only(client):
    assert client.get("/api/admin/metrics").status_code == 401
    sign_in(client, "someone@example.com")
    assert client.get("/api/admin/metrics").status_code == 403


def test_join_codes_roles_and_seats(client):
    oid, codes = make_org(client, studentSeats=2, teacherSeats=1)
    sign_in(client, "teacher@gvs.edu", "Mr Rao")
    assert client.post("/api/campus/join", json={"code": codes["teacher"]}).json()["role"] == "teacher"
    me = client.get("/api/me").json()
    assert me["plan"] == "pro" and me["source"] == "campus"
    sign_in(client, "teacher2@gvs.edu")
    full = client.post("/api/campus/join", json={"code": codes["teacher"]})
    assert full.status_code == 400 and "1 teacher" in full.json()["detail"]
    for i in range(2):
        sign_in(client, f"s{i}@gvs.edu")
        assert client.post("/api/campus/join", json={"code": codes["student"].lower()}).status_code == 200
        assert client.get("/api/me").json()["plan"] == "plus"
    sign_in(client, "s9@gvs.edu")
    assert client.post("/api/campus/join", json={"code": codes["student"]}).status_code == 400
    assert client.post("/api/campus/join", json={"code": "NOPE1234"}).status_code == 404


def test_class_page_and_shared_projects(client):
    oid, codes = make_org(client)
    sign_in(client, "teacher@gvs.edu", "Mr Rao")
    client.post("/api/campus/join", json={"code": codes["teacher"]})
    student = sign_in(client, "s1@gvs.edu", "Asha")
    client.post("/api/campus/join", json={"code": codes["student"]})
    view = client.get("/api/campus").json()
    assert view["role"] == "student" and "codes" not in view and "members" not in view
    client.put("/api/projects/project_br", json={"name": "Bridge", "objects": 3, "baseVersion": 0, "data": PROJECT})
    assert client.post("/api/projects/project_br/share", json={"shared": True}).status_code == 200
    # an outsider cannot open it
    sign_in(client, "outsider@example.com")
    assert client.get("/api/projects/project_br").status_code == 404
    # the teacher sees the roster, the codes and the project, read-only
    sign_in(client, "teacher@gvs.edu")
    view = client.get("/api/campus").json()
    assert {m["email"] for m in view["members"]} == {"teacher@gvs.edu", "s1@gvs.edu"}
    assert {c["role"] for c in view["codes"]} == {"teacher", "student"}
    assert [p["name"] for p in view["projects"]] == ["Bridge"]
    opened = client.get("/api/projects/project_br").json()
    assert opened["readOnly"] is True and opened["data"]["name"] == "Bridge"
    # removing a student also stops sharing their work
    assert client.delete(f"/api/campus/members/{student['id']}").status_code == 200
    assert client.get("/api/campus").json()["projects"] == []


def test_licence_end_drops_members_to_free(client, clock, svc):
    oid, codes = make_org(client, months=1)
    sign_in(client, "s1@gvs.edu")
    client.post("/api/campus/join", json={"code": codes["student"]})
    clock.t += 32 * DAY
    sign_in(client, "s1@gvs.edu")
    assert client.get("/api/me").json()["plan"] == "free"
    from account_service import jobs

    assert asyncio.run(jobs.daily(svc))["orgsExpired"] == 1
    # the owner extends it
    sign_in(client, "owner@mathme.app")
    client.post(f"/api/admin/orgs/{oid}/extend", json={"months": 12})
    sign_in(client, "s1@gvs.edu")
    assert client.get("/api/me").json()["plan"] == "plus"


def test_campus_payment_by_link_and_by_hand(client, svc):
    oid, _ = make_org(client)
    link = client.post(f"/api/admin/orgs/{oid}/payment-link", json={"contactName": "Ms Iyer", "phone": "9876543210"})
    assert link.json()["amount"] == 1_769_882
    client.post(link.json()["url"])  # the fake payment page
    org = next(o for o in client.get("/api/admin/orgs").json()["orgs"] if o["id"] == oid)
    assert org["status"] == "paid"
    pays = client.get("/api/admin/payments").json()["payments"]
    assert pays[0]["base"] == 1_499_900 and pays[0]["cgst"] == 134_991  # Karnataka school, Karnataka seller
    oid2, _ = make_org(client, name="Blue Hills College", billingState="Delhi")
    paid = client.post(f"/api/admin/orgs/{oid2}/mark-paid", json={"reference": "NEFT-123"}).json()
    assert paid["igst"] == 269_982 and paid["number"].startswith("MM/2026-27/")
    assert client.post(f"/api/admin/orgs/{oid2}/mark-paid", json={"reference": "NEFT-123"}).status_code == 400


def test_metrics(client, clock):
    # two free users, one Plus monthly, one Pro annual, one paid Campus licence
    sign_in(client, "free1@x.com")
    sign_in(client, "free2@x.com")
    for email, plan, period in [("plus@x.com", "plus", "monthly"), ("pro@x.com", "pro", "annual")]:
        sign_in(client, email)
        body = {"plan": plan, "period": period, "name": "Nina", "phone": "9876543210", "state": "Kerala"}
        client.post(client.post("/api/billing/checkout", json=body).json()["url"])
    oid, _ = make_org(client)
    client.post(f"/api/admin/orgs/{oid}/mark-paid", json={"reference": "chq-1"})
    m = client.get("/api/admin/metrics").json()
    assert m["users"] == 5 and m["payingUsers"] == 2
    assert m["paying"] == {"plus_monthly": 1, "pro_annual": 1}
    assert m["mrr"] == 29_900 + 699_900 // 12 + 1_499_900 // 12
    assert m["arr"] == m["mrr"] * 12
    assert m["conversion"] == 2 / 5
    assert m["revenueAll"] == 29_900 + 699_900 + 1_499_900
    assert m["campus"]["paid"] == 1
