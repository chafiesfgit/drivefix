from django.conf import settings

from .errors import validation_error


def _int(request, name, default, minimum, maximum=None):
    raw = request.query_params.get(name)
    if raw in (None, ""):
        return default
    try:
        value = int(raw)
    except ValueError:
        raise validation_error(f"{name} must be an integer", name)
    if value < minimum or (maximum is not None and value > maximum):
        limit = f"between {minimum} and {maximum}" if maximum else f"at least {minimum}"
        raise validation_error(f"{name} must be {limit}", name)
    return value


def paginate(request, queryset, to_dict):
    page = _int(request, "page", 1, 1)
    size = _int(request, "pageSize", settings.PAGE_SIZE_DEFAULT, 1, settings.PAGE_SIZE_MAX)
    total = queryset.count()
    start = (page - 1) * size
    return {
        "items": [to_dict(o) for o in queryset[start:start + size]],
        "page": page,
        "pageSize": size,
        "total": total,
    }
