from django.db.models import Q
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.auth import issue_token
from common.errors import not_found, validation_error
from common.pagination import paginate
from common.throttles import AuthRateThrottle
from common.permissions import HasServiceKey, IsAdminRole

from . import services
from .models import Application, User
from .serializers import (LoginSerializer, PhoneOnlySerializer, ProfileUpdateSerializer, RegisterSerializer,
                          RejectSerializer, ResetPasswordSerializer, StatusChangeSerializer,
                          VerifyOtpSerializer, application_out, user_out)


class AuthView(APIView):
    """Public endpoints: no token, rate limited per IP."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthRateThrottle]
    serializer_class = None

    def data(self, request):
        s = self.serializer_class(data=request.data)
        s.is_valid(raise_exception=True)
        return s.validated_data


class RegisterView(AuthView):
    serializer_class = RegisterSerializer

    def post(self, request):
        user = services.register(self.data(request))
        return Response({"userId": str(user.id), "otpSentTo": user.phone}, status=201)


class VerifyOtpView(AuthView):
    serializer_class = VerifyOtpSerializer

    def post(self, request):
        d = self.data(request)
        return Response(services.verify_signup(d["phone"], d["code"]))


class ResendOtpView(AuthView):
    serializer_class = PhoneOnlySerializer

    def post(self, request):
        services.resend_signup_otp(self.data(request)["phone"])
        return Response(status=204)


class LoginView(AuthView):
    serializer_class = LoginSerializer

    def post(self, request):
        d = self.data(request)
        return Response(services.login(d["phone"], d["password"]))


class ForgotPasswordView(AuthView):
    serializer_class = PhoneOnlySerializer

    def post(self, request):
        services.forgot_password(self.data(request)["phone"])
        return Response(status=204)


class ResetPasswordView(AuthView):
    serializer_class = ResetPasswordSerializer

    def post(self, request):
        d = self.data(request)
        services.reset_password(d["phone"], d["code"], d["newPassword"])
        return Response(status=204)


class RefreshView(APIView):
    """v1.1: a fresh JWT with the current role, status and approved flag (e.g. right after an admin approval).
    Needs a valid, non-expired token; suspended accounts are refused by the authentication class (403)."""

    def post(self, request):
        user = request.user
        user.refresh_from_db()
        services.audit(user, "TOKEN_REFRESHED", "user", user.id, approved=user.approved)
        return Response({"token": issue_token(user), "user": user_out(user)})


class MeView(APIView):
    def get(self, request):
        return Response(user_out(request.user))

    def patch(self, request):
        s = ProfileUpdateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(user_out(services.update_profile(request.user, s.validated_data)))


class PublicUserView(APIView):
    """Service-to-service: S2..S6 ask for a user's name and phone."""
    permission_classes = [HasServiceKey]
    authentication_classes = []

    def get(self, request, user_id):
        try:
            user = User.objects.get(pk=services.parse_uuid(user_id, "User"))
        except User.DoesNotExist:
            raise not_found("User not found")
        return Response({"id": str(user.id), "fullName": user.full_name, "phone": user.phone})


class AdminApplicationsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        status = request.query_params.get("status", "PENDING").upper()
        if status not in Application.Status.values:
            raise validation_error("status must be PENDING, APPROVED or REJECTED", "status")
        qs = (Application.objects.select_related("user").filter(status=status)
              .exclude(user__status=User.Status.PENDING_OTP).order_by("created_at"))
        return Response(paginate(request, qs, application_out))


class ApproveView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, app_id):
        return Response(application_out(services.approve_application(request.user, app_id)))


class RejectView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, app_id):
        s = RejectSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(application_out(services.reject_application(request.user, app_id, s.validated_data["reason"])))


class AdminUsersView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = User.objects.all().order_by("-created_at", "phone")
        role = request.query_params.get("role")
        status = request.query_params.get("status")
        q = (request.query_params.get("q") or "").strip()
        if role:
            if role.upper() not in User.Role.values:
                raise validation_error("Unknown role", "role")
            qs = qs.filter(role=role.upper())
        if status:
            if status.upper() not in User.Status.values:
                raise validation_error("Unknown status", "status")
            qs = qs.filter(status=status.upper())
        if q:
            qs = qs.filter(Q(full_name__icontains=q) | Q(phone__icontains=q))
        return Response(paginate(request, qs, user_out))


class AdminUserStatusView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, user_id):
        s = StatusChangeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        return Response(user_out(services.set_user_status(request.user, user_id, d["status"], d["reason"])))
