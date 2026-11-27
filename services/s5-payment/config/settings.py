import os
from pathlib import Path
from urllib.parse import urlparse, unquote

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


DEBUG = env_bool("DEBUG", True)
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "change-me-in-production")
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "corsheaders",
    "payments",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
APPEND_SLASH = False
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
TIME_ZONE = "UTC"


def build_database():
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}
    parsed = urlparse(url)
    if parsed.scheme in ("postgres", "postgresql"):
        return {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": parsed.path.lstrip("/"),
            "USER": unquote(parsed.username or ""),
            "PASSWORD": unquote(parsed.password or ""),
            "HOST": parsed.hostname or "localhost",
            "PORT": str(parsed.port or 5432),
        }
    raise ValueError("DATABASE_URL must start with postgres:// (or be empty for SQLite)")


DATABASES = {"default": build_database()}

# --- Shared contract values -------------------------------------------------
JWT_SECRET = os.getenv("JWT_SECRET", "drivefix-demo-secret-change-me")
SERVICE_KEY = os.getenv("SERVICE_KEY", "drivefix-internal-key")

CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("CORS_ORIGIN", "http://localhost:5173").split(",") if o.strip()
]
CORS_ALLOW_HEADERS = ["authorization", "content-type", "x-service-key", "accept", "origin"]
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

FRONTEND_URL = os.getenv("FRONTEND_URL", CORS_ALLOWED_ORIGINS[0] if CORS_ALLOWED_ORIGINS else "").rstrip("/")

# --- Other services ---------------------------------------------------------
S6_URL = os.getenv("S6_URL", "http://localhost:4006/api/v1").rstrip("/")
S6_NOTIFY = env_bool("S6_NOTIFY", True)
S2_URL = os.getenv("S2_URL", "http://localhost:4002/api/v1").rstrip("/")
S4_URL = os.getenv("S4_URL", "http://localhost:4004/api/v1").rstrip("/")

# --- S5 only ----------------------------------------------------------------
SESSION_MINUTES = int(os.getenv("SESSION_MINUTES", "15"))

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO")},
}
