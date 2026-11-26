"""One-command demo data, with the UUIDs from contract/seed/s4-towing.json."""
import json
import uuid
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from towing.models import (AuditLog, TowConfig, TowDriver, TowOffer, TowRequest,
                           TrackingPoint)

SEED_DIR = Path(settings.BASE_DIR) / "seed"


def load(name):
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


class Command(BaseCommand):
    help = "Load S4 demo data (default: update in place; --reset: clean reload)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")

    def handle(self, *args, **opts):
        if opts["reset"]:
            TrackingPoint.objects.all().delete()
            TowOffer.objects.all().delete()
            TowRequest.objects.all().delete()
            TowDriver.objects.all().delete()
            AuditLog.objects.all().delete()
            TowConfig.objects.all().delete()

        data = load("s4-towing.json")
        profiles = {p["userId"]: p for p in load("tow-driver-profiles.json")["tow_drivers"]}
        for row in data["tow_drivers"]:
            user_id = row["userId"]
            profile = profiles.get(user_id, {})
            TowDriver.objects.update_or_create(
                user_id=uuid.UUID(user_id),
                defaults={
                    "full_name": profile.get("fullName", ""),
                    "phone": profile.get("phone", ""),
                    "plate": row.get("plate", ""),
                    "truck_type": row.get("truckType", ""),
                    "available": bool(row.get("available", False)),
                    "lat": row.get("lat"),
                    "lng": row.get("lng"),
                },
            )

        cfg = data["config"]
        TowConfig.objects.update_or_create(
            pk=1,
            defaults={
                "offer_timeout_seconds": cfg["offerTimeoutSeconds"],
                "max_offers": cfg["maxOffers"],
                "base_fee": cfg["baseFee"],
                "per_km": cfg["perKm"],
                "hotline": cfg["hotline"],
            },
        )

        for row in data["tow_requests"]:
            TowRequest.objects.update_or_create(
                pk=uuid.UUID(row["id"]),
                defaults={
                    "driver_id": uuid.UUID(row["driverId"]) if row.get("driverId") else None,
                    "guest_phone": row.get("guestPhone", ""),
                    "tracking_code": row["trackingCode"],
                    "pickup_lat": row["pickupLat"],
                    "pickup_lng": row["pickupLng"],
                    "pickup_address": row.get("pickupAddress", ""),
                    "destination_address": row.get("destinationAddress", ""),
                    "vehicle": row.get("vehicle", ""),
                    "issue": row.get("issue", ""),
                    "urgency": row.get("urgency", "NORMAL"),
                    "status": row.get("status", "SEARCHING"),
                },
            )

        self.stdout.write(self.style.SUCCESS(
            f"S4 seed loaded: {TowDriver.objects.count()} tow drivers, "
            f"{TowRequest.objects.count()} tow requests, config pk=1."
        ))
