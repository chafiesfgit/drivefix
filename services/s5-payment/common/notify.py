"""Calls to other services: best effort, 2 s timeout, never block or break a payment."""
import json
import logging
import threading
import urllib.request

from django.conf import settings

log = logging.getLogger("s5")


def _post_json(url, payload):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json", "X-Service-Key": settings.SERVICE_KEY},
    )
    try:
        with urllib.request.urlopen(request, timeout=2) as response:
            log.info("POST %s -> %s", url, response.status)
    except Exception as exc:  # ignore on purpose
        log.warning("POST %s failed (ignored): %s", url, exc)


def fire(url, payload):
    if not url:
        return
    threading.Thread(target=_post_json, args=(url, payload), daemon=True).start()


def notify_user(payment):
    """S6 notification PAYMENT_PAID / PAYMENT_FAILED (variable: amount)."""
    kind = {"PAID": "PAYMENT_PAID", "FAILED": "PAYMENT_FAILED"}.get(payment.status)
    if not kind:
        return
    if not settings.S6_NOTIFY:
        log.info("S6_NOTIFY=false: would send %s to %s", kind, payment.payer_id)
        return
    fire(
        f"{settings.S6_URL}/notifications",
        {"userId": str(payment.payer_id), "type": kind, "variables": {"amount": payment.amount}},
    )


def callback_owner(payment):
    """Tell S2 (order) or S4 (tow) that the payment changed (PAID or FAILED).
    S2 contract: POST /internal/payments/{orderId}/result  body {status}
    S4: same shape for now (to confirm with its owner)."""
    if payment.status not in ("PAID", "FAILED"):
        return
    base = settings.S2_URL if payment.ref_type == "ORDER" else settings.S4_URL
    if not base:
        return
    fire(
        f"{base}/internal/payments/{payment.ref_id}/result",
        {"status": payment.status},
    )
