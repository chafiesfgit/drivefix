import hmac
import uuid

import jwt
from django.conf import settings

from .errors import ApiError

# Roles that must be approved by the admin (the JWT carries the approved flag)
NEEDS_APPROVAL = ("SUPPLIER", "MECHANIC", "TOW_DRIVER")


def get_claims(request):
    """401 if the Bearer token is missing, invalid or expired. Claims: sub, role, approved, exp."""
    header = request.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        raise ApiError(401, "UNAUTHORIZED", "Missing or malformed Authorization header")
    token = header[7:].strip()
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "TOKEN_EXPIRED", "The token has expired")
    except jwt.InvalidTokenError:
        raise ApiError(401, "UNAUTHORIZED", "Invalid token")


def require_role(claims, roles, need_approved=False):
    """403 FORBIDDEN for a wrong role, 403 NOT_APPROVED for a pending account."""
    role = claims.get("role")
    if role not in roles:
        raise ApiError(403, "FORBIDDEN", "Your role cannot do this")
    if need_approved and role in NEEDS_APPROVAL and not claims.get("approved"):
        raise ApiError(403, "NOT_APPROVED", "Your account is not approved yet")


def user_uuid(claims):
    try:
        return uuid.UUID(str(claims.get("sub")))
    except ValueError:
        raise ApiError(401, "UNAUTHORIZED", "Invalid token subject")


def require_service_key(request):
    """Service-to-service calls carry X-Service-Key. Without it: 401."""
    sent = request.headers.get("X-Service-Key", "")
    if not sent or not hmac.compare_digest(sent.encode(), settings.SERVICE_KEY.encode()):
        raise ApiError(401, "UNAUTHORIZED", "Missing or invalid X-Service-Key")
