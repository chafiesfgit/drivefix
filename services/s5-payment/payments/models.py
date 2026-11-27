import uuid

from django.db import models
from django.utils import timezone

REF_TYPES = ("ORDER", "TOW")
METHODS = ("CASH", "SANDBOX")
STATUSES = ("PENDING", "PAID", "FAILED", "REFUNDED")


class Payment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ref_type = models.CharField(max_length=10, choices=[(x, x) for x in REF_TYPES])
    ref_id = models.UUIDField()
    payer_id = models.UUIDField()
    amount = models.PositiveIntegerField()  # integer DZD
    method = models.CharField(max_length=10, choices=[(x, x) for x in METHODS])
    status = models.CharField(max_length=10, choices=[(x, x) for x in STATUSES], default="PENDING")
    label = models.CharField(max_length=120, blank=True, default="")
    refund_reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "payments"
        ordering = ["-created_at"]
        constraints = [
            # idempotency: one payment per order / tow
            models.UniqueConstraint(fields=["ref_type", "ref_id"], name="uniq_payment_ref"),
        ]


class PaymentSession(models.Model):
    token = models.CharField(max_length=64, unique=True)
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="sessions")
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "payment_sessions"


class AuditLog(models.Model):
    actor_id = models.CharField(max_length=64)
    action = models.CharField(max_length=40)
    entity = models.CharField(max_length=40)
    entity_id = models.CharField(max_length=64)
    at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "audit_log"
        ordering = ["-at"]
