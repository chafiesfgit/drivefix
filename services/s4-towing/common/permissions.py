import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission

from .errors import forbidden, not_found, unauthorized


class IsAuthenticatedUser(BasePermission):
    def has_permission(self, request, view):
        if request.user is None:
            raise unauthorized()
        return True


class HasRole(BasePermission):
    """Role check happens after token verification and before body validation."""

    roles = ()
    approved_required = False

    def has_permission(self, request, view):
        if request.user is None:
            raise unauthorized()
        if request.user.role not in self.roles:
            raise forbidden(f"Role {self.roles[0]} required")
        if self.approved_required and not request.user.approved:
            raise forbidden("Account not approved yet", "NOT_APPROVED")
        return True


class DriverOrGuest(BasePermission):
    """POST /tows: a DRIVER token, or no token plus a valid guestPhone."""

    def has_permission(self, request, view):
        if request.user is None:
            return True  # serializer requires guestPhone
        if request.user.role != "DRIVER":
            raise forbidden("Only drivers can request a tow")
        return True


class IsTowDriver(HasRole):
    roles = ("TOW_DRIVER",)


class IsApprovedTowDriver(HasRole):
    roles = ("TOW_DRIVER",)
    approved_required = True


class IsDispatcher(HasRole):
    roles = ("DISPATCHER", "ADMIN")


class CanSeeTowMixin(BasePermission):
    """Detail/track/cancel: owner, assigned driver, dispatcher, or tracking code."""

    def has_permission(self, request, view):
        from django.core.exceptions import ValidationError as DjangoValidationError

        from towing.models import TowRequest

        code = request.query_params.get("trackingCode")
        tow = None
        try:
            tow = TowRequest.objects.filter(pk=view.kwargs.get("id", "")).first()
        except (ValueError, DjangoValidationError, TypeError):
            pass
        if tow is None and code:
            tow = TowRequest.objects.filter(tracking_code=code).first()
        if tow is None:
            raise not_found("Tow request not found")
        view.tow = tow  # the view reuses it, no second query

        if code and code == tow.tracking_code:
            return True
        user = request.user
        if user is None:
            raise unauthorized()
        if (user.role in ("DISPATCHER", "ADMIN")
                or user.id == tow.driver_id
                or user.id == tow.assigned_tow_driver_id):
            return True
        raise forbidden("You cannot follow this request")


class HasServiceKey(BasePermission):
    """Service-to-service calls: X-Service-Key must equal SERVICE_KEY."""

    def has_permission(self, request, view):
        sent = request.headers.get("X-Service-Key", "")
        if not sent or not hmac.compare_digest(sent.encode(), settings.SERVICE_KEY.encode()):
            raise unauthorized("Invalid or missing X-Service-Key")
        return True
