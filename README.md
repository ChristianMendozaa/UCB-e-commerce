# UCB Commerce

UCB Commerce is a monorepo with a Next.js storefront and five FastAPI
services. The deployment configuration keeps Firebase, Firestore, Supabase,
OpenAI, and media persistence outside the containers: every application
container is replaceable and stores no durable state on its local filesystem.

## Repository layout

```text
apps/web/             Next.js 14 storefront and same-origin BFF
services/auth/        Firebase authentication, users, and careers
services/orders/      Order lifecycle
services/products/    Catalog, inventory, and cart
services/chatbot/     OpenAI-powered shopping assistant and Supabase RAG
services/images/      Image validation and Firestore-backed image API
compose.yaml          Local six-service topology
vercel.json           Vercel Services topology
```

Every service has a `Dockerfile.vercel`. The web image uses Node.js 22,
Corepack, pnpm, and Next.js standalone output. Python images use Python 3.12
from hash-locked `requirements.lock` files. All runtime processes run as
non-root users and listen on the platform-provided `PORT`.

## Architecture

The browser talks only to the Next.js origin. Route Handlers under `/api`
forward requests to private upstream services. Products calls Images for
uploads, while Chatbot calls Products and Orders. Firebase/Firestore,
Supabase, and OpenAI remain external managed dependencies.

```text
Browser
  |
  v
Next.js web / BFF
  |-- Auth
  |-- Orders
  |-- Products ----> Images
  |-- Chatbot -----> Products
  |             `--> Orders
  `-- Images

External: Firebase Auth + Firestore, Supabase, OpenAI
```

Original product images have a hard 4 MiB limit at the browser, BFF, Products,
and Images boundaries. The BFF also caps the complete multipart request at
4,450,000 bytes. The Images service accepts and re-encodes only static JPEG,
PNG, and WebP bytes, with limits of 8,192 pixels per side and 25 megapixels.
Images are stored as Base64 in Firestore with a 983,040-byte cap that leaves a
64 KiB document margin, then exposed through the same-origin
`/api/images/{id}` route with restrictive content security headers.

## Prerequisites

- Docker Engine with Docker Compose v2 and BuildKit
- A Firebase project and service-account credentials
- A Supabase project
- An OpenAI API key

Node.js and Python are not required on the host for the Compose workflow.

## Configure local environment files

Real environment files are intentionally ignored by Git and excluded from
every Docker build context. Create them from the committed templates:

```bash
cp apps/web/.env.example apps/web/.env.local
cp services/auth/.env.example services/auth/.env
cp services/orders/.env.example services/orders/.env
cp services/products/.env.example services/products/.env
cp services/chatbot/.env.example services/chatbot/.env
cp services/images/.env.example services/images/.env
```

Replace every `replace-with-*` and sample project value. Never commit the
resulting files, service-account JSON, private keys, or API tokens.

`NEXT_PUBLIC_FIREBASE_*` values are compiled into the browser bundle. Compose
passes `apps/web/.env.local` to the web build through the optional BuildKit
secret `web_env`; the file is mounted only for `pnpm build` and is never copied
into an image layer. The same file is also the first `env_file` for Auth so it
can use `NEXT_PUBLIC_FIREBASE_API_KEY` as a local fallback; values in
`services/auth/.env` take precedence.

## Run the full stack locally

```bash
docker compose up --build
```

Compose waits for dependency health checks before starting callers. Each
Python service listens on port 8000 inside its container; only the host-side
development ports differ. Host ports bind to `127.0.0.1` so the development
services are not exposed to the local network:

| Service | Host URL | Internal URL | Depends on |
|---|---|---|---|
| Web | `http://localhost:3000` | `http://web:3000` | all backends |
| Auth | `http://localhost:8001` | `http://auth:8000` | — |
| Orders | `http://localhost:8002` | `http://orders:8000` | — |
| Products | `http://localhost:8003` | `http://products:8000` | Images |
| Chatbot | `http://localhost:8004` | `http://chatbot:8000` | Products, Orders |
| Images | `http://localhost:8005` | `http://images:8000` | — |

The Compose `environment` blocks deliberately override upstream URLs from
local env files:

- Web: `AUTH_API_URL`, `ORDERS_API_URL`, `PRODUCTS_API_URL`,
  `CHATBOT_API_URL`, and `IMAGE_SERVICE_BASE_URL`
- Products: `IMAGE_SERVICE_BASE_URL=http://images:8000` and
  `IMAGE_PUBLIC_BASE_PATH=/api/images`
- Chatbot: `PRODUCTS_API_URL=http://products:8000` and
  `ORDERS_API_URL=http://orders:8000`

Useful commands:

```bash
docker compose ps
docker compose logs -f web chatbot
docker compose down
```

No named volumes are required because application state remains in external
managed services.

## Deploy to Vercel

Vercel Services is currently in public Beta. Vercel does **not** deploy
`compose.yaml`; Compose is only the local orchestration surface. Vercel builds
every `Dockerfile.vercel` as an independently scaling, stateless container
Function on Fluid Compute.

Before deploying:

1. Create or link a Vercel project from the repository root.
2. In Build and Deployment settings, select **Services** as the framework.
3. Add the environment variables listed below for each service and for the
   appropriate Production, Preview, and Development environments.
4. Add the production/custom web domain to Firebase Authentication's
   **Authorized domains** list. For variable Preview URLs, use a stable custom
   preview domain or explicitly authorize each hostname that must support
   `signInWithPopup`.
5. Deploy from the connected Git repository or run `vercel deploy`.

Only `web` has a public rewrite. Auth, Orders, Products, Chatbot, and Images
remain private and are reachable only through declared service bindings.
Vercel injects deployment-aware URLs as follows:

| Caller | Target | Injected variable |
|---|---|---|
| Web | Auth | `AUTH_API_URL` |
| Web | Orders | `ORDERS_API_URL` |
| Web | Products | `PRODUCTS_API_URL` |
| Web | Chatbot | `CHATBOT_API_URL` |
| Web | Images | `IMAGE_SERVICE_BASE_URL` |
| Products | Images | `IMAGE_SERVICE_BASE_URL` |
| Chatbot | Products | `PRODUCTS_API_URL` |
| Chatbot | Orders | `ORDERS_API_URL` |

Do not manually set binding variables in Vercel. They are runtime-only URLs
generated for the matching Production or Preview deployment.

### Vercel environment variables

Set these values in the dashboard; do not upload local `.env` files:

- Web build/runtime: `NEXT_PUBLIC_FIREBASE_API_KEY`,
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, and
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- Auth: the `FIREBASE_*` service-account fields,
  `FIREBASE_WEB_API_KEY`, provisioning flags, and `SESSION_*`
- Orders: the `FIREBASE_*`, provisioning, and `SESSION_*` values
- Products: the `FIREBASE_*`, `SESSION_*`, `OPENAI_API_KEY`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
  `IMAGE_PUBLIC_BASE_PATH=/api/images` values
- Chatbot: `OPENAI_API_KEY`, model/cost controls documented in its example,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SESSION_COOKIE_NAME`
- Images: the exact `FIREBASE_*` names in
  `services/images/.env.example`, plus `FIREBASE_COLLECTION`, the clamped
  `MAX_B64_BYTES`, and the image dimension limits

For Auth, Products, and Orders, set `SESSION_COOKIE_SECURE=true` in Preview
and Production. Keep it `false` only for plain-HTTP local development. Leave
`SESSION_COOKIE_DOMAIN` empty for Vercel's generated hostnames; set a domain
only when all callers intentionally share a custom parent domain.

Vercel containers scale to zero and have an ephemeral filesystem. Do not
write sessions, uploads, databases, or other durable state inside a container.
Keep those in Firebase/Firestore, object storage, Supabase, or another backing
service.

The web BFF includes a bounded, per-instance chat rate limiter as a local
backstop. Because Vercel can run multiple instances and scale them to zero,
production cost controls must also be enforced globally (for example with
Vercel Firewall/rate limiting or a distributed quota keyed by authenticated
user). The in-memory limiter alone is not a global OpenAI spending cap.

## Direct development without Compose

The example upstream URLs point to the host ports, so services can also be
started individually. For the web application:

```bash
cd apps/web
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

For a Python service, create a virtual environment, install its requirements,
and run Uvicorn from that service directory. Use `app.main:app` for Auth,
Orders, Products, and Chatbot; use `main:app` for Images.

## Validate deployment configuration

After creating the real local env files:

```bash
docker compose config --quiet
python3 -m json.tool vercel.json >/dev/null
```

Build individual images when diagnosing a service:

```bash
docker build -f services/products/Dockerfile.vercel services/products
docker build -f apps/web/Dockerfile.vercel apps/web
```

The Dockerfiles never copy `.env` files or credential artifacts. The web
build accepts its local Firebase configuration only through a BuildKit secret.
