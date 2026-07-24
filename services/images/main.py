# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ALLOWED_ORIGINS, CORS_ALLOW_CREDENTIALS
from routers.images import router as images_router

app = FastAPI(title="Image Uploader")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(images_router, prefix="/images", tags=["images"])


@app.get("/health")
def health():
    return {"ok": True}
