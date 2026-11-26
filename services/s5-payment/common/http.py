import json
import logging
import uuid
from functools import wraps

from .errors import ApiError, error_response

log = logging.getLogger("s5")


def api(*methods):
    """Wrap a view: method check + every error answered in the shared JSON format."""

    def decorator(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            try:
                if request.method not in methods:
                    raise ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed")
                return view(request, *args, **kwargs)
            except ApiError as exc:
                return error_response(exc.status, exc.code, exc.message, exc.field)
            except Exception:
                log.exception("Unhandled error")
                return error_response(500, "INTERNAL_ERROR", "Unexpected server error")

        return wrapper

    return decorator


def read_json(request):
    try:
        data = json.loads(request.body.decode("utf-8") or "")
    except (ValueError, UnicodeDecodeError):
        raise ApiError(400, "VALIDATION_ERROR", "Body must be valid JSON")
    if not isinstance(data, dict):
        raise ApiError(400, "VALIDATION_ERROR", "Body must be a JSON object")
    return data


def as_uuid(value, field):
    if not isinstance(value, str):
        raise ApiError(400, "VALIDATION_ERROR", f"{field} must be a UUID string", field)
    try:
        return uuid.UUID(value)
    except ValueError:
        raise ApiError(400, "VALIDATION_ERROR", f"{field} must be a UUID string", field)


def path_uuid(value):
    """A malformed id in the URL is simply 'not found'."""
    try:
        return uuid.UUID(value)
    except ValueError:
        raise ApiError(404, "NOT_FOUND", "Payment not found")


def page_params(request):
    def number(name, default, low, high):
        raw = request.GET.get(name)
        if raw in (None, ""):
            return default
        try:
            n = int(raw)
        except ValueError:
            raise ApiError(400, "VALIDATION_ERROR", f"{name} must be an integer", name)
        if n < low or n > high:
            raise ApiError(400, "VALIDATION_ERROR", f"{name} must be between {low} and {high}", name)
        return n

    return number("page", 1, 1, 1_000_000), number("pageSize", 20, 1, 100)
