"""All S4 business rules. Views stay thin; no call to any other service."""
import logging
import math
import secrets
from datetime import timedelta, timezone as dt_timezone

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone

from common.errors import conflict, forbidden, not_found

from .models import (AuditLog, TowConfig, TowDriver, TowOffer, TowRequest,
                     TrackingPoint)

log = logging.getLogger("towing")
EARTH_RADIUS_KM = 6371.0
ACTIVE_STATUSES = [TowRequest.Status.ASSIGNED, TowRequest.Status.EN_ROUTE,
                   TowRequest.Status.ARRIVED]
OPEN_STATUSES = [TowRequest.Status.SEARCHING] + ACTIVE_STATUSES


# ---- helpers -------------------------------------------------------------
def iso(dt):
    if dt is None:
        return None
    return dt.astimezone(dt_timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def config():
    """Seed values (contract/seed/s4-towing.json) with .env defaults as fallback."""
    cfg = TowConfig.objects.filter(pk=1).first()
    return {
        "offer_timeout_seconds": cfg.offer_timeout_seconds if cfg else settings.OFFER_TIMEOUT_SECONDS,
        "max_offers": cfg.max_offers if cfg else settings.MAX_OFFERS,
        "base_fee": cfg.base_fee if cfg else settings.TOW_BASE_FEE,
        "per_km": cfg.per_km if cfg else settings.TOW_PER_KM,
        "hotline": cfg.hotline if cfg else settings.HOTLINE,
    }


def haversine_km(lat1, lng1, lat2, lng2):
    """Straight-line distance is enough for dispatch (backend spec, S4)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlng = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def new_tracking_code():
    while True:
        code = "SOS-" + secrets.token_hex(3).upper()
        if not TowRequest.objects.filter(tracking_code=code).exists():
            return code


def audit(actor_id, action, entity, entity_id, detail=None):
    AuditLog.objects.create(actor_id=actor_id, action=action, entity=entity,
                            entity_id=str(entity_id), detail=detail or {})


def get_tow_or_404(tow_id):
    try:
        return TowRequest.objects.get(pk=tow_id)
    except (TowRequest.DoesNotExist, ValueError, DjangoValidationError, TypeError):
        raise not_found("Tow request not found")


def get_offer_or_404(offer_id):
    try:
        offer = TowOffer.objects.select_related("request", "tow_driver").get(pk=offer_id)
    except (TowOffer.DoesNotExist, ValueError, DjangoValidationError, TypeError):
        raise not_found("Offer not found")
    expire_stale_offers()
    return TowOffer.objects.select_related("request", "tow_driver").get(pk=offer_id)


# ---- output shapes (camelCase, frontend-friendly) ------------------------
def eta_minutes_for(tow):
    if tow.status in (TowRequest.Status.ARRIVED, TowRequest.Status.COMPLETED):
        return 0
    last = tow.points.order_by("-at", "-pk").first()
    if last and tow.status in (TowRequest.Status.ASSIGNED, TowRequest.Status.EN_ROUTE):
        km = haversine_km(last.lat, last.lng, tow.pickup_lat, tow.pickup_lng)
        return max(1, round((km / 35) * 60))
    return tow.eta_minutes


def driver_name(driver_id):
    driver = TowDriver.objects.filter(user_id=driver_id).first()
    return driver.full_name if driver else ""


def request_out(tow, detail=False):
    data = {
        "id": str(tow.id),
        "trackingCode": tow.tracking_code,
        "pickupLat": tow.pickup_lat,
        "pickupLng": tow.pickup_lng,
        "urgency": tow.urgency,
        "status": tow.status,
        "createdAt": iso(tow.created_at),
    }
    optional = {
        "driverId": str(tow.driver_id) if tow.driver_id else None,
        "guestPhone": tow.guest_phone or None,
        "pickupAddress": tow.pickup_address or None,
        "destinationAddress": tow.destination_address or None,
        "vehicle": tow.vehicle or None,
        "issue": tow.issue or None,
        "estimatedPrice": tow.estimated_price,
        "assignedTowDriverId": str(tow.assigned_tow_driver_id) if tow.assigned_tow_driver_id else None,
        "etaMinutes": eta_minutes_for(tow),
    }
    for key, value in optional.items():
        if value is not None:
            data[key] = value
    if detail:
        data["assignedTowDriverName"] = driver_name(tow.assigned_tow_driver_id)
        data["offersSent"] = tow.offers_sent
    return data


def driver_out(driver):
    data = {
        "userId": str(driver.user_id),
        "fullName": driver.full_name,
        "phone": driver.phone,
        "plate": driver.plate,
        "truckType": driver.truck_type,
        "available": driver.available,
    }
    if driver.lat is not None and driver.lng is not None:
        data["lat"] = driver.lat
        data["lng"] = driver.lng
    if driver.position_at:
        data["positionAt"] = iso(driver.position_at)
    return data


def offer_out(offer):
    tow = offer.request
    now = timezone.now()
    data = {
        "id": str(offer.id),
        "requestId": str(offer.request_id),
        "secondsLeft": max(0, math.ceil((offer.expires_at - now).total_seconds())),
        "status": offer.status,
    }
    optional = {
        "pickupAddress": tow.pickup_address or None,
        "distanceKm": round(offer.distance_km, 2) if offer.distance_km is not None else None,
        "estimatedPrice": offer.estimated_price,
        "vehicle": tow.vehicle or None,
        "issue": tow.issue or None,
        "urgency": tow.urgency,
    }
    for key, value in optional.items():
        if value is not None:
            data[key] = value
    return data


def position_out(point):
    return {"lat": point.lat, "lng": point.lng, "at": iso(point.at)}


def track_data(tow):
    points = list(tow.points.order_by("at", "pk"))
    last = points[-1] if points else None
    if last is None:
        driver = TowDriver.objects.filter(user_id=tow.assigned_tow_driver_id).first()
        if driver and driver.lat is not None and driver.lng is not None:
            last = {"lat": driver.lat, "lng": driver.lng,
                    "at": iso(driver.position_at or timezone.now())}
        else:
            # The map always needs a point; the mock uses the pickup position too.
            last = {"lat": tow.pickup_lat, "lng": tow.pickup_lng, "at": iso(timezone.now())}
    else:
        last = position_out(last)
    data = {
        "last": last,
        "trail": [position_out(p) for p in points[-settings.TRACK_TRAIL_MAX:]],
    }
    eta = eta_minutes_for(tow)
    if eta is not None:  # optional in the contract; never send null
        data["etaMinutes"] = eta
    return data


def detail_data(tow):
    data = {"request": request_out(tow, detail=True)}
    driver = TowDriver.objects.filter(user_id=tow.assigned_tow_driver_id).first()
    if driver:
        data["towDriver"] = driver_out(driver)
        if driver.lat is not None and driver.lng is not None:
            data["lastPosition"] = {
                "lat": driver.lat, "lng": driver.lng,
                "at": iso(driver.position_at or timezone.now()),
            }
    else:
        point = track_data(tow)["last"]
        if point:
            data["lastPosition"] = point
    return data


def fleet_data():
    return {
        "items": [
            {**driver_out(d), "busy": busy(d.user_id)}
            for d in TowDriver.objects.all().order_by("created_at", "user_id")
        ]
    }


# ---- dispatch ------------------------------------------------------------
def busy(driver_id):
    if TowRequest.objects.filter(assigned_tow_driver_id=driver_id,
                                 status__in=ACTIVE_STATUSES).exists():
        return True
    return TowOffer.objects.filter(tow_driver_id=driver_id, status=TowOffer.Status.OFFERED,
                                   expires_at__gt=timezone.now()).exists()


def dispatch_next(tow):
    """Send one offer to the nearest free driver; NO_DRIVER after maxOffers."""
    now = timezone.now()
    cfg = config()
    tried = set(TowOffer.objects.filter(request=tow).values_list("tow_driver_id", flat=True))
    if tow.offers_sent >= cfg["max_offers"]:
        _mark_no_driver(tow)
        return None

    candidates = []
    for driver in TowDriver.objects.filter(available=True):
        if driver.user_id in tried or driver.lat is None or driver.lng is None:
            continue
        if busy(driver.user_id):
            continue
        km = haversine_km(driver.lat, driver.lng, tow.pickup_lat, tow.pickup_lng)
        candidates.append((km, driver))
    candidates.sort(key=lambda row: row[0])
    if not candidates:
        if tried:
            _mark_no_driver(tow)
        return None

    km, driver = candidates[0]
    offer = TowOffer.objects.create(
        request=tow, tow_driver=driver,
        expires_at=now + timedelta(seconds=cfg["offer_timeout_seconds"]),
        distance_km=round(km, 2), estimated_price=tow.estimated_price,
    )
    tow.offers_sent += 1
    tow.save(update_fields=["offers_sent"])
    audit(tow.driver_id, "TOW_OFFERED", "tow_offer", offer.id,
          {"towDriverId": str(driver.user_id), "distanceKm": round(km, 2)})
    return offer


def _mark_no_driver(tow):
    if tow.status != TowRequest.Status.SEARCHING:
        return
    tow.status = TowRequest.Status.NO_DRIVER
    tow.save(update_fields=["status"])
    audit(tow.driver_id, "TOW_NO_DRIVER", "tow_request", tow.id)


def expire_stale_offers():
    """Lazy expiry: correctness never depends on the background worker."""
    now = timezone.now()
    stale = list(TowOffer.objects.filter(status=TowOffer.Status.OFFERED,
                                          expires_at__lte=now).select_related("request"))
    if not stale:
        return
    with transaction.atomic():
        TowOffer.objects.filter(pk__in=[o.pk for o in stale],
                                status=TowOffer.Status.OFFERED).update(
                                    status=TowOffer.Status.EXPIRED, responded_at=now)
        for request_id in {o.request_id for o in stale}:
            tow = TowRequest.objects.filter(pk=request_id,
                                            status=TowRequest.Status.SEARCHING).first()
            if tow:
                dispatch_next(tow)


# ---- actions -------------------------------------------------------------
def create_tow(data, user):
    driver_id = user.id if user else None
    guest_phone = "" if user else (data.get("guestPhone") or "")
    if driver_id and TowRequest.objects.filter(driver_id=driver_id,
                                               status__in=OPEN_STATUSES).exists():
        raise conflict("STATE_CONFLICT", "You already have an active tow request")

    drivers = [
        haversine_km(d.lat, d.lng, data["pickupLat"], data["pickupLng"])
        for d in TowDriver.objects.filter(available=True, lat__isnull=False, lng__isnull=False)
    ]
    nearest = min(drivers, default=15.0)
    cfg = config()
    estimate = round((cfg["base_fee"] + cfg["per_km"] * (min(nearest, 15.0) + 8)) / 100) * 100

    tow = TowRequest.objects.create(
        driver_id=driver_id, guest_phone=guest_phone,
        tracking_code=new_tracking_code(),
        pickup_lat=data["pickupLat"], pickup_lng=data["pickupLng"],
        pickup_address=data.get("pickupAddress", ""),
        destination_address=data.get("destinationAddress", ""),
        vehicle=data.get("vehicle", ""), issue=data.get("issue", ""),
        urgency=data.get("urgency", "NORMAL"), status=TowRequest.Status.SEARCHING,
        estimated_price=estimate,
    )
    audit(driver_id, "TOW_CREATED", "tow_request", tow.id, {"trackingCode": tow.tracking_code})
    expire_stale_offers()
    dispatch_next(tow)
    return tow


def accept_offer(offer, user):
    now = timezone.now()
    accepted = False
    with transaction.atomic():
        accepted = bool(TowOffer.objects.filter(
            pk=offer.pk, status=TowOffer.Status.OFFERED, expires_at__gt=now
        ).update(status=TowOffer.Status.ACCEPTED, responded_at=now))
        if accepted:
            tow = TowRequest.objects.get(pk=offer.request_id)
            if tow.status != TowRequest.Status.SEARCHING:
                accepted = False  # another dispatcher/driver won first
            else:
                driver = offer.tow_driver
                km = haversine_km(driver.lat or tow.pickup_lat, driver.lng or tow.pickup_lng,
                                  tow.pickup_lat, tow.pickup_lng)
                tow.status = TowRequest.Status.ASSIGNED
                tow.assigned_tow_driver_id = driver.user_id
                tow.assigned_at = now
                tow.eta_minutes = max(3, round((km / 35) * 60))
                tow.save(update_fields=["status", "assigned_tow_driver_id", "assigned_at",
                                        "eta_minutes"])
                TowOffer.objects.filter(request=tow, status=TowOffer.Status.OFFERED).exclude(
                    pk=offer.pk).update(status=TowOffer.Status.EXPIRED, responded_at=now)
                audit(user.id, "TOW_ACCEPTED", "tow_request", tow.id,
                      {"towDriverId": str(driver.user_id)})
    if not accepted:
        TowOffer.objects.filter(pk=offer.pk, status=TowOffer.Status.OFFERED).update(
            status=TowOffer.Status.EXPIRED, responded_at=now)
        raise conflict("OFFER_EXPIRED", "This offer has expired or was already taken")
    return TowRequest.objects.get(pk=offer.request_id)


def decline_offer(offer, user):
    now = timezone.now()
    declined = False
    with transaction.atomic():
        declined = bool(TowOffer.objects.filter(
            pk=offer.pk, status=TowOffer.Status.OFFERED, expires_at__gt=now
        ).update(status=TowOffer.Status.DECLINED, responded_at=now))
        if declined:
            tow = TowRequest.objects.get(pk=offer.request_id)
            audit(user.id, "TOW_DECLINED", "tow_offer", offer.id)
            if tow.status == TowRequest.Status.SEARCHING:
                dispatch_next(tow)
    if not declined:
        TowOffer.objects.filter(pk=offer.pk, status=TowOffer.Status.OFFERED).update(
            status=TowOffer.Status.EXPIRED, responded_at=now)
        raise conflict("OFFER_EXPIRED", "This offer has expired")


def current_offer(user):
    expire_stale_offers()
    offer = TowOffer.objects.select_related("request", "tow_driver").filter(
        tow_driver_id=user.id, status=TowOffer.Status.OFFERED,
        expires_at__gt=timezone.now()).order_by("sent_at").first()
    if not offer:
        raise not_found("No open offer")
    return offer


def set_availability(user, available):
    driver, _ = TowDriver.objects.get_or_create(
        user_id=user.id, defaults={"plate": "—", "truck_type": "Flatbed", "available": False}
    )
    if not available and TowRequest.objects.filter(
            assigned_tow_driver_id=user.id, status__in=ACTIVE_STATUSES).exists():
        raise conflict("STATE_CONFLICT", "Finish the current job before going offline")
    driver.available = bool(available)
    driver.last_poll_at = timezone.now()
    driver.save(update_fields=["available", "last_poll_at"])
    audit(user.id, "TOW_AVAILABILITY", "tow_driver", user.id, {"available": bool(available)})
    return {"available": driver.available}


def update_position(user, lat, lng):
    now = timezone.now()
    driver, _ = TowDriver.objects.get_or_create(
        user_id=user.id, defaults={"plate": "—", "truck_type": "Flatbed", "available": False}
    )
    driver.lat, driver.lng, driver.position_at, driver.last_poll_at = lat, lng, now, now
    driver.save(update_fields=["lat", "lng", "position_at", "last_poll_at"])
    job = TowRequest.objects.filter(assigned_tow_driver_id=user.id,
                                    status__in=[TowRequest.Status.ASSIGNED,
                                                TowRequest.Status.EN_ROUTE]).first()
    if job:
        TrackingPoint.objects.create(request=job, lat=lat, lng=lng, at=now)
        old = list(TrackingPoint.objects.filter(request=job).order_by("-at", "-pk")
                   .values_list("pk", flat=True)[settings.TRACK_TRAIL_MAX:])
        if old:
            TrackingPoint.objects.filter(pk__in=old).delete()


def set_status(tow, new_status, user):
    if tow.assigned_tow_driver_id != user.id:
        raise forbidden("Not your job")
    allowed = {
        TowRequest.Status.ASSIGNED: TowRequest.Status.EN_ROUTE,
        TowRequest.Status.EN_ROUTE: TowRequest.Status.ARRIVED,
        TowRequest.Status.ARRIVED: TowRequest.Status.COMPLETED,
    }
    if allowed.get(tow.status) != new_status:
        raise conflict("STATE_CONFLICT", f"Cannot go from {tow.status} to {new_status}")
    now = timezone.now()
    tow.status = new_status
    if new_status == TowRequest.Status.ARRIVED:
        tow.arrived_at = now
        tow.eta_minutes = 0
    tow.save(update_fields=["status", "arrived_at", "eta_minutes"])
    audit(user.id, "TOW_STATUS", "tow_request", tow.id, {"status": new_status})
    return tow


def cancel_tow(tow, user):
    if tow.status not in [TowRequest.Status.SEARCHING, TowRequest.Status.ASSIGNED,
                          TowRequest.Status.EN_ROUTE, TowRequest.Status.NO_DRIVER]:
        raise conflict("STATE_CONFLICT", "Too late to cancel")
    now = timezone.now()
    tow.status = TowRequest.Status.CANCELLED
    tow.save(update_fields=["status"])
    TowOffer.objects.filter(request=tow, status=TowOffer.Status.OFFERED).update(
        status=TowOffer.Status.EXPIRED, responded_at=now)
    actor = user.id if user else None
    audit(actor, "TOW_CANCELLED", "tow_request", tow.id)
    return tow


def assign_manual(tow, driver_id, user):
    if tow.status not in [TowRequest.Status.SEARCHING, TowRequest.Status.NO_DRIVER]:
        raise conflict("STATE_CONFLICT", "This request already has a driver")
    driver = TowDriver.objects.filter(user_id=driver_id).first()
    if not driver:
        raise not_found("Tow driver not found")
    if busy(driver_id):
        raise conflict("STATE_CONFLICT", "This driver is busy", "towDriverId")
    now = timezone.now()
    with transaction.atomic():
        TowOffer.objects.filter(request=tow, status=TowOffer.Status.OFFERED).update(
            status=TowOffer.Status.EXPIRED, responded_at=now)
        km = haversine_km(driver.lat or tow.pickup_lat, driver.lng or tow.pickup_lng,
                          tow.pickup_lat, tow.pickup_lng)
        tow.status = TowRequest.Status.ASSIGNED
        tow.assigned_tow_driver_id = driver.user_id
        tow.assigned_at = now
        tow.eta_minutes = max(3, round((km / 35) * 60))
        tow.save(update_fields=["status", "assigned_tow_driver_id", "assigned_at", "eta_minutes"])
        audit(user.id, "TOW_ASSIGNED", "tow_request", tow.id,
              {"towDriverId": str(driver.user_id)})
    return tow


def payment_result(tow_id, status):
    tow = get_tow_or_404(tow_id)
    tow.payment_status = status
    tow.save(update_fields=["payment_status"])
    audit(None, "TOW_PAYMENT_" + status, "tow_request", tow.id)
