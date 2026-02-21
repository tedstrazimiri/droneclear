"""
Development settings — debug on, all hosts allowed, CORS open.
"""

from .base import *  # noqa: F401, F403

DEBUG = True

ALLOWED_HOSTS = ['*']

# Wide-open CORS for local dev
CORS_ALLOW_ALL_ORIGINS = True

# Handy: show emails in the console instead of actually sending them
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
