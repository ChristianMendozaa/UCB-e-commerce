from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import ALLOWED_ORIGINS
from app.routers import auth as auth_router
from app.routers import users as users_router
from app.routers import careers as careers_router

app = FastAPI(title="Auth + FastAPI + Firebase", version="1.0.0")

# CORS (ajusta según tu frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000', 'https://ucb-e-commerce.vercel.app'],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(careers_router.router)

@app.get("/health")
def health():
    return {"ok": True}
