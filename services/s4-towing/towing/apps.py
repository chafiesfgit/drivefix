"""Optional in-process expiry worker (replaces Celery/Redis in the demo).

Correctness does not depend on this thread: every read also expires stale
offers lazily (services.expire_stale_offers). It only makes the transition
happen even when nobody polls the service.
"""
import logging
import os
import sys
import threading
import time

from django.apps import AppConfig
from django.conf import settings
from django.db import connection

log = logging.getLogger("towing")


def _sweeper_loop():
    from . import services

    while True:
        try:
            services.expire_stale_offers()
        except Exception:  # never kill the worker because of one bad row
            log.exception("offer expiry sweep failed")
        finally:
            connection.close()  # each iteration uses a fresh DB connection
        time.sleep(1)


class TowingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "towing"

    def ready(self):
        runserver = any(cmd in sys.argv for cmd in ("runserver", "daphne", "gunicorn"))
        # `runserver` calls ready() in both the watcher and the serving child.
        # RUN_MAIN is set in the child; with --noreload there is only one process.
        serving_process = "--noreload" in sys.argv or os.environ.get("RUN_MAIN") == "true"
        if (settings.SWEEPER_ENABLED and runserver and serving_process
                and not any(t.name == "s4-offer-expiry" for t in threading.enumerate())):
            threading.Thread(target=_sweeper_loop, name="s4-offer-expiry",
                             daemon=True).start()
            log.info("offer expiry worker started (1 s tick)")
