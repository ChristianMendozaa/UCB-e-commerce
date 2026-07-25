from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import ALLOWED_ORIGINS, CORS_ALLOW_CREDENTIALS
from app.routers import chat, internal_rag

# ========= APP FASTAPI =============

app = FastAPI(
    title="RAG UCB Commerce",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(internal_rag.router)

# ========= ROOT ===============

@app.get("/")
def root():
    return {"status": "ok", "msg": "RAG UCB Commerce listo"}


@app.get("/health")
def health():
    return {"ok": True}
