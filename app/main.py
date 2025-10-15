from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.orders import router as orders_router

app = FastAPI(title="Orders", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000', 'https://ucb-e-commerce.vercel.app'],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.get("/health")
def health():
    return {"ok": True}

# Routers
app.include_router(orders_router)
