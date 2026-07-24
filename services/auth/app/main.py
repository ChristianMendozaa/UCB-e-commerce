from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import ALLOWED_ORIGINS, CORS_ALLOW_CREDENTIALS
from app.routers import auth as auth_router
from app.routers import users as users_router
from app.routers import careers as careers_router

app = FastAPI(title="Auth + FastAPI + Firebase", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(careers_router.router)

@app.get("/health")
def health():
    return {"ok": True}
