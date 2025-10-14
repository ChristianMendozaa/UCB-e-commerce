# utils.py
import base64
from io import BytesIO
from PIL import Image

def encode_b64(data: bytes) -> str:
    return base64.b64encode(data).decode("utf-8")

def calc_b64_size(data: bytes) -> int:
    """Tamaño en bytes de la cadena Base64 sin construirla entera."""
    return len(base64.b64encode(data))

def convert_to_webp(data: bytes, quality: int = 80) -> bytes:
    """Convierte cualquier imagen a WebP en memoria."""
    img = Image.open(BytesIO(data))
    buf = BytesIO()
    img.save(buf, format="WEBP", quality=quality)
    return buf.getvalue()
