from fastapi import FastAPI

from app.routers import rag

# ========= APP FASTAPI =============

app = FastAPI(
    title="RAG UCB Commerce",
    version="1.0.0",
)

app.include_router(rag.router)

# ========= ROOT ===============

@app.get("/")
def root():
    return {"status": "ok", "msg": "RAG UCB Commerce listo"}


@app.get("/health")
def health():
    return {"ok": True}
