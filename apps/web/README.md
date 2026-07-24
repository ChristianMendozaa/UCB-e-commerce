# Web application

The UCB Commerce web application is a Next.js 14 storefront and same-origin
backend-for-frontend (BFF). Browser code calls only `/api/*`; server-side Route
Handlers forward those requests to the private Auth, Orders, Products,
Chatbot, and Images services.

This directory is part of the UCB Commerce monorepo. The supported way to run
the complete system is documented in the [root README](../../README.md).

## Environment

Copy `.env.example` to `.env.local`. The Firebase values prefixed with
`NEXT_PUBLIC_` are intentionally included in the browser bundle. Service URLs
are server-only:

- `AUTH_API_URL`
- `ORDERS_API_URL`
- `PRODUCTS_API_URL`
- `CHATBOT_API_URL`
- `IMAGE_SERVICE_BASE_URL`

Docker Compose and Vercel service bindings override those URLs for their
respective networks.

## Direct development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The standalone production build used by Docker is:

```bash
pnpm build
node .next/standalone/server.js
```

The application enforces a 4 MiB limit on original product images before
forwarding multipart uploads. Images are served through `/api/images/{id}` so
the browser never needs a direct backend URL.
