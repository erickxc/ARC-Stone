# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ARC ERP is an ERP/CRM for an interiors & architecture business (furniture sales,
rental, and production). Backend is a FastAPI + PostgreSQL service; frontend is a
React 19 + TypeScript + Vite SPA. The domain language and code identifiers are in
Portuguese (`orcamento` = quote, `cliente` = client, `fornecedor` = supplier,
`estoque` = inventory, `usuario` = user).

## Commands

Local dev (Windows/PowerShell, the primary workflow):
- `.\dev.ps1` — starts PostgreSQL in Docker, then opens the API (uvicorn) and Vite dev server in separate windows.
- `docker compose up -d --build` — full local stack (`db`, `api`, `frontend`) via containers.

Backend (from `backend/`):
- Setup: `python -m venv venv; .\venv\Scripts\Activate.ps1; pip install -r requirements.txt`
- Run: `uvicorn main:app --reload --env-file ../.env`
- Tests: `pytest backend/tests` (run from repo root), or `pytest backend/tests/test_ssrf_utils.py::test_name` for a single test.

Frontend (from `frontend/`):
- `npm install`, then `npm run dev` (dev), `npm run build` (tsc typecheck + production build), `npm run lint` (ESLint). Run `npm run lint` before submitting frontend changes.

An `.env` is required at repo root (copy `.env.example`). Both `database.py` and `auth.py` raise on startup if `DATABASE_URL` / `SECRET_KEY` are missing.

## Architecture

**Backend (`backend/`)** — a router-per-domain FastAPI app:
- `main.py` wires everything: registers routers, CORS, a `SecurityHeadersMiddleware` (CSP/HSTS/etc.), slowapi rate limiting, and a `startup` hook.
- **No migration tool.** On startup, `Base.metadata.create_all` creates tables from `models.py`, then hand-written `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements in `on_startup()` patch new columns onto existing tables (create_all never ALTERs). When you add a column to an existing model, add the matching `ALTER` there. Startup also seeds an admin user from `ADMIN_EMAIL`/`ADMIN_PASSWORD` when the `usuarios` table is empty.
- `models.py` — all SQLAlchemy models in one file. **Money is stored as integer cents** (`preco_custo`, `preco_venda`); convert at the boundary, never store floats for currency.
- `routers/` — one `APIRouter` per domain, each with a `prefix` (`/orcamentos`, `/auth`, `/clientes`, `/fornecedores`, `/estoque`, `/usuarios`, `/calendario`, `/uploads`, `/logs`). Keep API/DB logic in routers and shared helpers, not spread elsewhere.
- `schemas.py` — Pydantic request/response models.
- `auth.py` — JWT auth with token `type`s (`access`, `refresh`, `reset`, `mfa_pending`) and TOTP MFA (`pyotp`). Tokens accepted via `Authorization: Bearer` **or** an `access_token` cookie (`extract_bearer_or_cookie`). RBAC via `RoleChecker(['admin', ...])` used as a route dependency; `get_current_user` for any authenticated user. Roles include `admin` and `estoquista`. Routers additionally scope data by ownership (e.g. non-admins only see their own `orcamentos` via `vendedor_id`).
- Helper modules: `pdf_generator.py` (reportlab quote PDFs), `anexo_utils.py` (attachment validation/storage), `ssrf_utils.py` (SSRF guards for outbound fetches), `rate_limiter.py` (slowapi limiter, default `100/minute`).

**Uploads are served authenticated, not statically.** `main.py` intentionally does *not* mount `StaticFiles`. `GET /static/uploads/{filename}` validates the JWT and guards against path traversal before returning the file. Private attachments live in `uploads_private/anexos/`; `_migrate_legacy_anexos` moves legacy public attachments there on startup.

**Frontend (`frontend/src/`)** — a flat, minimal SPA (note: this differs from what AGENTS.md describes — there is no `components/` or `services/` directory yet):
- `App.tsx` — the whole UI: hash-based routing over a `Route` union (`dashboard | clients | pipeline | builder | ...`), sidebar shell, and page components inline.
- `api.ts` — the single typed API client. All calls hit the `/api` prefix; Vite (dev, `vite.config.ts`) and Nginx (`nginx.conf`, prod) proxy `/api` → the backend and strip the prefix. Add new endpoints and their TypeScript interfaces here.
- `data.ts` — static seed/mock data still referenced by some screens.
- Styling is plain CSS (`index.css`, `overlays.css`); no component/CSS framework.

## Conventions

- Python: 4-space indent, `snake_case` modules/functions. TypeScript/React: 2-space indent, `PascalCase` components, `camelCase`/`use*` hooks and utilities.
- Commits use Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, `infra:`, `ci:`, `seguranca:`), imperative and scoped. Commit messages and code are written in Portuguese.
- Add pytest tests in `backend/tests/` as `test_*.py` / `test_*` functions; cover validation, auth, uploads, and rejection paths for security-sensitive changes.
- Never commit `.env`, credentials, or generated/private uploads (`uploads/`, `uploads_private/`); document config in `.env.example`.
