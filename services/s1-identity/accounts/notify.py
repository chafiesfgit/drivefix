"""Calls to S6 Notification. Always best effort: 2 s timeout, failures only logged."""
import json
import logging
import sys
import threading
import urllib.request

from django.conf import settings

log = logging.getLogger("identity.notify")

OTP_TYPES = ("OTP_SIGNUP", "OTP_RESET")

# S1's internal message names -> the template types S6 knows (spec section 6).
S6_TYPES = {"OTP_SIGNUP": "OTP_CODE", "OTP_RESET": "PASSWORD_RESET"}

SMS_TEXT = {
    "OTP_SIGNUP": "DriveFix: your verification code is {code} (valid {minutes} min).",
    "OTP_RESET": "DriveFix: your password reset code is {code} (valid {minutes} min).",
}


def print_otp_block(phone, code, minutes):
    """Big ASCII block in the S1 console so the OTP is easy to read during the demo (Windows-safe)."""
    line = "=" * 64
    sys.stdout.write(f"\n{line}\n DriveFix OTP   phone {phone}   code {code}   valid {minutes} min\n{line}\n\n")
    sys.stdout.flush()


def _post(path, body):
    req = urllib.request.Request(
        f"{settings.S6_URL}{path}", data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", "X-Service-Key": settings.SERVICE_KEY})
    try:
        with urllib.request.urlopen(req, timeout=settings.S6_TIMEOUT_SECONDS):
            return True
    except Exception as exc:  # noqa: BLE001 - S6 down must never break S1
        log.warning("S6 %s unreachable, ignored (%s)", path, exc)
        return False


def notify(user, type_, variables=None):
    """Create a notification (and, for OTP codes, a mock SMS) in S6 for `user`. Never raises."""
    variables = variables or {}
    # Console copy so the OTP is readable in the demo even when S6 is not running.
    log.info("[SMS MOCK] to=%s type=%s vars=%s", user.phone, type_, variables)
    if type_ in OTP_TYPES:
        print_otp_block(user.phone, variables.get("code", "?"), variables.get("minutes", 5))
    if not settings.S6_NOTIFY:
        return False
    payload = {"userId": str(user.id), "type": S6_TYPES.get(type_, type_), "variables": variables,
               "language": user.language}
    sms = None
    if type_ in OTP_TYPES:
        # The spec's "Done when" for S6: the OTP must appear in the SMS log (POST /sms).
        sms = {"phone": user.phone, "text": SMS_TEXT[type_].format(code=variables.get("code", ""),
                                                                    minutes=variables.get("minutes", 5))}

    def send():
        ok = _post("/notifications", payload)
        if sms and ok:  # S6 unreachable: do not wait a second timeout for the SMS
            _post("/sms", sms)
        return ok

    if settings.S6_ASYNC:
        # Never make the user wait for S6 (spec: S6 being down must never block a flow).
        threading.Thread(target=send, name="s6-notify", daemon=True).start()
        return True
    return send()
