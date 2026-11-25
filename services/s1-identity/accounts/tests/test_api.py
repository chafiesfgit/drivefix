import io
import json
import uuid
from datetime import timedelta
from pathlib import Path
from unittest import mock

import jwt
from django.conf import settings
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Application, AuditLog, OtpCode, User

BASE = "/api/v1"
PW = "Password123"
SEED = Path(settings.BASE_DIR) / "seed" / "s1-identity.json"


def reg_body(**kw):
    body = {"fullName": "Test User", "phone": "0551112233", "password": PW, "role": "DRIVER", "language": "fr"}
    body.update(kw)
    return body


@override_settings(S6_NOTIFY=False, OTP_FIXED_CODE="", AUTH_THROTTLE_RATE="1000/min")
class ApiBase(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.c = APIClient()
        self.sent = []
        patcher = mock.patch("accounts.services.notify", side_effect=lambda u, t, v=None: self.sent.append((u, t, v)))
        patcher.start()
        self.addCleanup(patcher.stop)

    def last_code(self):
        return [v for _, t, v in self.sent if t.startswith("OTP_")][-1]["code"]

    def post(self, path, body=None, token=None, **extra):
        if token:
            extra["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        return self.c.post(BASE + path, body or {}, format="json", **extra)

    def get(self, path, token=None, **extra):
        if token:
            extra["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        return self.c.get(BASE + path, **extra)

    def patch(self, path, body, token=None):
        extra = {"HTTP_AUTHORIZATION": f"Bearer {token}"} if token else {}
        return self.c.patch(BASE + path, body, format="json", **extra)

    def make_driver(self, phone="0551112233"):
        self.post("/auth/register", reg_body(phone=phone))
        r = self.post("/auth/verify-otp", {"phone": phone, "code": self.last_code()})
        return r.json()["token"], r.json()["user"]

    def login(self, phone, password=PW):
        return self.post("/auth/login", {"phone": phone, "password": password})

    def seed(self):
        call_command("seed", stdout=io.StringIO())

    def admin_token(self):
        self.seed()
        return self.login("0555000001").json()["token"]


class RegisterTests(ApiBase):
    def test_register_driver_flow(self):
        r = self.post("/auth/register", reg_body())
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["otpSentTo"], "0551112233")
        u = User.objects.get(phone="0551112233")
        self.assertEqual(u.status, "PENDING_OTP")
        self.assertTrue(u.password.startswith("bcrypt_sha256$"))
        r = self.post("/auth/verify-otp", {"phone": "0551112233", "code": self.last_code()})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["user"]["status"], "ACTIVE")
        self.assertTrue(r.json()["user"]["approved"])

    def test_phone_formats_normalised(self):
        r = self.post("/auth/register", reg_body(phone="+213 551 11 22 33"))
        self.assertEqual(r.json()["otpSentTo"], "0551112233")

    def test_phone_taken(self):
        self.make_driver()
        r = self.post("/auth/register", reg_body())
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()["error"]["code"], "PHONE_TAKEN")
        self.assertEqual(r.json()["error"]["field"], "phone")

    def test_reregister_unverified_phone_allowed(self):
        self.post("/auth/register", reg_body(fullName="First Name"))
        r = self.post("/auth/register", reg_body(fullName="Second Name"))
        self.assertEqual(r.status_code, 201)
        self.assertEqual(User.objects.get(phone="0551112233").full_name, "Second Name")
        self.assertEqual(User.objects.count(), 1)

    def test_validation_errors(self):
        cases = [
            (reg_body(phone="12345"), "phone"),
            (reg_body(password="short"), "password"),
            (reg_body(role="ADMIN"), "role"),
            (reg_body(language="de"), "language"),
            (reg_body(fullName=""), "fullName"),
            (reg_body(role="SUPPLIER"), "wilaya"),
            (reg_body(role="TOW_DRIVER", wilaya="16", documentNumber="X1"), "vehiclePlate"),
        ]
        for body, field in cases:
            r = self.post("/auth/register", body)
            self.assertEqual(r.status_code, 400, body)
            self.assertEqual(r.json()["error"]["code"], "VALIDATION_ERROR")
            self.assertEqual(r.json()["error"]["field"], field, body)

    def test_bad_json(self):
        r = self.c.post(BASE + "/auth/register", "{not json", content_type="application/json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["error"]["code"], "VALIDATION_ERROR")

    def test_supplier_goes_pending_approval(self):
        self.post("/auth/register", reg_body(role="SUPPLIER", businessName="Pieces SARL", wilaya="16 - Alger",
                                              documentNumber="RC-1"))
        r = self.post("/auth/verify-otp", {"phone": "0551112233", "code": self.last_code()})
        self.assertEqual(r.json()["user"]["status"], "PENDING_APPROVAL")
        self.assertFalse(r.json()["user"]["approved"])
        claims = jwt.decode(r.json()["token"], settings.JWT_SECRET, algorithms=["HS256"])
        self.assertEqual(claims["role"], "SUPPLIER")
        self.assertIs(claims["approved"], False)
        self.assertEqual(Application.objects.filter(status="PENDING").count(), 1)


class OtpTests(ApiBase):
    def test_wrong_code_then_attempts_exhausted(self):
        self.post("/auth/register", reg_body())
        right = self.last_code()
        wrong = "000000" if right != "000000" else "111111"
        for i in range(5):
            r = self.post("/auth/verify-otp", {"phone": "0551112233", "code": wrong})
            self.assertEqual(r.status_code, 422)
            self.assertEqual(r.json()["error"]["code"], "OTP_INVALID")
        r = self.post("/auth/verify-otp", {"phone": "0551112233", "code": right})
        self.assertEqual(r.json()["error"]["code"], "OTP_ATTEMPTS_EXCEEDED")

    def test_expired(self):
        self.post("/auth/register", reg_body())
        OtpCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        r = self.post("/auth/verify-otp", {"phone": "0551112233", "code": self.last_code()})
        self.assertEqual(r.status_code, 422)
        self.assertEqual(r.json()["error"]["code"], "OTP_EXPIRED")

    def test_code_format(self):
        r = self.post("/auth/verify-otp", {"phone": "0551112233", "code": "12ab"})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["error"]["field"], "code")

    def test_code_single_use(self):
        self.post("/auth/register", reg_body())
        code = self.last_code()
        self.post("/auth/verify-otp", {"phone": "0551112233", "code": code})
        r = self.post("/auth/verify-otp", {"phone": "0551112233", "code": code})
        self.assertEqual(r.status_code, 422)

    def test_resend_gap_and_new_code(self):
        self.post("/auth/register", reg_body())
        r = self.post("/auth/resend-otp", {"phone": "0551112233"})
        self.assertEqual(r.status_code, 422)
        self.assertEqual(r.json()["error"]["code"], "OTP_RESEND_TOO_SOON")
        OtpCode.objects.update(created_at=timezone.now() - timedelta(seconds=61))
        r = self.post("/auth/resend-otp", {"phone": "0551112233"})
        self.assertEqual(r.status_code, 204)
        self.assertEqual(OtpCode.objects.filter(consumed=False).count(), 1)
        r = self.post("/auth/verify-otp", {"phone": "0551112233", "code": self.last_code()})
        self.assertEqual(r.status_code, 200)

    def test_resend_unknown_phone_is_silent(self):
        self.assertEqual(self.post("/auth/resend-otp", {"phone": "0559999999"}).status_code, 204)


class LoginTests(ApiBase):
    def test_login_ok_and_token_claims(self):
        self.make_driver()
        r = self.login("0551112233")
        self.assertEqual(r.status_code, 200)
        claims = jwt.decode(r.json()["token"], settings.JWT_SECRET, algorithms=["HS256"])
        self.assertEqual(claims["sub"], r.json()["user"]["id"])
        self.assertEqual(claims["role"], "DRIVER")
        self.assertIs(claims["approved"], True)
        self.assertAlmostEqual(claims["exp"] - claims["iat"], 24 * 3600, delta=5)

    def test_wrong_password_and_unknown_phone_look_same(self):
        self.make_driver()
        a = self.login("0551112233", "WrongPass1")
        b = self.login("0559999999", "WrongPass1")
        self.assertEqual((a.status_code, a.json()["error"]["code"]), (401, "INVALID_CREDENTIALS"))
        self.assertEqual((b.status_code, b.json()["error"]["code"]), (401, "INVALID_CREDENTIALS"))

    def test_lock_after_five_failures(self):
        self.make_driver()
        for _ in range(4):
            self.assertEqual(self.login("0551112233", "bad-password").status_code, 401)
        r = self.login("0551112233", "bad-password")
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (403, "ACCOUNT_LOCKED"))
        r = self.login("0551112233")  # right password still blocked while locked
        self.assertEqual(r.json()["error"]["code"], "ACCOUNT_LOCKED")
        User.objects.update(locked_until=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.login("0551112233").status_code, 200)

    def test_success_resets_failures(self):
        self.make_driver()
        for _ in range(3):
            self.login("0551112233", "bad-password")
        self.login("0551112233")
        self.assertEqual(User.objects.get(phone="0551112233").failed_login_attempts, 0)

    def test_unverified_phone_cannot_login(self):
        self.post("/auth/register", reg_body())
        r = self.login("0551112233")
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (403, "PHONE_NOT_VERIFIED"))

    def test_pending_supplier_can_login_with_approved_false(self):
        self.seed()
        r = self.login("0555000011")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["user"]["status"], "PENDING_APPROVAL")

    def test_throttle(self):
        with override_settings(AUTH_THROTTLE_RATE="3/min"):
            codes = [self.login("0551112233").status_code for _ in range(5)]
        self.assertEqual(codes[-1], 429)
        self.assertEqual(codes[:3], [401, 401, 401])


class PasswordResetTests(ApiBase):
    def test_full_reset_flow(self):
        self.make_driver()
        self.assertEqual(self.post("/auth/forgot-password", {"phone": "0551112233"}).status_code, 204)
        code = self.last_code()
        r = self.post("/auth/reset-password", {"phone": "0551112233", "code": code, "newPassword": "NewPassword9"})
        self.assertEqual(r.status_code, 204)
        self.assertEqual(self.login("0551112233").status_code, 401)
        self.assertEqual(self.login("0551112233", "NewPassword9").status_code, 200)

    def test_forgot_unknown_phone_is_silent(self):
        self.assertEqual(self.post("/auth/forgot-password", {"phone": "0559999999"}).status_code, 204)
        self.assertEqual(self.sent, [])

    def test_reset_wrong_code(self):
        self.make_driver()
        self.post("/auth/forgot-password", {"phone": "0551112233"})
        wrong = "000000" if self.last_code() != "000000" else "111111"
        r = self.post("/auth/reset-password", {"phone": "0551112233", "code": wrong, "newPassword": "NewPassword9"})
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (422, "OTP_INVALID"))

    def test_reset_clears_lock(self):
        self.make_driver()
        for _ in range(5):
            self.login("0551112233", "bad-password")
        self.post("/auth/forgot-password", {"phone": "0551112233"})
        self.post("/auth/reset-password", {"phone": "0551112233", "code": self.last_code(), "newPassword": "NewPassword9"})
        self.assertEqual(self.login("0551112233", "NewPassword9").status_code, 200)

    def test_signup_code_cannot_reset(self):
        self.make_driver()
        self.post("/auth/forgot-password", {"phone": "0551112233"})
        OtpCode.objects.filter(purpose="RESET").delete()
        r = self.post("/auth/reset-password", {"phone": "0551112233", "code": "123456", "newPassword": "NewPassword9"})
        self.assertEqual(r.status_code, 422)


class ProfileTests(ApiBase):
    def test_me_requires_token(self):
        r = self.get("/users/me")
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (401, "UNAUTHORIZED"))

    def test_bad_and_expired_token(self):
        self.assertEqual(self.get("/users/me", token="garbage").json()["error"]["code"], "TOKEN_INVALID")
        _, user = self.make_driver()
        expired = jwt.encode({"sub": user["id"], "role": "DRIVER", "approved": True, "token_type": "access",
                              "jti": "x", "exp": int(timezone.now().timestamp()) - 10}, settings.JWT_SECRET)
        self.assertEqual(self.get("/users/me", token=expired).json()["error"]["code"], "TOKEN_EXPIRED")

    def test_me_and_patch(self):
        token, user = self.make_driver()
        r = self.get("/users/me", token=token)
        self.assertEqual(r.json()["id"], user["id"])
        r = self.patch("/users/me", {"fullName": "New Name", "language": "ar"}, token)
        self.assertEqual((r.json()["fullName"], r.json()["language"]), ("New Name", "ar"))
        self.assertEqual(self.patch("/users/me", {}, token).status_code, 400)
        self.assertEqual(self.patch("/users/me", {"language": "xx"}, token).status_code, 400)

    def test_phone_and_role_cannot_be_patched(self):
        token, user = self.make_driver()
        self.patch("/users/me", {"fullName": "Okay Name", "role": "ADMIN", "phone": "0550000000"}, token)
        u = User.objects.get(pk=user["id"])
        self.assertEqual((u.role, u.phone), ("DRIVER", "0551112233"))

    def test_public_endpoint_needs_service_key(self):
        _, user = self.make_driver()
        self.assertEqual(self.get(f"/users/{user['id']}/public").status_code, 401)
        self.assertEqual(self.get(f"/users/{user['id']}/public", HTTP_X_SERVICE_KEY="nope").status_code, 401)
        key = {"HTTP_X_SERVICE_KEY": settings.SERVICE_KEY}
        r = self.get(f"/users/{user['id']}/public", **key)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.json()), {"id", "fullName", "phone"})
        self.assertEqual(self.get(f"/users/{uuid.uuid4()}/public", **key).status_code, 404)
        self.assertEqual(self.get("/users/not-a-uuid/public", **key).status_code, 404)

    def test_suspended_user_token_rejected(self):
        token, user = self.make_driver()
        User.objects.filter(pk=user["id"]).update(status="SUSPENDED")
        r = self.get("/users/me", token=token)
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (403, "ACCOUNT_SUSPENDED"))


class AdminTests(ApiBase):
    def test_non_admin_forbidden_and_anonymous_unauthorized(self):
        token, _ = self.make_driver()
        for path in ("/admin/applications", "/admin/users"):
            self.assertEqual(self.get(path, token=token).status_code, 403)
            self.assertEqual(self.get(path).status_code, 401)

    def test_list_pending_applications(self):
        t = self.admin_token()
        r = self.get("/admin/applications", token=t)
        self.assertEqual(r.status_code, 200)
        j = r.json()
        self.assertEqual((j["page"], j["pageSize"], j["total"]), (1, 20, 1))
        self.assertEqual(j["items"][0]["status"], "PENDING")
        self.assertEqual(j["items"][0]["businessName"], "Nouveau Fournisseur")

    def test_approve_flow_and_conflict(self):
        t = self.admin_token()
        app_id = "00000000-0000-4000-8000-000000000900"
        r = self.post(f"/admin/applications/{app_id}/approve", token=t)
        self.assertEqual((r.status_code, r.json()["status"]), (200, "APPROVED"))
        u = User.objects.get(phone="0555000011")
        self.assertEqual((u.status, u.approved), ("ACTIVE", True))
        self.assertEqual(self.post(f"/admin/applications/{app_id}/approve", token=t).status_code, 409)
        new_token = self.login("0555000011").json()["token"]
        self.assertIs(jwt.decode(new_token, settings.JWT_SECRET, algorithms=["HS256"])["approved"], True)
        self.assertTrue(AuditLog.objects.filter(action="APPLICATION_APPROVED").exists())

    def test_reject_needs_reason(self):
        t = self.admin_token()
        app_id = "00000000-0000-4000-8000-000000000900"
        r = self.post(f"/admin/applications/{app_id}/reject", {}, token=t)
        self.assertEqual((r.status_code, r.json()["error"]["field"]), (400, "reason"))
        r = self.post(f"/admin/applications/{app_id}/reject", {"reason": "   "}, token=t)
        self.assertEqual(r.status_code, 400)
        r = self.post(f"/admin/applications/{app_id}/reject", {"reason": "Document unreadable"}, token=t)
        self.assertEqual((r.status_code, r.json()["status"], r.json()["reason"]), (200, "REJECTED", "Document unreadable"))
        self.assertEqual(self.post(f"/admin/applications/{app_id}/approve", token=t).status_code, 409)
        self.assertFalse(User.objects.get(phone="0555000011").approved)

    def test_application_not_found(self):
        t = self.admin_token()
        self.assertEqual(self.post(f"/admin/applications/{uuid.uuid4()}/approve", token=t).status_code, 404)
        self.assertEqual(self.post("/admin/applications/xyz/approve", token=t).status_code, 404)

    def test_user_search_filters_and_paging(self):
        t = self.admin_token()
        r = self.get("/admin/users?pageSize=5&page=2", token=t).json()
        self.assertEqual((r["page"], r["pageSize"], r["total"], len(r["items"])), (2, 5, 11, 5))
        r = self.get("/admin/users?role=DRIVER", token=t).json()
        self.assertEqual(r["total"], 2)
        r = self.get("/admin/users?q=Garage", token=t).json()
        self.assertEqual(r["total"], 2)
        r = self.get("/admin/users?q=0555000004", token=t).json()
        self.assertEqual(r["items"][0]["fullName"], "Auto Pieces Bab Ezzouar")
        r = self.get("/admin/users?status=PENDING_APPROVAL", token=t).json()
        self.assertEqual(r["total"], 1)
        self.assertEqual(self.get("/admin/users?role=NOPE", token=t).status_code, 400)
        self.assertEqual(self.get("/admin/users?page=0", token=t).status_code, 400)
        self.assertEqual(self.get("/admin/users?pageSize=101", token=t).status_code, 400)
        self.assertNotIn("password", json.dumps(self.get("/admin/users", token=t).json()))

    def test_suspend_and_reactivate(self):
        t = self.admin_token()
        mech = "00000000-0000-4000-8000-000000000006"
        r = self.patch(f"/admin/users/{mech}/status", {"status": "SUSPENDED", "reason": "fraud"}, t)
        self.assertEqual((r.status_code, r.json()["status"]), (200, "SUSPENDED"))
        self.assertEqual(self.login("0555000006").json()["error"]["code"], "ACCOUNT_SUSPENDED")
        r = self.patch(f"/admin/users/{mech}/status", {"status": "ACTIVE"}, t)
        self.assertEqual(r.json()["status"], "ACTIVE")
        self.assertEqual(self.login("0555000006").status_code, 200)

    def test_reactivating_unapproved_user_returns_to_pending(self):
        t = self.admin_token()
        pend = "00000000-0000-4000-8000-000000000011"
        self.patch(f"/admin/users/{pend}/status", {"status": "SUSPENDED"}, t)
        r = self.patch(f"/admin/users/{pend}/status", {"status": "ACTIVE"}, t)
        self.assertEqual(r.json()["status"], "PENDING_APPROVAL")

    def test_admin_cannot_suspend_self_and_bad_status(self):
        t = self.admin_token()
        me = "00000000-0000-4000-8000-000000000001"
        self.assertEqual(self.patch(f"/admin/users/{me}/status", {"status": "SUSPENDED"}, t).status_code, 409)
        self.assertEqual(self.patch(f"/admin/users/{me}/status", {"status": "BANNED"}, t).status_code, 400)
        self.assertEqual(self.patch(f"/admin/users/{uuid.uuid4()}/status", {"status": "ACTIVE"}, t).status_code, 404)


class MiscTests(ApiBase):
    def test_health(self):
        for path in ("/health", "/api/v1/health"):
            r = self.c.get(path)
            self.assertEqual((r.status_code, r.json()["status"], r.json()["db"]), (200, "ok", "up"))

    def test_unknown_route_json_404(self):
        r = self.c.get(BASE + "/nope")
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (404, "NOT_FOUND"))

    def test_method_not_allowed(self):
        r = self.c.get(BASE + "/auth/login")
        self.assertEqual((r.status_code, r.json()["error"]["code"]), (405, "METHOD_NOT_ALLOWED"))

    def test_seed_is_idempotent_and_passwords_work(self):
        self.seed()
        self.seed()
        self.assertEqual(User.objects.count(), 11)
        self.assertEqual(Application.objects.count(), 1)
        for u in json.loads(SEED.read_text())["users"]:
            r = self.login(u["phone"])
            self.assertEqual(r.status_code, 200, u["phone"])
            self.assertEqual(r.json()["user"]["id"], u["id"])
            self.assertEqual(r.json()["user"]["role"], u["role"])

    def test_error_shape_always_has_code_message(self):
        r = self.post("/auth/login", {})
        e = r.json()["error"]
        self.assertTrue(e["code"] and e["message"])
