from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import chat

# ========= APP FASTAPI =============

app = FastAPI(
    title="RAG UCB Commerce",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ucb-e-commerce.vercel.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)

# ========= ROOT ===============

@app.get("/")
def root():
    return {"status": "ok", "msg": "RAG UCB Commerce listo"}
