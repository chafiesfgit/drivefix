import secrets
from datetime import timedelta, timezone as dt_timezone

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from common.errors import ApiError
from .models import AuditLog, Payment, PaymentSession

# The only legal moves. Anything else -> 409 STATE_CONFLICT
ALLOWED = {("PENDING", "PAID"), ("PENDING", "FAILED"), ("PAID", "REFUNDED")}


def iso(value):
    return value.astimezone(dt_timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def audit(actor, action, payment):
    AuditLog.objects.create(actor_id=str(actor), action=action, entity="payment", entity_id=str(payment.id))


def pay_url(token):
    return f"{settings.FRONTEND_URL}/pay/{token}"


def active_session(payment):
    return payment.sessions.filter(expires_at__gt=timezone.now()).order_by("-expires_at").first()


def ensure_session_url(payment):
    """SANDBOX + PENDING: reuse the live session, or open a new one (the old one expired)."""
    session = active_session(payment)
    if session is None:
        session = PaymentSession.objects.create(
            token=secrets.token_urlsafe(24),
            payment=payment,
            expires_at=timezone.now() + timedelta(minutes=settings.SESSION_MINUTES),
        )
    return pay_url(session.token)


def existing_pay_url(payment):
    """payUrl is only shown for a SANDBOX payment that is still PENDING. Otherwise omit it."""
    if payment.method == "SANDBOX" and payment.status == "PENDING":
        session = active_session(payment)
        if session:
            return pay_url(session.token)
    return None


def serialize(payment, url=None):
    data = {
        "id": str(payment.id),
        "refType": payment.ref_type,
        "refId": str(payment.ref_id),
        "payerId": str(payment.payer_id),
        "amount": payment.amount,
        "method": payment.method,
        "status": payment.status,
        "createdAt": iso(payment.created_at),
    }
    if payment.paid_at:
        data["paidAt"] = iso(payment.paid_at)
    if url:
        data["payUrl"] = url
    return data


def change_status(payment_id, new_status, *, actor, action, reason="", check=None):
    """Lock the row, check the move is legal, save, write the audit log. Returns the payment."""
    with transaction.atomic():
        payment = Payment.objects.select_for_update().get(pk=payment_id)
        if (payment.status, new_status) not in ALLOWED:
            raise ApiError(409, "STATE_CONFLICT", f"Cannot go from {payment.status} to {new_status}")
        if check:
            check(payment)
        payment.status = new_status
        if new_status == "PAID":
            payment.paid_at = timezone.now()
        if new_status == "REFUNDED":
            payment.refund_reason = reason
        payment.save()
        audit(actor, action, payment)
    return payment
