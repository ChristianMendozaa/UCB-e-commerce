# CLAUDE.md

Guidance for Claude Code (or any future session) working in this repository.
For architecture, diagrams, and the reasoning behind these decisions, read
`README.md` first — this file is deliberately terse and assumes that context.

## What this is

Seven-service monorepo. `apps/web` (Next.js) is the only public surface; it
proxies `/api/*` to six private FastAPI services over env-resolved URLs
(Compose DNS locally, Vercel service bindings in production). Nothing else
is meant to be reachable from the browser directly.

- `auth` — Firebase session cookies, users, careers, RBAC.
- `products` — catalog, cart, inventory; calls `rag` to sync embeddings on write.
- `orders` — order lifecycle; transactional stock decrement.
- `chatbot` — the agent: OpenAI Responses API tool-calling loop; calls `rag`
  for retrieval instead of owning embeddings or vector persistence itself.
- `images` — validates/re-encodes/stores images as Base64 in Firestore.
- `rag` — owns the RAG index: OpenAI embeddings + Firestore Vector Search,
  behind an internal-token-authenticated API. Exists as its own
  service (not folded into `chatbot`) specifically so that `products → rag`
  and `chatbot → rag` don't form a cycle in Vercel's service-binding graph —
  see the *Vercel service bindings* gotcha below.

External: Firebase Auth/Firestore Vector Search and OpenAI.

## Commands

```bash
docker compose up --build        # full stack, from repo root

# Python services (auth, chatbot, products, images, rag each have their own venv/deps)
cd services/<name> && python -m pip install -r requirements.txt && pytest
cd services/chatbot && python -m pip install -r requirements-dev.txt && pytest  # needs pytest-asyncio

# Web
cd apps/web && pnpm install --frozen-lockfile && pnpm dev     # or: pnpm build
```

There is no root-level test runner or lint command — run each service's own
tooling. `orders` has no test suite yet. `chatbot` tests need
`requirements-dev.txt` (`pytest-asyncio`, `asyncio_mode = auto` in
`pytest.ini`); `products`/`images` write async tests as
`unittest.IsolatedAsyncioTestCase` instead and need no extra dependency.

## Invariants — do not break these silently

If a change touches `services/chatbot/app/services/agent_service.py` or
`app/core/tools.py`, these properties must still hold. If you need to change
one, say so explicitly rather than letting it drift:

- **One mutating tool call executes per model step.** Any additional mutation
  requested in the same step must be rejected (`mutation_deferred`), not
  queued or auto-retried.
- **The final agent step (`step == MAX_AGENT_STEPS`) never executes tools.**
  It only reports that the step budget was reached. This prevents a mutation
  from succeeding with no way to communicate the result, and prevents a
  client retry from duplicating it.
- **Mutating tools require a confirmation phrase parsed from the user's
  literal current message, not from the model's tool-call arguments alone.**
  The parsed confirmation's arguments must match the tool call's arguments
  exactly, and the confirmation is consumed on the first matching attempt —
  even if the downstream call then fails.
- **RAG results stay wrapped as `{"untrusted_data": true, ...}`.** Never
  return raw retrieved text to the model, and never relax the system prompt's
  instruction to treat tool/RAG output as data, not commands.
- **`navigate_tool` stays allowlisted.** Only known static paths or validated
  product/career IDs; `/admin` is explicitly excluded. The frontend
  (`chat-widget.tsx: safeNavigationPath`) re-validates independently — keep
  both checks in sync if the allowlist changes.
- **Every `response.output` item is preserved and replayed** in the next
  model call within a turn (the loop runs with `store=False`). Dropping
  reasoning or function-call items breaks multi-step tool use.
- **Every token/cookie verification path uses `check_revoked=True`**,
  including the 15-second clock-skew retry paths in `deps/auth.py` and
  `routers/auth.py`. Don't add a verification call that skips revocation
  checking.
- **Image budget stays 4 MiB original / 983,040 bytes Base64.** The Base64
  cap is derived from Firestore's 1 MiB document limit minus a 64 KiB margin
  — don't raise `MAX_B64_BYTES` past `MAX_SAFE_B64_BYTES` in
  `services/images/config.py`. Within that unchanged budget, originals are
  downscaled to a `MAX_STORED_IMAGE_EDGE` (1600px) long edge and always
  encoded as WebP before storage (`utils/utils.py: process_image`) — this
  changes what fits inside the cap, not the cap itself.
- **The browser only calls same-origin `/api/*`.** No component should ever
  fetch a backend service URL directly from client code.

## Conventions

- User-facing strings and the chatbot system prompt are in **Spanish**
  (this is a Bolivian university's storefront); code identifiers and comments
  are in **English**. Keep new user-facing text consistent with the existing
  Spanish copy.
- Pydantic request models use `model_config = ConfigDict(extra="forbid",
  strict=True)` — see `services/chatbot/app/routers/chat.py` for the pattern.
- Each service centralizes env access in one module (`config.py` or
  `app/core/config.py`) that validates and fails fast at import time rather
  than letting bad config surface later as a runtime error.
- `.env.example` files are committed and must stay in sync with what
  `config.py` actually reads. Real `.env`/`.env.local` files are gitignored;
  never commit one or a service-account JSON.
- Cross-service and cross-container URLs are always read from environment
  (`getUpstreamBaseUrl` in `apps/web/lib/server/upstreams.ts`, the
  `*_API_URL` env vars in Python configs) — never hardcode a host.

## Layout map

| To change... | Look in... |
|---|---|
| Agent loop, step budget, retry policy | `services/chatbot/app/services/agent_service.py` |
| Tool implementations, confirmation regex, navigation allowlist | `services/chatbot/app/core/tools.py` |
| System prompt / tool schemas | `services/chatbot/app/core/tools.py` (`SYSTEM_PROMPT`, `TOOLS_SCHEMA`) |
| RAG query (chat-time) and RAG write/embedding (`index_document`, `delete_document`) | `services/rag/app/services/rag_service.py`, exposed via `services/rag/app/routers/rag.py`; `chatbot` calls it over HTTP through `services/chatbot/app/services/rag_client.py` |
| RAG sync trigger (product write-time) | `services/products/app/core/rag_sync.py` — sends a product ID to `rag`'s `/internal/rag/documents`; `rag` reads and formats the Firestore product |
| Internal service-to-service auth (shared token) | `services/rag/app/deps/internal_auth.py` — validated by `rag`; sent by `products` and `chatbot` |
| Cart / cart→order transaction | `services/products/app/repositories/cart_repo.py`, `services/orders/app/routers/orders.py` |
| Career-scoped RBAC | `services/*/app/deps/permissions.py` |
| Session cookie lifecycle | `services/auth/app/routers/auth.py`, `services/*/app/deps/auth.py` |
| Image validation/re-encode | `services/images/utils/utils.py`, `services/images/config.py` |
| BFF proxying, upload limits, chat rate limiting | `apps/web/app/api/*/route.ts`, `apps/web/lib/server/*`, `apps/web/lib/upload-limits.ts` |
| Chat widget, client-side navigation re-validation | `apps/web/components/chat-widget.tsx` |

## Current state and gotchas

- `apps/web/package.json` still has `"name": "my-v0-project"` — cosmetic,
  left over from scaffolding; harmless but don't be surprised by it.
- `rag_chunks` document IDs are deterministic SHA-256 hashes of namespace,
  source ID, and chunk index. Keep that identity stable; changing it requires
  running `scripts/rebuild_index.py --prune` to remove orphan chunks.
- Vector indexes are committed in root `firestore.indexes.json`. Export and
  merge existing production indexes before deploying that file; never
  overwrite unrelated console-managed indexes blindly.
- `services/images` has no auth of its own — it trusts that only `web` and
  `products` can reach it over the private network. Don't expose its port
  publicly without adding auth first.
- `services/rag`'s `/internal/rag/*` endpoints require an `INTERNAL_API_TOKEN`
  shared with **both** `services/products` and `services/chatbot` — all three
  `.env` files must hold the exact same value or the caller's request will
  silently fail with 401 (products swallows it as a best-effort warning;
  chatbot's `/upload` and RAG-search tool surface it as an error to the user).
- **Vercel service bindings must stay acyclic.** `rag` exists as its own
  service, separate from `chatbot`, precisely so that `products → rag` and
  `chatbot → rag` don't close a cycle (`products → chatbot → products` failed
  a real deploy with `circular service binding` before this split). If you're
  tempted to fold `rag` back into `chatbot` or add a new cross-service call,
  first check the binding graph in `vercel.json` stays a DAG — Vercel rejects
  the whole deployment otherwise, with no per-service config workaround.
- Local Compose host ports: web 3000, auth 8001, orders 8002, products 8003,
  chatbot 8004, images 8005, rag 8006 — all bound to `127.0.0.1` only.
- `OPENAI_CHAT_MODEL` is env-configurable (`services/chatbot/app/core/config.py`);
  don't hardcode a model name in new code.
- CI (`.github/workflows/ci.yml`) runs each Python service's tests plus a
  `pnpm build` for web — no network calls to OpenAI/Firebase, no
  deploy step, no secrets.

## Tests

- Never let a test hit a real OpenAI/Firebase endpoint. Follow the
  existing `conftest.py` pattern: stub `app.core.firebase` before import,
  set test-only env vars (see `services/auth/tests/conftest.py` and
  `services/chatbot/tests/conftest.py`).
- When changing agent behavior, check whether an existing test in
  `services/chatbot/tests/test_agent_service.py` encodes the old behavior on
  purpose (see the Invariants section above) before changing it.
