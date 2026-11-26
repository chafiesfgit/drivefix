"""Local JWT verification: S4 never calls S1.

S1 signs HS256 tokens with the shared JWT_SECRET and claims sub/role/approved/exp.
We decode with that same secret; no HTTP call, no local user table for auth.
"""
import uuid

import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header

from .errors import unauthorized


class ClaimsUser:
    """The authenticated side of a token, built only from its claims."""

    is_authenticated = True
    is_anonymous = False

    def __init__(self, claims):
        self.claims = claims
        self.id = uuid.UUID(str(claims["sub"]))
        self.role = claims.get("role", "")
        self.approved = bool(claims.get("approved", False))

    @property
    def pk(self):
        return self.id

    def __str__(self):
        return str(self.id)


class JWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        parts = get_authorization_header(request).split()
        if not parts:
            return None  # guest routes decide in their permission class
        if parts[0].lower() != b"bearer" or len(parts) != 2:
            raise unauthorized("Authorization header must be: Bearer <token>", "TOKEN_INVALID")
        try:
            claims = jwt.decode(
                parts[1].decode("utf-8"),
                settings.JWT_SECRET,
                algorithms=["HS256"],
                options={"require": ["sub", "role", "exp"]},
            )
            user = ClaimsUser(claims)
        except jwt.ExpiredSignatureError:
            raise unauthorized("Token expired", "TOKEN_EXPIRED")
        except (jwt.InvalidTokenError, UnicodeDecodeError, ValueError, KeyError, TypeError):
            raise unauthorized("Token invalid", "TOKEN_INVALID")
        return user, claims

    def authenticate_header(self, request):
        return "Bearer"
