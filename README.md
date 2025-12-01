# UCB Commerce Frontend

Interfaz de usuario moderna y responsiva para la plataforma de comercio electrónico de la UCB. Construida con Next.js, Tailwind CSS y Shadcn UI.

## Descripción

Este proyecto es el frontend de la aplicación UCB Commerce. Proporciona una experiencia de usuario fluida para estudiantes y administradores. Incluye funcionalidades para navegar el catálogo, realizar pedidos, gestionar el carrito de compras y un panel de administración completo para gestionar productos, usuarios y órdenes.

## Tecnologías

- **Framework:** Next.js 14 (App Router)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS
- **Componentes UI:** Shadcn UI (basado en Radix UI)
- **Iconos:** Lucide React
- **Gestión de Estado:** React Context (Carrito) y Hooks personalizados.

## Funcionalidades

### Para Estudiantes (Público/Autenticado)
- **Catálogo de Productos:** Visualización de productos con filtros por categoría y carrera.
- **Carrito de Compras:** Gestión de items, cálculo de totales y checkout.
- **Perfil de Usuario:** Visualización de historial de pedidos y estado.
- **Autenticación:** Inicio de sesión con Google.

### Para Administradores (Panel Admin)
- **Dashboard:** Resumen estadístico de ventas, usuarios y productos.
- **Gestión de Productos:** CRUD completo de productos con soporte para imágenes.
- **Gestión de Usuarios:**
  - Listado de usuarios con filtros.
  - Asignación y remoción de roles (Admin de Carrera, Platform Admin).
  - Prevención de auto-democión.
- **Gestión de Pedidos:** Visualización y actualización de estados de pedidos.
- **Control de Acceso Granular:**
  - **Platform Admin:** Acceso total.
  - **Career Admin:** Acceso limitado a productos y usuarios de sus carreras asignadas.

## Configuración y Ejecución

1.  **Instalar dependencias:**
    ```bash
    npm install
    # o
    pnpm install
    ```

2.  **Configurar variables de entorno:**
    Crear un archivo `.env.local` con las siguientes variables (ejemplo):
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=...
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
    # URLs de los microservicios (para rewrites en next.config.mjs)
    AUTH_SERVICE_URL=http://localhost:8001
    ORDERS_SERVICE_URL=http://localhost:8002
    PRODUCTS_SERVICE_URL=http://localhost:8003
    ```

3.  **Ejecutar en desarrollo:**
    ```bash
    npm run dev
    ```
    La aplicación estará disponible en `https://ucb-e-commerce.vercel.app`.

## Estructura de Carpetas

```
app/
├── admin/      # Rutas y componentes del panel de administración
├── (shop)/     # Rutas públicas de la tienda (catálogo, carrito)
├── api/        # Rutas API internas (si las hay)
components/     # Componentes reutilizables (UI, Header, Guards)
lib/            # Utilidades, clientes API y definiciones de tipos
contexts/       # Contextos globales (CartContext)
```
