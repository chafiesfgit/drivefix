"""S4 Towing settings. Everything configurable comes from .env.

Root README.md / contract/ are the source of truth: port 4004, /api/v1,
shared JWT_SECRET and SERVICE_KEY, one database per service. There is no
external database server in the demo: an empty DATABASE_URL means Django's
own SQLite file, tow_db.sqlite3 (gitignored).
"""
import os
import warnings
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


def env_int(name, default):
    try:
        return int(env(name, str(default)))
    except ValueError:
        return default


def database_from_url(url):
    """Empty -> local SQLite (Django's built-in DB, no server to install)."""
    if not url:
        return {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "tow_db.sqlite3",
            # The in-process expiry worker and requests can write at the same time.
            "OPTIONS": {"timeout": 20},
        }
    p = urlparse(url)
    if p.scheme == "sqlite":
        name = unquote(p.path.lstrip("/")) or "tow_db.sqlite3"
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / name,
                "OPTIONS": {"timeout": 20}}
    if p.scheme in ("postgres", "postgresql"):
        # Optional only. The demo has no external DB, so psycopg2 is not installed.
        return {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": unquote(p.path.lstrip("/")),
            "USER": unquote(p.username or ""),
            "PASSWORD": unquote(p.password or ""),
            "HOST": p.hostname or "localhost",
            "PORT": str(p.port or 5432),
        }
    raise ValueError("DATABASE_URL must be empty, sqlite:///... or postgres://...")


SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me")
DEBUG = env_bool("DEBUG", True)
ALLOWED_HOSTS = [h.strip() for h in env("ALLOWED_HOSTS", "*").split(",") if h.strip()]
APPEND_SLASH = False

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "corsheaders",
    "rest_framework",
    "common",
    "towing.apps.TowingConfig",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {"default": database_from_url(env("DATABASE_URL"))}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True

# ---- CORS (the frontend is on another port) -------------------------------
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in env("CORS_ORIGIN", "http://localhost:5173").split(",") if o.strip()
]
CORS_ALLOW_HEADERS = ["authorization", "content-type", "x-service-key", "accept", "origin"]
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

# ---- DRF: shared error format, local JWT verification ---------------------
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_AUTHENTICATION_CLASSES": ["common.auth.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["common.permissions.IsAuthenticatedUser"],
    "EXCEPTION_HANDLER": "common.handlers.api_exception_handler",
    "UNAUTHENTICATED_USER": None,
}

JWT_SECRET = env("JWT_SECRET", "drivefix-demo-secret-change-me")
SERVICE_KEY = env("SERVICE_KEY", "drivefix-internal-key")

# ---- S4 business rules ----------------------------------------------------
OFFER_TIMEOUT_SECONDS = env_int("OFFER_TIMEOUT_SECONDS", 30)
MAX_OFFERS = env_int("MAX_OFFERS", 3)
TOW_BASE_FEE = env_int("TOW_BASE_FEE", 3000)
TOW_PER_KM = env_int("TOW_PER_KM", 120)
HOTLINE = env("HOTLINE", "+213555000000")
TRACK_TRAIL_MAX = 30
SWEEPER_ENABLED = env_bool("SWEEPER_ENABLED", True)
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
