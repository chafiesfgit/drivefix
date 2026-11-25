"""Thin HTTP layer over services.py."""
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from common.errors import forbidden, not_found, unauthorized, validation_error
from common.pagination import paginate
from common.permissions import (CanSeeTowMixin, DriverOrGuest, HasServiceKey,
                                IsApprovedTowDriver, IsDispatcher, IsTowDriver)

from . import services as svc
from .models import TowRequest
from .serializers import (AssignSerializer, AvailabilitySerializer,
                          CreateTowSerializer, PaymentResultSerializer,
                          PositionSerializer, StatusSerializer)


def _find_tow(request, view):
    """By UUID, or by trackingCode (guest tracking)."""
    raw = view.kwargs.get("id", "")
    code = request.query_params.get("trackingCode")
    try:
        tow = TowRequest.objects.filter(pk=raw).first()
    except (ValueError, DjangoValidationError, TypeError):
        tow = None
    if tow is None and code:
        tow = TowRequest.objects.filter(tracking_code=code).first()
    return tow


class CanSeeTow(CanSeeTowMixin):
    """Owner, assigned driver, DISPATCHER/ADMIN, or anyone with the tracking code."""


class HealthView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok", "service": "s4-towing", "db": "up"})


class TowsView(APIView):
    permission_classes = [DriverOrGuest]

    def post(self, request):
        serializer = CreateTowSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if request.user is None and not serializer.validated_data.get("guestPhone"):
            raise validation_error("A valid phone number is required", "guestPhone")
        tow = svc.create_tow(serializer.validated_data, request.user)
        return Response(svc.request_out(tow), status=201)


class TowDetailView(APIView):
    permission_classes = [CanSeeTow]

    def get(self, request, id):
        return Response(svc.detail_data(view_tow(request, self)))


class CancelView(APIView):
    permission_classes = [CanSeeTow]

    def post(self, request, id):
        return Response(svc.request_out(svc.cancel_tow(view_tow(request, self), request.user)))


class AvailabilityView(APIView):
    permission_classes = [IsApprovedTowDriver]

    def put(self, request):
        serializer = AvailabilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(svc.set_availability(request.user, serializer.validated_data["available"]))


class PositionView(APIView):
    permission_classes = [IsTowDriver]

    def put(self, request):
        serializer = PositionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        svc.update_position(request.user, serializer.validated_data["lat"],
                            serializer.validated_data["lng"])
        return Response(status=204)


class MyOfferView(APIView):
    permission_classes = [IsTowDriver]

    def get(self, request):
        return Response(svc.offer_out(svc.current_offer(request.user)))


class OfferActionView(APIView):
    permission_classes = [IsTowDriver]

    def post(self, request, id, action):
        offer = svc.get_offer_or_404(id)
        if offer.tow_driver_id != request.user.id:
            raise forbidden("Not your offer")
        if action == "accept":
            return Response(svc.request_out(svc.accept_offer(offer, request.user)))
        svc.decline_offer(offer, request.user)
        return Response(status=204)


class TowStatusView(APIView):
    permission_classes = [IsTowDriver]

    def patch(self, request, id):
        serializer = StatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tow = svc.get_tow_or_404(id)
        tow = svc.set_status(tow, serializer.validated_data["status"], request.user)
        return Response(svc.request_out(tow))


class TrackView(APIView):
    permission_classes = [CanSeeTow]

    def get(self, request, id):
        return Response(svc.track_data(view_tow(request, self)))


class DispatchBoardView(APIView):
    permission_classes = [IsDispatcher]

    def get(self, request):
        svc.expire_stale_offers()
        queryset = TowRequest.objects.all()
        status = request.query_params.get("status")
        if status:
            wanted = [s.strip() for s in status.split(",") if s.strip()]
            queryset = queryset.filter(status__in=wanted)
        return Response(paginate(request, queryset, lambda t: svc.request_out(t, detail=True)))


class AssignView(APIView):
    permission_classes = [IsDispatcher]

    def post(self, request, id):
        serializer = AssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tow = svc.assign_manual(svc.get_tow_or_404(id),
                                serializer.validated_data["towDriverId"], request.user)
        return Response(svc.request_out(tow))


class FleetView(APIView):
    permission_classes = [IsDispatcher]

    def get(self, request):
        svc.expire_stale_offers()
        return Response(svc.fleet_data())


class PaymentResultView(APIView):
    """Inbound callback from S5 only. No outbound call to S5 or S6."""

    authentication_classes = []
    permission_classes = [HasServiceKey]

    def post(self, request, towId):
        serializer = PaymentResultSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        svc.payment_result(towId, serializer.validated_data["status"])
        return Response(status=204)


def view_tow(request, view):
    """The permission class already resolved access; return the cached object."""
    tow = getattr(view, "tow", None)
    if tow is None:
        tow = _find_tow(request, view)
        if tow is None:
            raise not_found("Tow request not found")
    return tow
