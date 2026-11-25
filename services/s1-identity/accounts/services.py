"""Business rules of S1. Views only parse input and call these functions."""
import hashlib
import hmac
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from common.auth import issue_token
from common.errors import business_rule, conflict, forbidden, not_found, unauthorized, validation_error

from .models import Application, AuditLog, OtpCode, User
from .notify import notify
from .serializers import user_out


def audit(actor, action, target_type, target_id, **details):
    AuditLog.objects.create(actor=actor, action=action, target_type=target_type,
                            target_id=str(target_id), details=details)


# ------------------------------------------------------------------ OTP
def _hash(user, purpose, code):
    msg = f"{user.id}:{purpose}:{code}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()


def _new_code():
    if settings.OTP_FIXED_CODE:
        return settings.OTP_FIXED_CODE
    return str(secrets.randbelow(10 ** settings.OTP_LENGTH)).zfill(settings.OTP_LENGTH)


def send_otp(user, purpose):
    """Invalidate older codes, create a fresh one and send it through S6."""
    OtpCode.objects.filter(user=user, purpose=purpose, consumed=False).update(consumed=True)
    code = _new_code()
    OtpCode.objects.create(user=user, purpose=purpose, code_hash=_hash(user, purpose, code),
                           expires_at=timezone.now() + timedelta(seconds=settings.OTP_TTL_SECONDS))
    notify(user, "OTP_SIGNUP" if purpose == OtpCode.Purpose.SIGNUP else "OTP_RESET",
           {"code": code, "minutes": settings.OTP_TTL_SECONDS // 60})


def _too_soon(user, purpose):
    last = OtpCode.objects.filter(user=user, purpose=purpose).order_by("-created_at").first()
    return bool(last and (timezone.now() - last.created_at).total_seconds() < settings.OTP_RESEND_GAP_SECONDS)


def _check_otp(user, purpose, code):
    """Raise a 422 if the code is not acceptable. Attempt counters are committed BEFORE raising."""
    error = None
    with transaction.atomic():
        otp = (OtpCode.objects.select_for_update()
               .filter(user=user, purpose=purpose, consumed=False).order_by("-created_at").first())
        if otp is None:
            error = ("OTP_INVALID", "No active code, request a new one")
        elif otp.expires_at <= timezone.now():
            error = ("OTP_EXPIRED", "Code expired, request a new one")
        elif otp.attempts >= settings.OTP_MAX_ATTEMPTS:
            error = ("OTP_ATTEMPTS_EXCEEDED", "Too many wrong attempts, request a new code")
        elif not hmac.compare_digest(otp.code_hash, _hash(user, purpose, code)):
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            error = ("OTP_INVALID", f"Wrong code, {settings.OTP_MAX_ATTEMPTS - otp.attempts} attempt(s) left")
        else:
            otp.consumed = True
            otp.save(update_fields=["consumed"])
    if error:
        raise business_rule(error[0], error[1], "code")


def _user_by_phone(phone):
    return User.objects.filter(phone=phone).first()


# ------------------------------------------------------------ register
@transaction.atomic
def register(data):
    phone = data["phone"]
    user = _user_by_phone(phone)
    if user is not None and user.status != User.Status.PENDING_OTP:
        raise conflict("PHONE_TAKEN", "This phone number is already registered", "phone")
    if user is None:
        user = User(phone=phone)
    # Re-registering an unverified number just refreshes the data.
    user.full_name = data["fullName"]
    user.role = data["role"]
    user.language = data["language"]
    user.status = User.Status.PENDING_OTP
    user.approved = False
    user.set_password(data["password"])
    user.save()
    if data["role"] != "DRIVER":
        Application.objects.filter(user=user, status=Application.Status.PENDING).delete()
        Application.objects.create(
            user=user, role=data["role"], business_name=data["businessName"], wilaya=data["wilaya"],
            document_number=data["documentNumber"], vehicle_plate=data["vehiclePlate"])
    audit(user, "REGISTER", "user", user.id, role=user.role)
    send_otp(user, OtpCode.Purpose.SIGNUP)
    return user


def verify_signup(phone, code):
    user = _user_by_phone(phone)
    if user is None or user.status != User.Status.PENDING_OTP:
        raise business_rule("OTP_INVALID", "No pending verification for this number", "code")
    _check_otp(user, OtpCode.Purpose.SIGNUP, code)
    if user.role == User.Role.DRIVER:
        user.status, user.approved = User.Status.ACTIVE, True
    else:
        user.status, user.approved = User.Status.PENDING_APPROVAL, False
    user.save(update_fields=["status", "approved", "updated_at"])
    audit(user, "OTP_VERIFIED", "user", user.id, status=user.status)
    if user.status == User.Status.PENDING_APPROVAL:
        notify(user, "ACCOUNT_PENDING", {})
    return {"token": issue_token(user), "user": user_out(user)}


def resend_signup_otp(phone):
    user = _user_by_phone(phone)
    if user is None or user.status != User.Status.PENDING_OTP:
        return  # silent: do not reveal which numbers exist
    if _too_soon(user, OtpCode.Purpose.SIGNUP):
        raise business_rule("OTP_RESEND_TOO_SOON",
                            f"Wait {settings.OTP_RESEND_GAP_SECONDS} seconds before asking for a new code")
    send_otp(user, OtpCode.Purpose.SIGNUP)


# --------------------------------------------------------------- login
def login(phone, password):
    user = _user_by_phone(phone)
    if user is None:
        raise unauthorized("Wrong phone or password", "INVALID_CREDENTIALS")
    now = timezone.now()
    if user.locked_until and user.locked_until > now:
        mins = int((user.locked_until - now).total_seconds() // 60) + 1
        raise forbidden(f"Too many failed attempts, try again in {mins} minute(s)", "ACCOUNT_LOCKED")
    if not user.check_password(password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.LOGIN_MAX_FAILURES:
            user.locked_until = now + timedelta(minutes=settings.LOGIN_LOCK_MINUTES)
            user.failed_login_attempts = 0
            user.save(update_fields=["failed_login_attempts", "locked_until", "updated_at"])
            audit(user, "LOGIN_LOCKED", "user", user.id)
            raise forbidden(f"Too many failed attempts, locked for {settings.LOGIN_LOCK_MINUTES} minutes",
                            "ACCOUNT_LOCKED")
        user.save(update_fields=["failed_login_attempts", "updated_at"])
        raise unauthorized("Wrong phone or password", "INVALID_CREDENTIALS")
    if user.status == User.Status.PENDING_OTP:
        raise forbidden("Phone not verified yet, enter the code we sent you", "PHONE_NOT_VERIFIED")
    if user.status == User.Status.SUSPENDED:
        raise forbidden("Account suspended, contact support", "ACCOUNT_SUSPENDED")
    if user.failed_login_attempts or user.locked_until:
        user.failed_login_attempts, user.locked_until = 0, None
        user.save(update_fields=["failed_login_attempts", "locked_until", "updated_at"])
    audit(user, "LOGIN", "user", user.id)  # spec: every login goes to the audit log
    return {"token": issue_token(user), "user": user_out(user)}


# ------------------------------------------------------ password reset
def forgot_password(phone):
    user = _user_by_phone(phone)
    if user is None or user.status in (User.Status.PENDING_OTP, User.Status.SUSPENDED):
        return  # silent
    if _too_soon(user, OtpCode.Purpose.RESET):
        return  # silent, same 60 s gap
    send_otp(user, OtpCode.Purpose.RESET)


def reset_password(phone, code, new_password):
    user = _user_by_phone(phone)
    if user is None or user.status in (User.Status.PENDING_OTP, User.Status.SUSPENDED):
        raise business_rule("OTP_INVALID", "Invalid code", "code")
    _check_otp(user, OtpCode.Purpose.RESET, code)
    user.set_password(new_password)
    user.failed_login_attempts, user.locked_until = 0, None
    user.save()
    audit(user, "PASSWORD_RESET", "user", user.id)


# ------------------------------------------------------------- profile
def update_profile(user, data):
    if "fullName" in data:
        user.full_name = data["fullName"]
    if "language" in data:
        user.language = data["language"]
    user.save(update_fields=["full_name", "language", "updated_at"])
    return user


# --------------------------------------------------------------- admin
def parse_uuid(value, label):
    try:
        return uuid.UUID(str(value))
    except ValueError:
        raise not_found(f"{label} not found")


def _get_application(app_id):
    try:
        return Application.objects.select_related("user").get(pk=parse_uuid(app_id, "Application"))
    except Application.DoesNotExist:
        raise not_found("Application not found")


@transaction.atomic
def approve_application(admin, app_id):
    app = _get_application(app_id)
    if app.status != Application.Status.PENDING:
        raise conflict("STATE_CONFLICT", f"Application already {app.status}")
    if app.user.status == User.Status.PENDING_OTP:
        raise conflict("STATE_CONFLICT", "User has not verified the phone yet")
    app.status = Application.Status.APPROVED
    app.reviewed_by, app.reviewed_at = admin, timezone.now()
    app.save()
    user = app.user
    user.approved, user.status = True, User.Status.ACTIVE
    user.save(update_fields=["approved", "status", "updated_at"])
    audit(admin, "APPLICATION_APPROVED", "application", app.id, userId=str(user.id))
    notify(user, "ACCOUNT_APPROVED", {})
    return app


@transaction.atomic
def reject_application(admin, app_id, reason):
    reason = reason.strip()
    if not reason:
        raise validation_error("Reason is required", "reason")
    app = _get_application(app_id)
    if app.status != Application.Status.PENDING:
        raise conflict("STATE_CONFLICT", f"Application already {app.status}")
    app.status, app.reason = Application.Status.REJECTED, reason
    app.reviewed_by, app.reviewed_at = admin, timezone.now()
    app.save()
    audit(admin, "APPLICATION_REJECTED", "application", app.id, userId=str(app.user_id), reason=reason)
    notify(app.user, "ACCOUNT_REJECTED", {"reason": reason})
    return app


@transaction.atomic
def set_user_status(admin, user_id, status, reason=""):
    try:
        user = User.objects.select_for_update().get(pk=parse_uuid(user_id, "User"))
    except User.DoesNotExist:
        raise not_found("User not found")
    if user.id == admin.id:
        raise conflict("STATE_CONFLICT", "You cannot change your own status")
    if user.status == User.Status.PENDING_OTP:
        raise conflict("STATE_CONFLICT", "User has not verified the phone yet")
    if status == "SUSPENDED":
        user.status = User.Status.SUSPENDED
        action = "USER_SUSPENDED"
    else:
        user.status = User.Status.ACTIVE if user.approved else User.Status.PENDING_APPROVAL
        user.failed_login_attempts, user.locked_until = 0, None
        action = "USER_REACTIVATED"
    user.save()
    audit(admin, action, "user", user.id, reason=reason)
    return user
