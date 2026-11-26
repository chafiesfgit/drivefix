import json
import time
import uuid
from datetime import timedelta

import jwt
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from payments.models import Payment, PaymentSession

SECRET = "test-secret"
KEY = "test-key"


def make_token(role, sub=None, approved=True, secret=SECRET, expires_in=3600):
    claims = {
        "sub": sub or str(uuid.uuid4()),
        "role": role,
        "approved": approved,
        "exp": int(time.time()) + expires_in,
    }
    return jwt.encode(claims, secret, algorithm="HS256")


@override_settings(
    JWT_SECRET=SECRET,
    SERVICE_KEY=KEY,
    S6_NOTIFY=False,
    S2_URL="",
    S4_URL="",
    FRONTEND_URL="http://localhost:5173",
)
class PaymentApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.driver_id = str(uuid.uuid4())

    # ---- helpers
    def create(self, method="SANDBOX", amount=5000, ref_id=None, payer=None, key=KEY, ref_type="ORDER", **extra):
        body = {
            "refType": ref_type,
            "refId": ref_id or str(uuid.uuid4()),
            "payerId": payer or self.driver_id,
            "amount": amount,
            "method": method,
        }
        body.update(extra)
        headers = {"HTTP_X_SERVICE_KEY": key} if key else {}
        return self.client.post(
            "/api/v1/payments", data=json.dumps(body), content_type="application/json", **headers
        )

    def auth(self, role, sub=None, **kwargs):
        return {"HTTP_AUTHORIZATION": "Bearer " + make_token(role, sub, **kwargs)}

    def post(self, url, body=None, **headers):
        return self.client.post(url, data=json.dumps(body or {}), content_type="application/json", **headers)

    def token_of(self, response):
        return response.json()["payUrl"].rsplit("/", 1)[1]

    # ---- health / errors
    def test_health(self):
        self.assertEqual(self.client.get("/health").json(), {"status": "ok"})
        self.assertEqual(self.client.get("/api/v1/health").json(), {"status": "ok"})

    def test_unknown_route_is_json_404(self):
        response = self.client.get("/api/v1/nothing")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "NOT_FOUND")

    # ---- POST /payments
    def test_create_sandbox_returns_pay_url(self):
        response = self.create()
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["payment"]["status"], "PENDING")
        self.assertIn("/pay/", data["payUrl"])
        self.assertEqual(data["payment"]["payUrl"], data["payUrl"])

    def test_create_cash_has_no_pay_url(self):
        data = self.create(method="CASH").json()
        self.assertNotIn("payUrl", data)
        self.assertNotIn("payUrl", data["payment"])

    def test_create_is_idempotent(self):
        ref = str(uuid.uuid4())
        first = self.create(ref_id=ref).json()
        second = self.create(ref_id=ref).json()
        self.assertEqual(first["payment"]["id"], second["payment"]["id"])
        self.assertEqual(Payment.objects.count(), 1)

    def test_service_key_required(self):
        self.assertEqual(self.create(key=None).status_code, 401)
        self.assertEqual(self.create(key="wrong").status_code, 401)

    def test_validation_errors(self):
        for extra, field in (
            ({"amount": 12.5}, "amount"),
            ({"amount": 0}, "amount"),
            ({"amount": "5000"}, "amount"),
            ({"method": "CARD"}, "method"),
            ({"refType": "CART"}, "refType"),
            ({"refId": "not-a-uuid"}, "refId"),
        ):
            response = self.create(**extra)
            self.assertEqual(response.status_code, 400, extra)
            error = response.json()["error"]
            self.assertEqual(error["code"], "VALIDATION_ERROR")
            self.assertEqual(error["field"], field)

    # ---- sandbox page
    def test_sandbox_success_flow(self):
        created = self.create(amount=7000)
        token = self.token_of(created)
        page = self.client.get(f"/api/v1/pay/{token}")
        self.assertEqual(page.status_code, 200)
        self.assertEqual(page.json()["amount"], 7000)
        self.assertTrue(page.json()["demo"])
        done = self.post(f"/api/v1/pay/{token}/succeed")
        self.assertEqual(done.status_code, 200)
        self.assertEqual(done.json()["status"], "PAID")
        self.assertIn("paidAt", done.json())
        self.assertNotIn("payUrl", done.json())
        self.assertEqual(self.post(f"/api/v1/pay/{token}/succeed").status_code, 409)
        self.assertEqual(self.post(f"/api/v1/pay/{token}/fail").status_code, 409)

    def test_sandbox_fail_flow(self):
        token = self.token_of(self.create())
        done = self.post(f"/api/v1/pay/{token}/fail")
        self.assertEqual(done.status_code, 200)
        self.assertEqual(done.json()["status"], "FAILED")

    def test_unknown_token(self):
        self.assertEqual(self.client.get("/api/v1/pay/nope").status_code, 404)
        self.assertEqual(self.post("/api/v1/pay/nope/succeed").status_code, 404)

    def test_expired_session(self):
        ref = str(uuid.uuid4())
        first = self.create(ref_id=ref)
        token = self.token_of(first)
        PaymentSession.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
        page = self.client.get(f"/api/v1/pay/{token}")
        self.assertEqual(page.status_code, 410)
        self.assertEqual(page.json()["error"]["code"], "SESSION_EXPIRED")
        self.assertEqual(self.post(f"/api/v1/pay/{token}/succeed").status_code, 410)
        self.assertEqual(Payment.objects.get().status, "PENDING")
        # asking again gives a fresh session
        again = self.create(ref_id=ref)
        self.assertNotEqual(self.token_of(again), token)

    # ---- cash
    def test_cash_collected_flow(self):
        payment_id = self.create(method="CASH").json()["payment"]["id"]
        url = f"/api/v1/payments/{payment_id}/cash-collected"
        self.assertEqual(self.post(url, **self.auth("DRIVER")).status_code, 403)
        self.assertEqual(self.post(url, **self.auth("TOW_DRIVER")).status_code, 403)  # order cash
        self.assertEqual(self.post(url).status_code, 401)
        self.assertEqual(self.post(url, **self.auth("SUPPLIER", approved=False)).status_code, 403)
        done = self.post(url, **self.auth("SUPPLIER"))
        self.assertEqual(done.status_code, 200)
        self.assertEqual(done.json()["status"], "PAID")
        self.assertEqual(self.post(url, **self.auth("SUPPLIER")).status_code, 409)

    def test_tow_cash_is_collected_by_tow_driver(self):
        payment_id = self.create(method="CASH", ref_type="TOW").json()["payment"]["id"]
        url = f"/api/v1/payments/{payment_id}/cash-collected"
        self.assertEqual(self.post(url, **self.auth("SUPPLIER")).status_code, 403)
        self.assertEqual(self.post(url, **self.auth("TOW_DRIVER")).status_code, 200)

    def test_sandbox_payment_cannot_be_cash_collected(self):
        payment_id = self.create(method="SANDBOX").json()["payment"]["id"]
        response = self.post(f"/api/v1/payments/{payment_id}/cash-collected", **self.auth("SUPPLIER"))
        self.assertEqual(response.status_code, 409)

    # ---- refund
    def test_refund(self):
        payment_id = self.create(method="CASH").json()["payment"]["id"]
        url = f"/api/v1/payments/{payment_id}/refund"
        admin = self.auth("ADMIN")
        self.assertEqual(self.post(url, {"reason": "x"}, **self.auth("DRIVER")).status_code, 403)
        self.assertEqual(self.post(url, {"reason": "x"}, **admin).status_code, 409)  # still PENDING
        self.post(f"/api/v1/payments/{payment_id}/cash-collected", **self.auth("SUPPLIER"))
        missing = self.post(url, {}, **admin)
        self.assertEqual(missing.status_code, 400)
        self.assertEqual(missing.json()["error"]["field"], "reason")
        ok = self.post(url, {"reason": "Wrong part"}, **admin)
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["status"], "REFUNDED")
        self.assertEqual(self.post(url, {"reason": "again"}, **admin).status_code, 409)

    # ---- reading
    def test_detail_permissions(self):
        payment_id = self.create().json()["payment"]["id"]
        url = f"/api/v1/payments/{payment_id}"
        self.assertEqual(self.client.get(url).status_code, 401)
        self.assertEqual(self.client.get(url, HTTP_AUTHORIZATION="Bearer garbage").status_code, 401)
        wrong_secret = {"HTTP_AUTHORIZATION": "Bearer " + make_token("ADMIN", secret="other")}
        self.assertEqual(self.client.get(url, **wrong_secret).status_code, 401)
        expired = self.client.get(url, **self.auth("ADMIN", expires_in=-10))
        self.assertEqual(expired.status_code, 401)
        self.assertEqual(self.client.get(url, **self.auth("DRIVER", sub=self.driver_id)).status_code, 200)
        self.assertEqual(self.client.get(url, **self.auth("DRIVER")).status_code, 403)
        self.assertEqual(self.client.get(url, **self.auth("ADMIN")).status_code, 200)

    def test_bad_id_in_url_is_404(self):
        response = self.client.get("/api/v1/payments/not-a-uuid", **self.auth("ADMIN"))
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/payments/{uuid.uuid4()}", **self.auth("ADMIN")).status_code, 404)

    def test_list_scope_filters_and_envelope(self):
        other = str(uuid.uuid4())
        ref = str(uuid.uuid4())
        self.create(ref_id=ref)
        self.create(payer=other)
        mine = self.client.get("/api/v1/payments", **self.auth("DRIVER", sub=self.driver_id)).json()
        self.assertEqual(set(mine), {"items", "page", "pageSize", "total"})
        self.assertEqual(mine["total"], 1)
        everything = self.client.get("/api/v1/payments", **self.auth("ADMIN")).json()
        self.assertEqual(everything["total"], 2)
        by_ref = self.client.get(f"/api/v1/payments?refId={ref}", **self.auth("ADMIN")).json()
        self.assertEqual(by_ref["total"], 1)
        self.assertEqual(self.client.get("/api/v1/payments?status=NOPE", **self.auth("ADMIN")).status_code, 400)
        self.assertEqual(self.client.get("/api/v1/payments?page=0", **self.auth("ADMIN")).status_code, 400)
        self.assertEqual(self.client.get("/api/v1/payments").status_code, 401)
