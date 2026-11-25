"""S1 Identity service settings. Everything configurable comes from .env."""
import os
import re
import warnings
from datetime import timedelta
from pathlib import Path
from urllib.parse import unquote, urlparse

from dotenv import load_dotenv

warnings.filterwarnings("ignore", message="The HMAC key is")  # shared demo secret is short
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env(name, default=""):
    return os.environ.get(name, default)


def env_bool(name, default=False):
    return env(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def parse_duration(value, default_hours=24):
    """'24h' -> 24 hours, '30m', '7d', '90s'. A bare number means seconds."""
    m = re.fullmatch(r"\s*(\d+)\s*([smhd]?)\s*", value or "")
    if not m:
        return timedelta(hours=default_hours)
    n, unit = int(m.group(1)), m.group(2) or "s"
    return {"s": timedelta(seconds=n), "m": timedelta(minutes=n),
            "h": timedelta(hours=n), "d": timedelta(days=n)}[unit]


def database_from_url(url):
    """postgres://user:pass@host:5432/dbname  or  sqlite:///file. Empty -> local SQLite."""
    if not url:
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}
    p = urlparse(url)
    if p.scheme in ("postgres", "postgresql"):
        return {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": unquote(p.path.lstrip("/")),
            "USER": unquote(p.username or ""),
            "PASSWORD": unquote(p.password or ""),
            "HOST": p.hostname or "localhost",
            "PORT": str(p.port or 5432),
            "CONN_MAX_AGE": 60,
        }
    if p.scheme == "sqlite":
        name = unquote(p.path.lstrip("/")) or "db.sqlite3"
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / name}
    raise ValueError("DATABASE_URL must start with postgres:// or sqlite:///")


SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me")
DEBUG = env_bool("DEBUG", True)
ALLOWED_HOSTS = [h.strip() for h in env("ALLOWED_HOSTS", "*").split(",") if h.strip()]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "corsheaders",
    "rest_framework",
    "common",
    "accounts",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
APPEND_SLASH = False

DATABASES = {"default": database_from_url(env("DATABASE_URL"))}
AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# bcrypt first (cahier des charges), the others only so old hashes still verify.
import sys  # noqa: E402

TESTING = "test" in sys.argv
BCRYPT_ROUNDS = 4 if TESTING else int(env("BCRYPT_ROUNDS", "12"))
PASSWORD_HASHERS = [
    "common.hashers.ConfigurableBCryptHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True

# ---- CORS -------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [o.strip() for o in env("CORS_ORIGIN", "http://localhost:5173").split(",") if o.strip()]
CORS_ALLOW_HEADERS = ["authorization", "content-type", "x-service-key", "accept", "origin"]

AUTH_THROTTLE_RATE = env("THROTTLE_AUTH", "60/min")   # per IP, public /auth endpoints

# ---- DRF --------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_AUTHENTICATION_CLASSES": ["common.auth.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["common.permissions.IsAuthenticatedUser"],
    "EXCEPTION_HANDLER": "common.handlers.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [],
    "UNAUTHENTICATED_USER": None,
}

# ---- JWT (claims: sub, role, approved, exp) ---------------------------
JWT_SECRET = env("JWT_SECRET", "drivefix-demo-secret-change-me")
SIMPLE_JWT = {
    "ALGORITHM": "HS256",
    "SIGNING_KEY": JWT_SECRET,
    "ACCESS_TOKEN_LIFETIME": parse_duration(env("JWT_EXPIRES_IN", "24h")),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "sub",
    "AUTH_HEADER_TYPES": ("Bearer",),
    "UPDATE_LAST_LOGIN": False,
}

# ---- Service-to-service -----------------------------------------------
SERVICE_KEY = env("SERVICE_KEY", "drivefix-internal-key")
S6_URL = env("S6_URL", "http://localhost:4006/api/v1").rstrip("/")
S6_NOTIFY = env_bool("S6_NOTIFY", True)      # false = never call S6 (console only)
S6_TIMEOUT_SECONDS = 2
S6_ASYNC = env_bool("S6_ASYNC", True)      # send to S6 in a background thread (tests set False)

# ---- Business rules (cahier) -------------------------------------------
OTP_LENGTH = 6
OTP_TTL_SECONDS = 5 * 60
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_GAP_SECONDS = 60
OTP_FIXED_CODE = env("OTP_FIXED_CODE", "") if DEBUG else ""   # demo helper, e.g. 123456
LOGIN_MAX_FAILURES = 5
LOGIN_LOCK_MINUTES = 15
PASSWORD_MIN_LENGTH = 8
PAGE_SIZE_DEFAULT = 20
PAGE_SIZE_MAX = 100

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", "INFO")},
    "loggers": {"django.request": {"level": "ERROR"}},
}
