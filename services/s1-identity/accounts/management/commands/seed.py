import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Application, User


class Command(BaseCommand):
    help = "Load demo users and applications from seed/s1-identity.json (safe to run many times)."

    def add_arguments(self, parser):
        parser.add_argument("--file", default=str(Path(settings.BASE_DIR) / "seed" / "s1-identity.json"))
        parser.add_argument("--reset", action="store_true", help="delete all users/applications first")

    @transaction.atomic
    def handle(self, *args, **opts):
        path = Path(opts["file"])
        if not path.exists():
            raise CommandError(f"Seed file not found: {path}")
        data = json.loads(path.read_text(encoding="utf-8"))
        password = data.get("password_for_all", "Password123")
        if opts["reset"]:
            Application.objects.all().delete()
            User.objects.all().delete()
        for u in data["users"]:
            user = User.objects.filter(pk=u["id"]).first() or User.objects.filter(phone=u["phone"]).first()
            if user is None:
                user = User(id=u["id"])
            user.full_name, user.phone, user.role = u["fullName"], u["phone"], u["role"]
            user.language, user.status, user.approved = u["language"], u["status"], u["approved"]
            user.failed_login_attempts, user.locked_until = 0, None
            user.set_password(password)
            user.save()
        for a in data.get("applications", []):
            Application.objects.update_or_create(id=a["id"], defaults={
                "user_id": a["userId"], "role": a["role"], "business_name": a.get("businessName", ""),
                "wilaya": a.get("wilaya", ""), "document_number": a.get("documentNumber", ""),
                "vehicle_plate": a.get("vehiclePlate", ""), "status": a.get("status", "PENDING")})
        self.stdout.write(self.style.SUCCESS(
            f"Seeded {len(data['users'])} users and {len(data.get('applications', []))} application(s). "
            f"Password for all: {password}"))
