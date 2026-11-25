from django.db import connection
from django.http import JsonResponse


def health(request):
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
        db = "up"
    except Exception:
        db = "down"
    return JsonResponse({"status": "ok" if db == "up" else "degraded", "service": "s1-identity", "db": db},
                        status=200 if db == "up" else 503)


def not_found(request, exception=None):
    return JsonResponse({"error": {"code": "NOT_FOUND", "message": "Route not found"}}, status=404)


def server_error(request):
    return JsonResponse({"error": {"code": "INTERNAL_ERROR", "message": "Unexpected server error"}}, status=500)
