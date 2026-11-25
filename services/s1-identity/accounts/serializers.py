"""Input validation (camelCase, like the API contract) and output formatting."""
import re
from datetime import timezone as dt_timezone

from django.conf import settings
from rest_framework import serializers

from .models import User

PHONE_RE = re.compile(r"^0[5-7]\d{8}$")


def normalize_phone(raw):
    p = re.sub(r"[\s\-.()]", "", raw or "")
    if p.startswith("+213"):
        p = "0" + p[4:]
    elif p.startswith("00213"):
        p = "0" + p[5:]
    return p


class PhoneField(serializers.CharField):
    def __init__(self, **kw):
        kw.setdefault("max_length", 20)
        super().__init__(**kw)

    def to_internal_value(self, data):
        phone = normalize_phone(super().to_internal_value(data))
        if not PHONE_RE.match(phone):
            raise serializers.ValidationError("Phone must be an Algerian mobile number, e.g. 0555123456")
        return phone


class PasswordField(serializers.CharField):
    def __init__(self, **kw):
        kw.setdefault("trim_whitespace", False)
        kw.setdefault("max_length", 128)
        kw.setdefault("min_length", settings.PASSWORD_MIN_LENGTH)
        super().__init__(**kw)


class OtpCodeField(serializers.RegexField):
    def __init__(self, **kw):
        super().__init__(r"^\d{%d}$" % settings.OTP_LENGTH,
                         error_messages={"invalid": f"Code must be {settings.OTP_LENGTH} digits"}, **kw)


LANGS = [c for c, _ in User.Language.choices]


class RegisterSerializer(serializers.Serializer):
    fullName = serializers.CharField(min_length=2, max_length=100)
    phone = PhoneField()
    password = PasswordField()
    role = serializers.ChoiceField(choices=User.SELF_REGISTER_ROLES)
    language = serializers.ChoiceField(choices=LANGS)
    businessName = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    wilaya = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    documentNumber = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    vehiclePlate = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")

    def validate(self, attrs):
        role = attrs["role"]
        needed = []
        if role != "DRIVER":
            needed += ["wilaya", "documentNumber"]
        if role in ("SUPPLIER", "MECHANIC"):
            needed.append("businessName")
        if role == "TOW_DRIVER":
            needed.append("vehiclePlate")
        for field in needed:
            if not attrs.get(field):
                raise serializers.ValidationError({field: f"{field} is required for role {role}"})
        return attrs


class VerifyOtpSerializer(serializers.Serializer):
    phone = PhoneField()
    code = OtpCodeField()


class PhoneOnlySerializer(serializers.Serializer):
    phone = PhoneField()


class LoginSerializer(serializers.Serializer):
    phone = PhoneField()
    password = serializers.CharField(trim_whitespace=False, max_length=128)


class ResetPasswordSerializer(serializers.Serializer):
    phone = PhoneField()
    code = OtpCodeField()
    newPassword = PasswordField()


class ProfileUpdateSerializer(serializers.Serializer):
    fullName = serializers.CharField(min_length=2, max_length=100, required=False)
    language = serializers.ChoiceField(choices=LANGS, required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError({"fullName": "Provide fullName and/or language"})
        return attrs


class RejectSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500)


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ACTIVE", "SUSPENDED"])
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


# ---------------------------------------------------------------- output
def iso(dt):
    if dt is None:
        return None
    return dt.astimezone(dt_timezone.utc).isoformat().replace("+00:00", "Z")


def user_out(u):
    return {
        "id": str(u.id),
        "fullName": u.full_name,
        "phone": u.phone,
        "role": u.role,
        "language": u.language,
        "status": u.status,
        "approved": u.approved,
        "createdAt": iso(u.created_at),
    }


def application_out(a):
    return {
        "id": str(a.id),
        "userId": str(a.user_id),
        "role": a.role,
        "fullName": a.user.full_name,
        "phone": a.user.phone,
        "businessName": a.business_name,
        "wilaya": a.wilaya,
        "documentNumber": a.document_number,
        "vehiclePlate": a.vehicle_plate,
        "status": a.status,
        "reason": a.reason,
        "createdAt": iso(a.created_at),
    }
