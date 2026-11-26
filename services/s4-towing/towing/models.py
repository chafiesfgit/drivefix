"""Own tables only. No ForeignKey to users or to another service's database.

The tow driver's display name/phone are snapshots copied at seed time from the
contract data, so the API can answer without calling S1.
"""
import uuid

from django.db import models
from django.utils import timezone


class TowDriver(models.Model):
    user_id = models.UUIDField(primary_key=True, editable=False)
    full_name = models.CharField(max_length=200, blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    plate = models.CharField(max_length=50, blank=True, default="")
    truck_type = models.CharField(max_length=50, blank=True, default="")
    available = models.BooleanField(default=False)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    position_at = models.DateTimeField(null=True, blank=True)
    last_poll_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.full_name or self.user_id} ({self.plate})"


class TowRequest(models.Model):
    class Status(models.TextChoices):
        SEARCHING = "SEARCHING"
        ASSIGNED = "ASSIGNED"
        EN_ROUTE = "EN_ROUTE"
        ARRIVED = "ARRIVED"
        COMPLETED = "COMPLETED"
        CANCELLED = "CANCELLED"
        NO_DRIVER = "NO_DRIVER"

    class Urgency(models.TextChoices):
        NORMAL = "NORMAL"
        URGENT = "URGENT"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver_id = models.UUIDField(null=True, blank=True, db_index=True)
    guest_phone = models.CharField(max_length=30, blank=True, default="")
    tracking_code = models.CharField(max_length=64, unique=True)
    pickup_lat = models.FloatField()
    pickup_lng = models.FloatField()
    pickup_address = models.CharField(max_length=300, blank=True, default="")
    destination_address = models.CharField(max_length=300, blank=True, default="")
    vehicle = models.CharField(max_length=150, blank=True, default="")
    issue = models.CharField(max_length=300, blank=True, default="")
    urgency = models.CharField(max_length=10, choices=Urgency.choices, default=Urgency.NORMAL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SEARCHING, db_index=True)
    estimated_price = models.IntegerField(null=True, blank=True)
    assigned_tow_driver_id = models.UUIDField(null=True, blank=True, db_index=True)
    eta_minutes = models.IntegerField(null=True, blank=True)
    offers_sent = models.IntegerField(default=0)
    payment_status = models.CharField(max_length=10, blank=True, default="")  # S5 callback, internal
    assigned_at = models.DateTimeField(null=True, blank=True)
    arrived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.tracking_code} ({self.status})"


class TowOffer(models.Model):
    class Status(models.TextChoices):
        OFFERED = "OFFERED"
        ACCEPTED = "ACCEPTED"
        DECLINED = "DECLINED"
        EXPIRED = "EXPIRED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(TowRequest, related_name="offers", on_delete=models.CASCADE)
    tow_driver = models.ForeignKey(TowDriver, related_name="offers", on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OFFERED, db_index=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    responded_at = models.DateTimeField(null=True, blank=True)
    distance_km = models.FloatField(null=True, blank=True)
    estimated_price = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-sent_at"]


class TrackingPoint(models.Model):
    request = models.ForeignKey(TowRequest, related_name="points", on_delete=models.CASCADE)
    lat = models.FloatField()
    lng = models.FloatField()
    at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["at"]


class TowConfig(models.Model):
    """Singleton row (pk=1) loaded from contract/seed/s4-towing.json."""

    offer_timeout_seconds = models.IntegerField(default=30)
    max_offers = models.IntegerField(default=3)
    base_fee = models.IntegerField(default=3000)
    per_km = models.IntegerField(default=120)
    hotline = models.CharField(max_length=50, default="+213555000000")


class AuditLog(models.Model):
    """Sensitive actions, as required by the backend spec (own table)."""

    actor_id = models.UUIDField(null=True, blank=True)
    action = models.CharField(max_length=80)
    entity = models.CharField(max_length=40)
    entity_id = models.CharField(max_length=64)
    at = models.DateTimeField(auto_now_add=True)
    detail = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-at"]
