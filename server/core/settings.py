# don't push this file
from .base_settings import *
DEBUG = True
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "mydatabase",
        "USER": "root",
        "PASSWORD": "mypassword",
        "HOST": "127.0.0.1",
        "PORT": "5432",
    }
}
CORS_ALLOWED_ORIGINS = []
CSRF_TRUSTED_ORIGINS = []



