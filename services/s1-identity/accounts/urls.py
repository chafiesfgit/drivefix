from django.urls import path

from . import views as v

urlpatterns = [
    path("auth/register", v.RegisterView.as_view()),
    path("auth/verify-otp", v.VerifyOtpView.as_view()),
    path("auth/resend-otp", v.ResendOtpView.as_view()),
    path("auth/login", v.LoginView.as_view()),
    path("auth/refresh", v.RefreshView.as_view()),
    path("auth/forgot-password", v.ForgotPasswordView.as_view()),
    path("auth/reset-password", v.ResetPasswordView.as_view()),
    path("users/me", v.MeView.as_view()),
    path("users/<str:user_id>/public", v.PublicUserView.as_view()),
    path("admin/applications", v.AdminApplicationsView.as_view()),
    path("admin/applications/<str:app_id>/approve", v.ApproveView.as_view()),
    path("admin/applications/<str:app_id>/reject", v.RejectView.as_view()),
    path("admin/users", v.AdminUsersView.as_view()),
    path("admin/users/<str:user_id>/status", v.AdminUserStatusView.as_view()),
]
