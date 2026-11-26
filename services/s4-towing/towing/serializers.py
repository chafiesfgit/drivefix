"""Input validation only. Output shapes are built in services.py (camelCase)."""
import re

from rest_framework import serializers

PHONE_RE = re.compile(r"^0[567]\d{8}$")


def normalize_phone(value):
    """Accept a local Algerian number or +213..., return 0XXXXXXXXX or None."""
    if not value:
        return None
    v = str(value).strip().replace(" ", "").replace("-", "")
    if v.startswith("+213"):
        v = "0" + v[4:]
    elif v.startswith("00213"):
        v = "0" + v[5:]
    return v if PHONE_RE.fullmatch(v) else None


class CreateTowSerializer(serializers.Serializer):
    pickupLat = serializers.FloatField(required=True, min_value=-90, max_value=90)
    pickupLng = serializers.FloatField(required=True, min_value=-180, max_value=180)
    pickupAddress = serializers.CharField(required=False, allow_blank=True, max_length=300)
    destinationAddress = serializers.CharField(required=False, allow_blank=True, max_length=300)
    vehicle = serializers.CharField(required=False, allow_blank=True, max_length=150)
    issue = serializers.CharField(required=False, allow_blank=True, max_length=300)
    urgency = serializers.ChoiceField(choices=["NORMAL", "URGENT"], required=True)
    guestPhone = serializers.CharField(required=False, allow_blank=True, max_length=30)

    def validate_guestPhone(self, value):
        if value and not normalize_phone(value):
            raise serializers.ValidationError("A valid Algerian phone number is required")
        return normalize_phone(value) or value


class AvailabilitySerializer(serializers.Serializer):
    available = serializers.BooleanField(required=True)


class PositionSerializer(serializers.Serializer):
    lat = serializers.FloatField(required=True, min_value=-90, max_value=90)
    lng = serializers.FloatField(required=True, min_value=-180, max_value=180)


class StatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=["EN_ROUTE", "ARRIVED", "COMPLETED"], required=True
    )


class AssignSerializer(serializers.Serializer):
    towDriverId = serializers.UUIDField(required=True)


class PaymentResultSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["PAID", "FAILED"], required=True)
