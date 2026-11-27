from django.http import JsonResponse


class ApiError(Exception):
    """Raise anywhere in a view: the @api decorator turns it into the shared error format."""

    def __init__(self, status, code, message, field=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.field = field


def error_response(status, code, message, field=None):
    body = {"error": {"code": code, "message": message}}
    if field:
        body["error"]["field"] = field
    return JsonResponse(body, status=status)
