from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


class AuthRateThrottle(SimpleRateThrottle):
    scope = "auth"

    def get_rate(self):
        return settings.AUTH_THROTTLE_RATE

    def get_cache_key(self, request, view):
        return f"throttle_{self.scope}_{self.get_ident(request)}"
