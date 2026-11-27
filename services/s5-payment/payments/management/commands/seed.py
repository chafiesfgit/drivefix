import json

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from payments.models import AuditLog, Payment, PaymentSession


class Command(BaseCommand):
    help = "Load the shared demo data from contract/seed/s5-payment.json (replaces existing payments)."

    def handle(self, *args, **options):
        path = settings.BASE_DIR.parent.parent / "contract" / "seed" / "s5-payment.json"
        if not path.exists():
            self.stderr.write(f"Seed file not found: {path}")
            return
        with open(path, encoding="utf-8-sig") as handle:
            data = json.load(handle)

        PaymentSession.objects.all().delete()
        Payment.objects.all().delete()
        AuditLog.objects.all().delete()

        count = 0
        for item in data.get("payments", []):
            paid_at = parse_datetime(item["paidAt"]) if item.get("paidAt") else None
            created_at = parse_datetime(item["createdAt"]) if item.get("createdAt") else timezone.now()
            Payment.objects.create(
                id=item["id"],
                ref_type=item["refType"],
                ref_id=item["refId"],
                payer_id=item["payerId"],
                amount=item["amount"],
                method=item["method"],
                status=item["status"],
                label=item.get("label", ""),
                created_at=created_at,
                paid_at=paid_at,
            )
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Seed OK: {count} payment(s) loaded."))
