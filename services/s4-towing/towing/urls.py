from django.urls import path

from . import views

urlpatterns = [
    path("tows", views.TowsView.as_view(), name="tows-create"),
    path("tows/<str:id>", views.TowDetailView.as_view(), name="tow-detail"),
    path("tows/<str:id>/cancel", views.CancelView.as_view(), name="tow-cancel"),
    path("tows/<str:id>/status", views.TowStatusView.as_view(), name="tow-status"),
    path("tows/<str:id>/track", views.TrackView.as_view(), name="tow-track"),
    path("tow-drivers/me/availability", views.AvailabilityView.as_view(), name="availability"),
    path("tow-drivers/me/position", views.PositionView.as_view(), name="position"),
    path("tow-drivers/me/offer", views.MyOfferView.as_view(), name="my-offer"),
    path("tow-offers/<str:id>/accept", views.OfferActionView.as_view(), {"action": "accept"}, name="offer-accept"),
    path("tow-offers/<str:id>/decline", views.OfferActionView.as_view(), {"action": "decline"}, name="offer-decline"),
    path("dispatch/tows", views.DispatchBoardView.as_view(), name="dispatch-board"),
    path("dispatch/tows/<str:id>/assign", views.AssignView.as_view(), name="dispatch-assign"),
    path("dispatch/tow-drivers", views.FleetView.as_view(), name="dispatch-fleet"),
    path("internal/payments/<str:towId>/result", views.PaymentResultView.as_view(), name="payment-result"),
]
