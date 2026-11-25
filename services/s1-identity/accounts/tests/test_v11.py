"""Contract v1.1 additions: POST /auth/refresh, the visible OTP console block, S6 types + mock SMS, login audit."""
import base64
import contextlib
import io
import json
import re
from unittest import mock

from django.conf import settings
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import Application, AuditLog, User
from accounts.notify import notify

from .test_api import ApiBase, reg_body
from .test_contract import SPEC, deref

try:
    import jsonschema
except ImportError:  # pragma: no cover
    jsonschema = None

BASE = "/api/v1"


def claims(token):
    payload = token.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))


class RefreshTests(ApiBase):
    def check_contract(self, response, status):
        self.assertEqual(response.status_code, status, response.content)
        op = SPEC["paths"]["/auth/refresh"]["post"]
        self.assertIn(str(status), op["responses"])
        if jsonschema:
            jsonschema.validate(response.json(), deref(op["responses"][str(status)]["content"]["application/json"]["schema"]))

    def test_refresh_returns_fresh_token_and_user(self):
        token, _ = self.make_driver()
        r = self.post("/auth/refresh", token=token)
        self.check_contract(r, 200)
        self.assertEqual(r.json()["user"]["role"], "DRIVER")
        self.assertTrue(claims(r.json()["token"])["approved"])

    def test_pending_user_gets_approved_token_after_admin_approval(self):
        self.post("/auth/register", reg_body(phone="0561234567", role="SUPPLIER", businessName="Pieces S",
                                              wilaya="16", documentNumber="RC-1"))
        old = self.post("/auth/verify-otp", {"phone": "0561234567", "code": self.last_code()}).json()["token"]
        self.assertFalse(claims(old)["approved"])
        r = self.post("/auth/refresh", token=old)
        self.check_contract(r, 200)
        self.assertFalse(claims(r.json()["token"])["approved"])  # still pending
        admin = self.admin_token()
        app = Application.objects.get(user__phone="0561234567")
        self.assertEqual(self.post(f"/admin/applications/{app.id}/approve", token=admin).status_code, 200)
        r = self.post("/auth/refresh", token=old)  # the OLD token, no new login
        self.check_contract(r, 200)
        self.assertTrue(claims(r.json()["token"])["approved"])
        self.assertTrue(r.json()["user"]["approved"])
        self.assertEqual(r.json()["user"]["status"], "ACTIVE")

    def test_refresh_needs_a_valid_token(self):
        self.check_contract(self.post("/auth/refresh"), 401)
        self.check_contract(self.post("/auth/refresh", token="garbage.token.here"), 401)

    def test_refresh_refuses_suspended_accounts(self):
        token, user = self.make_driver()
        admin = self.admin_token()
        self.patch(f"/admin/users/{user['id']}/status", {"status": "SUSPENDED"}, admin)
        r = self.post("/auth/refresh", token=token)
        self.check_contract(r, 403)
        self.assertEqual(r.json()["error"]["code"], "ACCOUNT_SUSPENDED")

    def test_login_is_audited(self):
        self.make_driver()
        self.assertEqual(self.login("0551112233").status_code, 200)
        self.assertTrue(AuditLog.objects.filter(action="LOGIN").exists())


@override_settings(S6_NOTIFY=False, OTP_FIXED_CODE="", AUTH_THROTTLE_RATE="1000/min")
class OtpConsoleTests(TestCase):
    """notify() is NOT mocked here: the real console output is captured."""

    BLOCK = re.compile(r"DriveFix OTP\s+phone (\d{10})\s+code (\d{6})\s+valid 5 min")

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.c = APIClient()

    def register(self, phone):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            r = self.c.post(BASE + "/auth/register", reg_body(phone=phone), format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return out.getvalue()

    def test_otp_block_is_printed_and_codes_are_random(self):
        first, second = self.register("0551112233"), self.register("0661112233")
        a, b = self.BLOCK.search(first), self.BLOCK.search(second)
        self.assertIsNotNone(a, first)
        self.assertIsNotNone(b, second)
        self.assertEqual(a.group(1), "0551112233")
        self.assertIn("=" * 64, first)
        self.assertNotEqual(a.group(2), b.group(2))  # random, never a fixed code
        self.assertTrue(first.isascii())

    def test_block_only_for_otp_messages(self):
        user = User.objects.create_user(phone="0771112233", password="Password123", full_name="X", role="DRIVER")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            notify(user, "ACCOUNT_APPROVED", {})
        self.assertNotIn("DriveFix OTP", out.getvalue())


@override_settings(S6_ASYNC=False)
class S6CallTests(TestCase):
    @override_settings(S6_NOTIFY=True)
    def test_otp_uses_spec_types_and_sends_a_mock_sms(self):
        user = User.objects.create_user(phone="0771112233", password="Password123", full_name="X", role="DRIVER")
        calls = []

        def fake_urlopen(req, timeout):
            calls.append((req.full_url, json.loads(req.data), req.headers.get("X-service-key")))
            return contextlib.nullcontext()

        with mock.patch("accounts.notify.urllib.request.urlopen", side_effect=fake_urlopen), \
                contextlib.redirect_stdout(io.StringIO()):
            notify(user, "OTP_SIGNUP", {"code": "483920", "minutes": 5})
        urls = [c[0] for c in calls]
        self.assertEqual(urls, [f"{settings.S6_URL}/notifications", f"{settings.S6_URL}/sms"])
        self.assertEqual(calls[0][1]["type"], "OTP_CODE")
        self.assertEqual(calls[1][1]["phone"], "0771112233")
        self.assertIn("483920", calls[1][1]["text"])
        self.assertEqual(calls[0][2], settings.SERVICE_KEY)

    @override_settings(S6_NOTIFY=True)
    def test_s6_down_never_breaks_s1(self):
        user = User.objects.create_user(phone="0771112233", password="Password123", full_name="X", role="DRIVER")
        with mock.patch("accounts.notify.urllib.request.urlopen", side_effect=OSError("down")), \
                contextlib.redirect_stdout(io.StringIO()):
            self.assertFalse(notify(user, "OTP_RESET", {"code": "111222", "minutes": 5}))

    @override_settings(S6_NOTIFY=True, S6_ASYNC=True)
    def test_s6_calls_do_not_block_the_request(self):
        import time
        user = User.objects.create_user(phone="0771112233", password="Password123", full_name="X", role="DRIVER")

        def slow(req, timeout):
            time.sleep(0.5)
            raise OSError("timed out")

        with mock.patch("accounts.notify.urllib.request.urlopen", side_effect=slow),                 contextlib.redirect_stdout(io.StringIO()):
            started = time.monotonic()
            notify(user, "OTP_SIGNUP", {"code": "123123", "minutes": 5})
            self.assertLess(time.monotonic() - started, 0.3)
