import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, phone, password=None, **extra):
        user = self.model(phone=phone, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractBaseUser):
    class Role(models.TextChoices):
        DRIVER = "DRIVER"
        SUPPLIER = "SUPPLIER"
        MECHANIC = "MECHANIC"
        TOW_DRIVER = "TOW_DRIVER"
        DISPATCHER = "DISPATCHER"
        ADMIN = "ADMIN"

    class Status(models.TextChoices):
        PENDING_OTP = "PENDING_OTP"
        PENDING_APPROVAL = "PENDING_APPROVAL"
        ACTIVE = "ACTIVE"
        SUSPENDED = "SUSPENDED"

    class Language(models.TextChoices):
        AR = "ar"
        FR = "fr"
        EN = "en"

    SELF_REGISTER_ROLES = ("DRIVER", "SUPPLIER", "MECHANIC", "TOW_DRIVER")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15, unique=True)
    role = models.CharField(max_length=20, choices=Role.choices)
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.FR)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_OTP)
    approved = models.BooleanField(default=False)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()
    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        db_table = "users"
        indexes = [models.Index(fields=["role"]), models.Index(fields=["status"])]

    @property
    def is_active(self):
        return self.status != self.Status.SUSPENDED

    def __str__(self):
        return f"{self.phone} ({self.role})"


class OtpCode(models.Model):
    class Purpose(models.TextChoices):
        SIGNUP = "SIGNUP"
        RESET = "RESET"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otps")
    purpose = models.CharField(max_length=10, choices=Purpose.choices)
    code_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "otp_codes"
        indexes = [models.Index(fields=["user", "purpose", "-created_at"])]


class Application(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING"
        APPROVED = "APPROVED"
        REJECTED = "REJECTED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="applications")
    role = models.CharField(max_length=20)
    business_name = models.CharField(max_length=150, blank=True, default="")
    wilaya = models.CharField(max_length=60, blank=True, default="")
    document_number = models.CharField(max_length=60, blank=True, default="")
    vehicle_plate = models.CharField(max_length=30, blank=True, default="")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    reason = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "applications"
        indexes = [models.Index(fields=["status", "-created_at"])]


class AuditLog(models.Model):
    id = models.BigAutoField(primary_key=True)
    actor = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    action = models.CharField(max_length=40)
    target_type = models.CharField(max_length=30)
    target_id = models.CharField(max_length=40)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_log"
        indexes = [models.Index(fields=["-created_at"])]
