from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import ALLOWED_ORIGINS, CORS_ALLOW_CREDENTIALS
from app.routers import chat
from app.services.http_client import close_http_client

# ========= APP FASTAPI =============

@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    await close_http_client()


app = FastAPI(
    title="RAG UCB Commerce",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)

# ========= ROOT ===============

@app.get("/")
def root():
    return {"status": "ok", "msg": "RAG UCB Commerce listo"}


@app.get("/health")
def health():
    return {"ok": True}
