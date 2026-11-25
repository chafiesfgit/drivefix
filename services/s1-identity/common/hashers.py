from django.conf import settings
from django.contrib.auth.hashers import BCryptSHA256PasswordHasher


class ConfigurableBCryptHasher(BCryptSHA256PasswordHasher):
    """bcrypt, work factor from BCRYPT_ROUNDS (12 in production, 4 in tests)."""

    rounds = settings.BCRYPT_ROUNDS
