import os
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
FIREBASE_TYPE = os.getenv("FIREBASE_TYPE", "service_account")
FIREBASE_PRIVATE_KEY_ID = os.getenv("FIREBASE_PRIVATE_KEY_ID")
FIREBASE_PRIVATE_KEY = os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n")
FIREBASE_CLIENT_EMAIL = os.getenv("FIREBASE_CLIENT_EMAIL")
FIREBASE_CLIENT_ID = os.getenv("FIREBASE_CLIENT_ID")
FIREBASE_AUTH_URI = os.getenv("FIREBASE_AUTH_URI")
FIREBASE_TOKEN_URI = os.getenv("FIREBASE_TOKEN_URI")
FIREBASE_AUTH_PROVIDER_X509_CERT_URL = os.getenv("FIREBASE_AUTH_PROVIDER_X509_CERT_URL")
FIREBASE_CLIENT_X509_CERT_URL = os.getenv("FIREBASE_CLIENT_X509_CERT_URL")
FIREBASE_UNIVERSE_DOMAIN = os.getenv("FIREBASE_UNIVERSE_DOMAIN")

FIREBASE_WEB_API_KEY = os.getenv("FIREBASE_WEB_API_KEY", "")
ENABLE_FIRESTORE_PROVISIONING = os.getenv("ENABLE_FIRESTORE_PROVISIONING", "true").lower() == "true"

SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "__session")
SESSION_EXPIRES_HOURS = int(os.getenv("SESSION_EXPIRES_HOURS", "12"))
SESSION_COOKIE_DOMAIN = os.getenv("SESSION_COOKIE_DOMAIN") or None
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"

IMAGE_SERVICE_BASE_URL = os.getenv(
    "IMAGE_SERVICE_BASE_URL",
    "https://images-services-ucb-commerce.vercel.app"
)

SESSION_EXPIRES_DELTA = timedelta(hours=SESSION_EXPIRES_HOURS)
