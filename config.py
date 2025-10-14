# config.py
import os
from dotenv import load_dotenv

load_dotenv()

# Nombre de la colección donde guardamos las imágenes
FIREBASE_COLLECTION = os.getenv("FIREBASE_COLLECTION", "images")

# Límite para Base64 (1 MiB por documento)
MAX_B64_BYTES = int(os.getenv("MAX_B64_BYTES", 1 * 1024 * 1024))
