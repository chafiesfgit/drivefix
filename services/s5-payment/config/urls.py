from django.urls import include, path, re_path

from payments import views

api_patterns = [
    path("health", views.health),
    path("payments", views.payments_collection),
    path("payments/<str:pk>", views.payment_detail),
    path("payments/<str:pk>/cash-collected", views.cash_collected),
    path("payments/<str:pk>/refund", views.refund),
    path("pay/<str:token>", views.pay_session),
    path("pay/<str:token>/succeed", views.pay_succeed),
    path("pay/<str:token>/fail", views.pay_fail),
]

urlpatterns = [
    path("health", views.health),
    path("api/v1/", include(api_patterns)),
    # Anything else: JSON 404 (never an HTML page)
    re_path(r"^.*$", views.not_found),
]
