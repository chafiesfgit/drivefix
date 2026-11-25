from django.urls import include, path

from towing.views import HealthView

urlpatterns = [
    path("health", HealthView.as_view(), name="health"),
    path("api/v1/health", HealthView.as_view(), name="health-v1"),
    path("api/v1/", include("towing.urls")),
]
