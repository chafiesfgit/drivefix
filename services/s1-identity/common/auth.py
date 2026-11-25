import uuid

from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from .errors import forbidden, unauthorized


def issue_token(user):
    """JWT HS256 with claims: sub, role, approved, exp (+ iat/jti/token_type from SimpleJWT)."""
    token = AccessToken.for_user(user)
    token["role"] = user.role
    token["approved"] = bool(user.approved)
    return str(token)


class JWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        parts = get_authorization_header(request).split()
        if not parts:
            return None
        if parts[0].lower() != b"bearer" or len(parts) != 2:
            raise unauthorized("Authorization header must be: Bearer <token>", "TOKEN_INVALID")
        try:
            token = AccessToken(parts[1].decode("utf-8"))
            user_id = uuid.UUID(str(token["sub"]))
        except TokenError as exc:
            code = "TOKEN_EXPIRED" if "expired" in str(exc).lower() else "TOKEN_INVALID"
            raise unauthorized("Token expired" if code == "TOKEN_EXPIRED" else "Token invalid", code)
        except (UnicodeDecodeError, ValueError, KeyError):
            raise unauthorized("Token invalid", "TOKEN_INVALID")

        from accounts.models import User  # local import: app registry must be ready

        user = User.objects.filter(pk=user_id).first()
        if user is None:
            raise unauthorized("Account no longer exists", "TOKEN_INVALID")
        if user.status == User.Status.SUSPENDED:
            raise forbidden("Account suspended", "ACCOUNT_SUSPENDED")
        return user, token

    def authenticate_header(self, request):
        return "Bearer"
