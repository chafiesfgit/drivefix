"""S4 flows: dispatch, first-accept-wins, tracking, roles and error format."""
import time
import uuid

import jwt
from django.conf import settings
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from towing.models import TowDriver, TowOffer, TowRequest, TrackingPoint

DRIVER = "00000000-0000-4000-8000-000000000002"
DRIVER2 = "00000000-0000-4000-8000-000000000003"
TOW1 = "00000000-0000-4000-8000-000000000008"
TOW2 = "00000000-0000-4000-8000-000000000009"
DISPATCHER = "00000000-0000-4000-8000-000000000010"
MECHANIC = "00000000-0000-4000-8000-000000000006"
SEED_TOW = "00000000-0000-4000-8000-000000000601"
API = "/api/v1"


def token(sub, role="DRIVER", approved=True, expired=False):
    now = int(time.time())
    return jwt.encode(
        {"sub": sub, "role": role, "approved": approved,
         "iat": now - 7200, "exp": now - 3600 if expired else now + 3600},
        settings.JWT_SECRET, algorithm="HS256",
    )


class S4ApiTests(TestCase):
    def setUp(self):
        call_command("seed", "--reset", verbosity=0)
        self.client = APIClient()

    def auth(self, sub, role="DRIVER", approved=True, expired=False):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {token(sub, role, approved, expired)}")
        return self

    def sos(self, **extra):
        body = {"pickupLat": 36.7372, "pickupLng": 3.0865,
                "urgency": "URGENT", "pickupAddress": "Alger"}
        body.update(extra)
        return self.client.post(f"{API}/tows", body, format="json")

    def test_health_is_public(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(self.client.get(f"{API}/health").status_code, 200)

    def test_create_tow_roles_and_guest(self):
        self.auth(DRIVER)
        response = self.sos()
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["status"], "SEARCHING")
        self.assertTrue(data["trackingCode"].startswith("SOS-"))
        self.assertIsInstance(data["estimatedPrice"], int)

        self.client.credentials()
        response = self.sos(guestPhone="0661234567")
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("driverId", response.json())  # guests have no account
        self.assertIn("guestPhone", response.json())
        self.assertEqual(self.sos().status_code, 400)  # no token, no phone
        self.assertEqual(self.sos(guestPhone="123").json()["error"]["code"],
                         "VALIDATION_ERROR")

        self.client.credentials(HTTP_AUTHORIZATION="Bearer garbage.token.value")
        self.assertEqual(self.sos(guestPhone="0661234567").status_code, 401)
        wrong_secret = jwt.encode(
            {"sub": DRIVER, "role": "DRIVER", "approved": True, "exp": int(time.time()) + 3600},
            "this-is-not-the-shared-jwt-secret-000000", algorithm="HS256")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {wrong_secret}")
        self.assertEqual(self.sos().status_code, 401)
        self.auth(DRIVER, expired=True)
        self.assertEqual(self.sos().json()["error"]["code"], "TOKEN_EXPIRED")
        self.auth(MECHANIC, "MECHANIC")
        wrong = self.sos()
        self.assertEqual(wrong.status_code, 403)
        self.assertEqual(wrong.json()["error"]["code"], "FORBIDDEN")

    def test_detail_access_rules(self):
        response = self.client.get(f"{API}/tows/{SEED_TOW}")
        self.assertEqual(response.status_code, 401)
        response = self.client.get(f"{API}/tows/{SEED_TOW}",
                                   {"trackingCode": "SOS-DEMO01"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("request", response.json())
        # towDriver appears only once somebody is assigned.

        self.auth(DISPATCHER, "DISPATCHER")
        self.assertEqual(self.client.get(f"{API}/tows/{SEED_TOW}").status_code, 200)
        self.auth(DRIVER2)
        self.assertEqual(self.client.get(f"{API}/tows/{SEED_TOW}").status_code, 200)
        self.auth(DRIVER)
        forbidden = self.client.get(f"{API}/tows/{SEED_TOW}")
        self.assertEqual(forbidden.status_code, 403)
        self.assertEqual(forbidden.json()["error"]["code"], "FORBIDDEN")
        self.assertEqual(self.client.get(f"{API}/tows/not-a-uuid").status_code, 404)

    def test_availability_requires_approved_tow_driver(self):
        self.auth(TOW1, "TOW_DRIVER", approved=False)
        response = self.client.put(f"{API}/tow-drivers/me/availability",
                                   {"available": True}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "NOT_APPROVED")
        self.auth(DRIVER)
        self.assertEqual(self.client.put(f"{API}/tow-drivers/me/availability",
                                         {"available": True}, format="json").status_code, 403)
        self.auth(TOW1, "TOW_DRIVER")
        response = self.client.put(f"{API}/tow-drivers/me/availability",
                                   {"available": True}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"available": True})

    def test_first_accept_wins_and_late_accept_fails(self):
        self.auth(DRIVER)
        tow = self.sos().json()
        self.auth(TOW1, "TOW_DRIVER")
        offer = self.client.get(f"{API}/tow-drivers/me/offer").json()
        self.assertEqual(offer["requestId"], tow["id"])
        self.assertLessEqual(offer["secondsLeft"], 30)
        self.assertEqual(offer["status"], "OFFERED")

        self.auth(TOW2, "TOW_DRIVER")
        self.assertEqual(self.client.get(f"{API}/tow-drivers/me/offer").status_code, 404)
        self.assertEqual(self.client.post(f"{API}/tow-offers/{offer['id']}/accept").status_code, 403)

        self.auth(TOW1, "TOW_DRIVER")
        accepted = self.client.post(f"{API}/tow-offers/{offer['id']}/accept")
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.json()["status"], "ASSIGNED")
        self.assertEqual(accepted.json()["assignedTowDriverId"], TOW1)
        again = self.client.post(f"{API}/tow-offers/{offer['id']}/accept")
        self.assertEqual(again.status_code, 409)
        self.assertEqual(again.json()["error"]["code"], "OFFER_EXPIRED")
        self.assertEqual(self.client.get(f"{API}/tow-drivers/me/offer").status_code, 404)

    def test_decline_advances_and_three_failures_give_no_driver(self):
        TowDriver.objects.create(user_id=uuid.UUID("00000000-0000-4000-8000-000000000012"),
                                 plate="003", truck_type="Hook", available=True,
                                 lat=36.74, lng=3.07)
        self.auth(DRIVER)
        tow = self.sos().json()
        drivers = (TOW1, TOW2, "00000000-0000-4000-8000-000000000012")
        for _ in drivers:
            offer = None
            for driver_id in drivers:
                self.auth(driver_id, "TOW_DRIVER")
                candidate = self.client.get(f"{API}/tow-drivers/me/offer")
                if candidate.status_code == 200:
                    offer = candidate.json()
                    break
            self.assertIsNotNone(offer, "the next driver must receive an offer")
            self.assertEqual(offer["requestId"], tow["id"])
            self.assertEqual(self.client.post(
                f"{API}/tow-offers/{offer['id']}/decline").status_code, 204)
        self.auth(DRIVER)
        self.assertEqual(self.client.get(f"{API}/tows/{tow['id']}").json()["request"]["status"],
                         "NO_DRIVER")

    def test_expiry_is_lazy_and_moves_to_next_driver(self):
        self.auth(DRIVER)
        tow = self.sos().json()
        first = TowOffer.objects.filter(request_id=tow["id"]).first()
        first.expires_at = timezone.now() - timezone.timedelta(seconds=1)
        first.save(update_fields=["expires_at"])
        self.auth(TOW1, "TOW_DRIVER")
        self.assertEqual(self.client.get(f"{API}/tow-drivers/me/offer").status_code, 404)
        self.auth(TOW2, "TOW_DRIVER")
        self.assertEqual(self.client.get(f"{API}/tow-drivers/me/offer").json()["requestId"],
                         tow["id"])
        self.assertEqual(TowOffer.objects.get(pk=first.pk).status, "EXPIRED")

    def test_status_flow_and_live_tracking(self):
        self.auth(DRIVER)
        tow = self.sos().json()
        self.auth(TOW1, "TOW_DRIVER")
        offer = self.client.get(f"{API}/tow-drivers/me/offer").json()
        self.client.post(f"{API}/tow-offers/{offer['id']}/accept")

        illegal = self.client.patch(f"{API}/tows/{tow['id']}/status",
                                    {"status": "ARRIVED"}, format="json")
        self.assertEqual(illegal.status_code, 409)
        self.assertEqual(illegal.json()["error"]["code"], "STATE_CONFLICT")
        for status in ("EN_ROUTE", "ARRIVED", "COMPLETED"):
            response = self.client.patch(f"{API}/tows/{tow['id']}/status",
                                         {"status": status}, format="json")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["status"], status)
        self.assertEqual(self.client.patch(f"{API}/tows/{tow['id']}/status",
                                           {"status": "EN_ROUTE"},
                                           format="json").status_code, 409)

    def test_tracking_points_and_eta(self):
        self.auth(DRIVER)
        tow = self.sos().json()
        self.auth(TOW1, "TOW_DRIVER")
        offer = self.client.get(f"{API}/tow-drivers/me/offer").json()
        self.client.post(f"{API}/tow-offers/{offer['id']}/accept")
        self.assertEqual(self.client.patch(f"{API}/tows/{tow['id']}/status",
                                           {"status": "EN_ROUTE"},
                                           format="json").status_code, 200)
        self.assertEqual(self.client.put(f"{API}/tow-drivers/me/position",
                                         {"lat": 36.745, "lng": 3.07},
                                         format="json").status_code, 204)
        self.auth(DRIVER)
        track = self.client.get(f"{API}/tows/{tow['id']}/track")
        self.assertEqual(track.status_code, 200)
        self.assertIn("last", track.json())
        self.assertIsInstance(track.json()["trail"], list)
        self.assertEqual(len(track.json()["trail"]), 1)
        self.assertIsInstance(track.json()["etaMinutes"], int)
        self.assertEqual(TrackingPoint.objects.filter(request_id=tow["id"]).count(), 1)
        self.auth(TOW2, "TOW_DRIVER")
        self.assertEqual(self.client.get(f"{API}/tows/{tow['id']}/track").status_code, 403)

    def test_cancel_rules(self):
        self.client.credentials()
        guest = self.sos(guestPhone="0661234567").json()
        self.auth(DISPATCHER, "DISPATCHER")
        response = self.client.post(f"{API}/tows/{guest['id']}/cancel")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "CANCELLED")
        second = self.client.post(f"{API}/tows/{guest['id']}/cancel")
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json()["error"]["code"], "STATE_CONFLICT")
        self.auth(DRIVER)
        self.assertEqual(self.client.post(f"{API}/tows/{guest['id']}/cancel").status_code, 403)

    def test_dispatch_board_fleet_and_manual_assign(self):
        self.auth(DISPATCHER, "DISPATCHER")
        board = self.client.get(f"{API}/dispatch/tows", {"page": 1, "pageSize": 5})
        self.assertEqual(board.status_code, 200)
        self.assertEqual(set(board.json()), {"items", "page", "pageSize", "total"})
        fleet = self.client.get(f"{API}/dispatch/tow-drivers")
        self.assertEqual(fleet.status_code, 200)
        self.assertEqual(len(fleet.json()["items"]), 2)
        self.assertIn("busy", fleet.json()["items"][0])
        assigned = self.client.post(f"{API}/dispatch/tows/{SEED_TOW}/assign",
                                    {"towDriverId": TOW1}, format="json")
        self.assertEqual(assigned.status_code, 200)
        self.assertEqual(assigned.json()["assignedTowDriverId"], TOW1)
        self.auth(DRIVER)
        self.assertEqual(self.client.get(f"{API}/dispatch/tows").status_code, 403)

    def test_payment_callback_needs_service_key(self):
        self.assertEqual(self.client.post(f"{API}/internal/payments/{SEED_TOW}/result",
                                          {"status": "PAID"}, format="json").status_code, 401)
        self.client.credentials(HTTP_X_SERVICE_KEY=settings.SERVICE_KEY)
        self.assertEqual(self.client.post(f"{API}/internal/payments/{SEED_TOW}/result",
                                          {"status": "PAID"}, format="json").status_code, 204)
        self.assertEqual(self.client.post(
            f"{API}/internal/payments/00000000-0000-4000-8000-000000000999/result",
            {"status": "FAILED"}, format="json").status_code, 404)

    def test_seed_contract_ids_and_error_envelope(self):
        tow = TowRequest.objects.get(pk=uuid.UUID(SEED_TOW))
        self.assertEqual(tow.tracking_code, "SOS-DEMO01")
        self.assertEqual(TowDriver.objects.count(), 2)
        self.auth(DRIVER)
        response = self.client.get(f"{API}/tows/00000000-0000-4000-8000-000000000999")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(set(response.json()["error"]), {"code", "message"})
