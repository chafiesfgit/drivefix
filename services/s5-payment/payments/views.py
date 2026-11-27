from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from django.utils import timezone

from common.auth import get_claims, require_role, require_service_key, user_uuid
from common.errors import ApiError
from common.http import api, as_uuid, page_params, path_uuid, read_json
from common.notify import callback_owner, notify_user
from . import services
from .models import METHODS, REF_TYPES, STATUSES, Payment, PaymentSession


# ---------------------------------------------------------------- basics
@api("GET")
def health(request):
    return JsonResponse({"status": "ok"})


@api("GET", "POST", "PUT", "PATCH", "DELETE")
def not_found(request, *args, **kwargs):
    raise ApiError(404, "NOT_FOUND", "Route not found")


def _get_payment(pk):
    try:
        return Payment.objects.get(pk=path_uuid(pk))
    except Payment.DoesNotExist:
        raise ApiError(404, "NOT_FOUND", "Payment not found")


def _can_view(claims, payment):
    role = claims.get("role")
    if role == "ADMIN":
        return True
    if payment.payer_id == user_uuid(claims):
        return True
    # the supplier / tow driver must be able to find the cash payment they collect
    if role == "SUPPLIER" and payment.ref_type == "ORDER":
        return True
    if role == "TOW_DRIVER" and payment.ref_type == "TOW":
        return True
    return False


def _after_change(payment):
    notify_user(payment)
    callback_owner(payment)


# ---------------------------------------------------------------- POST/GET /payments
def _validate_create(data):
    def required(name):
        if name not in data or data[name] in (None, ""):
            raise ApiError(400, "VALIDATION_ERROR", f"{name} is required", name)
        return data[name]

    ref_type = required("refType")
    if ref_type not in REF_TYPES:
        raise ApiError(400, "VALIDATION_ERROR", "refType must be ORDER or TOW", "refType")
    ref_id = as_uuid(required("refId"), "refId")
    payer_id = as_uuid(required("payerId"), "payerId")
    amount = required("amount")
    if isinstance(amount, bool) or not isinstance(amount, int) or amount <= 0:
        raise ApiError(400, "VALIDATION_ERROR", "amount must be a positive integer (DZD)", "amount")
    method = required("method")
    if method not in METHODS:
        raise ApiError(400, "VALIDATION_ERROR", "method must be CASH or SANDBOX", "method")
    label = data.get("label", "")
    if label is None:
        label = ""
    if not isinstance(label, str) or len(label) > 120:
        raise ApiError(400, "VALIDATION_ERROR", "label must be a string of at most 120 characters", "label")
    if not label:
        label = f"{'Order' if ref_type == 'ORDER' else 'Tow'} {str(ref_id)[:8]}"
    return {
        "ref_type": ref_type,
        "ref_id": ref_id,
        "payer_id": payer_id,
        "amount": amount,
        "method": method,
        "label": label,
    }


def _create(request):
    require_service_key(request)
    values = _validate_create(read_json(request))
    payment = Payment.objects.filter(ref_type=values["ref_type"], ref_id=values["ref_id"]).first()
    if payment is None:
        try:
            with transaction.atomic():
                payment = Payment.objects.create(**values)
                services.audit("service", "PAYMENT_CREATED", payment)
        except IntegrityError:  # two calls at the same time: the other one won
            payment = Payment.objects.get(ref_type=values["ref_type"], ref_id=values["ref_id"])
    url = None
    if payment.method == "SANDBOX" and payment.status == "PENDING":
        url = services.ensure_session_url(payment)
    body = {"payment": services.serialize(payment, url)}
    if url:
        body["payUrl"] = url
    return JsonResponse(body, status=201)


def _list(request):
    claims = get_claims(request)
    role = claims.get("role")
    queryset = Payment.objects.all()
    if role != "ADMIN":
        scope = Q(payer_id=user_uuid(claims))
        if role == "SUPPLIER":
            scope |= Q(ref_type="ORDER")
        elif role == "TOW_DRIVER":
            scope |= Q(ref_type="TOW")
        queryset = queryset.filter(scope)
    ref_id = request.GET.get("refId")
    if ref_id:
        queryset = queryset.filter(ref_id=as_uuid(ref_id, "refId"))
    status = request.GET.get("status")
    if status:
        if status not in STATUSES:
            raise ApiError(400, "VALIDATION_ERROR", "Unknown status", "status")
        queryset = queryset.filter(status=status)
    page, page_size = page_params(request)
    total = queryset.count()
    start = (page - 1) * page_size
    items = [services.serialize(p, services.existing_pay_url(p)) for p in queryset[start:start + page_size]]
    return JsonResponse({"items": items, "page": page, "pageSize": page_size, "total": total})


@api("GET", "POST")
def payments_collection(request):
    if request.method == "POST":
        return _create(request)
    return _list(request)


# ---------------------------------------------------------------- /payments/{id}
@api("GET")
def payment_detail(request, pk):
    claims = get_claims(request)
    payment = _get_payment(pk)
    if not _can_view(claims, payment):
        raise ApiError(403, "FORBIDDEN", "This payment is not yours")
    return JsonResponse(services.serialize(payment, services.existing_pay_url(payment)))


@api("POST")
def cash_collected(request, pk):
    claims = get_claims(request)
    require_role(claims, ("SUPPLIER", "TOW_DRIVER"), need_approved=True)
    payment = _get_payment(pk)
    # a supplier collects order cash, a tow driver collects tow cash
    expected = "ORDER" if claims["role"] == "SUPPLIER" else "TOW"
    if payment.ref_type != expected:
        raise ApiError(403, "FORBIDDEN", "This payment is not for your role")

    def only_cash(p):
        if p.method != "CASH":
            raise ApiError(409, "STATE_CONFLICT", "Only a CASH payment can be marked as collected")

    payment = services.change_status(
        payment.id, "PAID", actor=claims["sub"], action="CASH_COLLECTED", check=only_cash
    )
    _after_change(payment)
    return JsonResponse(services.serialize(payment))


@api("POST")
def refund(request, pk):
    claims = get_claims(request)
    require_role(claims, ("ADMIN",))
    payment = _get_payment(pk)
    data = read_json(request)
    reason = data.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise ApiError(400, "VALIDATION_ERROR", "reason is required", "reason")
    if len(reason) > 500:
        raise ApiError(400, "VALIDATION_ERROR", "reason is too long (500 max)", "reason")
    payment = services.change_status(
        payment.id, "REFUNDED", actor=claims["sub"], action="PAYMENT_REFUNDED", reason=reason.strip()
    )
    return JsonResponse(services.serialize(payment))


# ---------------------------------------------------------------- sandbox page (public)
def _get_session(token):
    session = PaymentSession.objects.select_related("payment").filter(token=token).first()
    if session is None:
        raise ApiError(404, "NOT_FOUND", "Payment session not found")
    return session


def _check_not_expired(session):
    if session.expires_at <= timezone.now():
        raise ApiError(410, "SESSION_EXPIRED", "This payment session has expired")


@api("GET")
def pay_session(request, token):
    session = _get_session(token)
    _check_not_expired(session)
    payment = session.payment
    return JsonResponse(
        {
            "amount": payment.amount,
            "label": payment.label or "DriveFix",
            "expiresAt": services.iso(session.expires_at),
            "demo": True,  # the page must show "Demo - no real money"
        }
    )


def _sandbox_result(token, new_status, action):
    session = _get_session(token)

    def not_expired(_payment):
        _check_not_expired(session)

    payment = services.change_status(
        session.payment_id, new_status, actor="anonymous", action=action, check=not_expired
    )
    _after_change(payment)
    return JsonResponse(services.serialize(payment))


@api("POST")
def pay_succeed(request, token):
    return _sandbox_result(token, "PAID", "SANDBOX_SUCCEEDED")


@api("POST")
def pay_fail(request, token):
    return _sandbox_result(token, "FAILED", "SANDBOX_FAILED")
