# main.py
from contextlib import asynccontextmanager

import anyio.to_thread
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import ALLOWED_ORIGINS, CORS_ALLOW_CREDENTIALS, IMAGE_THREADPOOL_SIZE
from routers.images import router as images_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Read/list/delete handlers run as sync `def`s, dispatched by FastAPI to
    # anyio's default worker threadpool (4 tokens by default) — that's the
    # fix for the images service serializing every request behind blocking
    # Firestore/Pillow calls. Bump it once at startup, inside the running
    # event loop (the limiter is loop-bound).
    anyio.to_thread.current_default_thread_limiter().total_tokens = (
        IMAGE_THREADPOOL_SIZE
    )
    yield


app = FastAPI(title="Image Uploader", lifespan=lifespan)

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
