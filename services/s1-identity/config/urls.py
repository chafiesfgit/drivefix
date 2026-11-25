from django.urls import include, path

from common.views import health, not_found, server_error

handler404 = not_found
handler500 = server_error

urlpatterns = [
    path("health", health),
    path("api/v1/health", health),
    path("api/v1/", include("accounts.urls")),
]
