# Orders Service - UCB Commerce

Microservicio dedicado a la gestión de pedidos (órdenes) de compra dentro de la plataforma UCB Commerce.

## Descripción

Este servicio permite a los estudiantes realizar pedidos de productos y a los administradores gestionar el estado de dichos pedidos. Implementa lógica transaccional para asegurar la integridad del stock al momento de la compra.

## Tecnologías

- **Lenguaje:** Python 3.10+
- **Framework:** FastAPI
- **Base de Datos:** Google Firestore (NoSQL)

## Funcionalidades Principales

- **Creación de Pedidos:**
  - Validación de stock en tiempo real.
  - Creación transaccional de la orden y descuento de stock.
  - Soporte para múltiples productos en una sola orden.
- **Historial de Pedidos:**
  - Listado de pedidos propios para estudiantes.
  - Listado de pedidos filtrados por carrera para administradores.
- **Gestión de Estados:**
  - Actualización de estados (Pendiente, Confirmado, Enviado, Entregado).
  - Control de permisos: Solo admins de la carrera correspondiente o Platform Admins pueden cambiar el estado.

## Estructura del Proyecto

```
app/
├── core/       # Configuración y conexión a Firestore
├── deps/       # Dependencias (validación de usuario y permisos)
├── routers/    # Endpoints de la API (orders)
└── schemas/    # Modelos Pydantic (CreateOrder, OrderOut, etc.)
```

## Instalación y Ejecución

1.  **Instalar dependencias:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Configurar variables de entorno:**
    Asegurar que el archivo `.env` contenga las credenciales necesarias.

3.  **Ejecutar el servidor:**
    ```bash
    uvicorn app.main:app --reload --port 8002
    ```