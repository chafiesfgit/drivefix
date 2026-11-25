"""Every response must match docs/s1-identity.yaml (the contract shared with the team)."""
import uuid
from pathlib import Path

import yaml
from django.conf import settings

from .test_api import PW, ApiBase, reg_body

try:
    import jsonschema
except ImportError:  # pragma: no cover
    jsonschema = None

SPEC = yaml.safe_load((Path(settings.BASE_DIR) / "docs" / "s1-identity.yaml").read_text())


def deref(node):
    if isinstance(node, dict):
        if "$ref" in node:
            return deref(SPEC["components"]["schemas"][node["$ref"].split("/")[-1]])
        return {k: deref(v) for k, v in node.items() if k not in ("format", "example")}
    if isinstance(node, list):
        return [deref(i) for i in node]
    return node


class ContractTests(ApiBase):
    def check(self, response, method, path, status):
        self.assertEqual(response.status_code, status, response.content)
        op = SPEC["paths"][path][method]
        self.assertIn(str(status), op["responses"], f"{method.upper()} {path} {status} is not in the contract")
        content = op["responses"][str(status)].get("content")
        if content and jsonschema:
            jsonschema.validate(response.json(), deref(content["application/json"]["schema"]))
        elif not content:
            self.assertEqual(response.content, b"")

    def test_all_documented_calls(self):
        r = self.post("/auth/register", reg_body(role="MECHANIC", businessName="Garage Test",
                                                  wilaya="31 - Oran", documentNumber="RC-9"))
        self.check(r, "post", "/auth/register", 201)
        self.check(self.post("/auth/register", reg_body(role="MECHANIC", businessName="Garage Test",
                                                         wilaya="31 - Oran", documentNumber="RC-9", phone="bad")),
                   "post", "/auth/register", 400)
        r = self.post("/auth/verify-otp", {"phone": "0551112233", "code": "000000" if self.last_code() != "000000" else "111111"})
        self.check(r, "post", "/auth/verify-otp", 422)
        self.check(self.post("/auth/verify-otp", {"phone": "x"}), "post", "/auth/verify-otp", 400)
        self.check(self.post("/auth/resend-otp", {"phone": "0551112233"}), "post", "/auth/resend-otp", 422)
        r = self.post("/auth/verify-otp", {"phone": "0551112233", "code": self.last_code()})
        self.check(r, "post", "/auth/verify-otp", 200)
        self.check(self.post("/auth/register", reg_body(phone="0551112233")), "post", "/auth/register", 409)

        self.check(self.login("0551112233"), "post", "/auth/login", 200)
        self.check(self.login("0551112233", "wrong-password"), "post", "/auth/login", 401)
        self.check(self.post("/auth/login", {}), "post", "/auth/login", 400)
        self.check(self.post("/auth/forgot-password", {"phone": "0551112233"}), "post", "/auth/forgot-password", 204)
        self.check(self.post("/auth/forgot-password", {"phone": "1"}), "post", "/auth/forgot-password", 400)
        self.check(self.post("/auth/reset-password", {"phone": "0551112233", "code": "123456", "newPassword": "NewPassword9"}),
                   "post", "/auth/reset-password", 422)
        self.check(self.post("/auth/reset-password", {"phone": "0551112233"}), "post", "/auth/reset-password", 400)
        self.check(self.post("/auth/reset-password", {"phone": "0551112233", "code": self.last_code(),
                                                       "newPassword": "NewPassword9"}),
                   "post", "/auth/reset-password", 204)

        self.seed()
        driver = self.login("0555000002").json()
        tok = driver["token"]
        self.check(self.get("/users/me"), "get", "/users/me", 401)
        self.check(self.get("/users/me", token=tok), "get", "/users/me", 200)
        self.check(self.patch("/users/me", {"language": "ar"}, tok), "patch", "/users/me", 200)
        self.check(self.patch("/users/me", {"language": "xx"}, tok), "patch", "/users/me", 400)
        self.check(self.patch("/users/me", {"language": "ar"}, None), "patch", "/users/me", 401)
        key = {"HTTP_X_SERVICE_KEY": settings.SERVICE_KEY}
        self.check(self.get(f"/users/{driver['user']['id']}/public", **key), "get", "/users/{id}/public", 200)
        self.check(self.get(f"/users/{uuid.uuid4()}/public", **key), "get", "/users/{id}/public", 404)

        self.check(self.get("/admin/applications", token=tok), "get", "/admin/applications", 403)
        admin = self.login("0555000001").json()["token"]
        self.check(self.get("/admin/applications", token=admin), "get", "/admin/applications", 200)
        self.check(self.get("/admin/users?role=DRIVER&q=Karim", token=admin), "get", "/admin/users", 200)
        app = "00000000-0000-4000-8000-000000000900"
        self.check(self.post(f"/admin/applications/{app}/reject", {}, admin), "post", "/admin/applications/{id}/reject", 400)
        self.check(self.post(f"/admin/applications/{app}/reject", {"reason": "bad doc"}, admin),
                   "post", "/admin/applications/{id}/reject", 200)
        self.check(self.post(f"/admin/applications/{app}/approve", token=admin),
                   "post", "/admin/applications/{id}/approve", 409)
        self.check(self.post(f"/admin/applications/{uuid.uuid4()}/approve", token=admin),
                   "post", "/admin/applications/{id}/approve", 404)
        mech = "00000000-0000-4000-8000-000000000006"
        self.check(self.patch(f"/admin/users/{mech}/status", {"status": "SUSPENDED"}, admin),
                   "patch", "/admin/users/{id}/status", 200)
        self.check(self.patch(f"/admin/users/{uuid.uuid4()}/status", {"status": "ACTIVE"}, admin),
                   "patch", "/admin/users/{id}/status", 404)
        # approve path 200: fresh pending supplier
        self.post("/auth/register", reg_body(phone="0561234567", role="SUPPLIER", businessName="S", wilaya="16",
                                              documentNumber="D"))
        self.post("/auth/verify-otp", {"phone": "0561234567", "code": self.last_code()})
        from accounts.models import Application
        new_app = Application.objects.get(user__phone="0561234567")
        self.check(self.post(f"/admin/applications/{new_app.id}/approve", token=admin),
                   "post", "/admin/applications/{id}/approve", 200)
