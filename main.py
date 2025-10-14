# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.images import router as images_router

app = FastAPI(title="Image Uploader")

# Configuración de CORS para permitir todos los orígenes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],            # permite cualquier dominio
    allow_credentials=True,
    allow_methods=["*"],            # permite todos los métodos (GET, POST, PUT, DELETE...)
    allow_headers=["*"],            # permite todas las cabeceras
)

app.include_router(images_router, prefix="/images", tags=["images"])
