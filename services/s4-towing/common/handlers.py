import logging

from django.http import Http404
from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler

from .errors import ApiError

log = logging.getLogger("towing")


def body(code, message, field=None):
    err = {"code": code, "message": message}
    if field:
        err["field"] = field
    return {"error": err}


def _first_error(detail, field=None):
    if isinstance(detail, dict):
        for key, value in detail.items():
            return _first_error(value, None if key == "non_field_errors" else key)
    if isinstance(detail, (list, tuple)) and detail:
        return _first_error(detail[0], field)
    return field, str(detail)


def api_exception_handler(exc, context):
    """Every failure is JSON, never a DRF/HTML page."""
    if isinstance(exc, ApiError):
        return Response(body(exc.code, exc.message, exc.field), status=exc.status_code)
    if isinstance(exc, exceptions.ValidationError):
        field, message = _first_error(exc.detail)
        return Response(body("VALIDATION_ERROR", message, field), status=400)
    if isinstance(exc, exceptions.ParseError):
        return Response(body("VALIDATION_ERROR", "Request body is not valid JSON"), status=400)
    if isinstance(exc, exceptions.UnsupportedMediaType):
        return Response(body("VALIDATION_ERROR", "Content-Type must be application/json"), status=415)
    if isinstance(exc, (exceptions.NotAuthenticated, exceptions.AuthenticationFailed)):
        return Response(body("UNAUTHORIZED", "Authentication required"), status=401)
    if isinstance(exc, exceptions.PermissionDenied):
        return Response(body("FORBIDDEN", "You do not have permission"), status=403)
    if isinstance(exc, (Http404, exceptions.NotFound)):
        return Response(body("NOT_FOUND", "Not found"), status=404)
    if isinstance(exc, exceptions.MethodNotAllowed):
        return Response(body("METHOD_NOT_ALLOWED", "Method not allowed"), status=405)
    response = exception_handler(exc, context)
    if response is not None:
        return Response(body("ERROR", "Request failed"), status=response.status_code)
    log.exception("Unhandled error", exc_info=exc)
    return Response(body("INTERNAL_ERROR", "Unexpected server error"), status=500)
