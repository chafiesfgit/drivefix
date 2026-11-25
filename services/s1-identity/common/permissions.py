import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission

from .errors import forbidden, unauthorized


class IsAuthenticatedUser(BasePermission):
    def has_permission(self, request, view):
        if request.user is None:
            raise unauthorized()
        return True


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        if request.user is None:
            raise unauthorized()
        if request.user.role != "ADMIN":
            raise forbidden("Admin role required")
        return True


class HasServiceKey(BasePermission):
    """Service-to-service calls: header X-Service-Key must equal SERVICE_KEY."""

    def has_permission(self, request, view):
        sent = request.headers.get("X-Service-Key", "")
        if not sent or not hmac.compare_digest(sent.encode(), settings.SERVICE_KEY.encode()):
            raise unauthorized("Invalid or missing X-Service-Key")
        return True
