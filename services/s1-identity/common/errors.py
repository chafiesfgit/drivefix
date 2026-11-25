from rest_framework.exceptions import APIException


class ApiError(APIException):
    """Raise this anywhere; the handler turns it into {error:{code,message,field}}."""

    def __init__(self, status_code, code, message, field=None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field = field
        super().__init__(detail=message)


def validation_error(message, field=None):
    return ApiError(400, "VALIDATION_ERROR", message, field)


def unauthorized(message="Authentication required", code="UNAUTHORIZED"):
    return ApiError(401, code, message)


def forbidden(message="You do not have permission", code="FORBIDDEN"):
    return ApiError(403, code, message)


def not_found(message="Not found", code="NOT_FOUND"):
    return ApiError(404, code, message)


def conflict(code, message, field=None):
    return ApiError(409, code, message, field)


def business_rule(code, message, field=None):
    return ApiError(422, code, message, field)
