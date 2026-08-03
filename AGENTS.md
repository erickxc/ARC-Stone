# Repository Guidelines

Canonical repository: [Yanngc32/ARC-ERP](https://github.com/Yanngc32/ARC-ERP).

## Project Structure & Module Organization

- `backend/` contains the FastAPI service, SQLAlchemy models, database setup, shared utilities, and feature routers under `backend/routers/`.
- `backend/tests/` holds pytest unit tests; private uploads and generated files live in `backend/uploads_private/` and `backend/uploads/`.
- `frontend/` is the React 19 + TypeScript + Vite application. Pages are in `frontend/src/`, reusable UI in `frontend/src/components/`, and API/browser-storage clients in `frontend/src/services/`.
- `site/public/` contains standalone static HTML pages and repository-level branding/design references. Docker and environment templates are at the repository root.

## Build, Test, and Development Commands

- `.\dev.ps1` starts PostgreSQL with Docker and launches the API and Vite dev server in separate PowerShell windows.
- `docker compose up -d --build` builds/starts the full local stack (`db`, `api`, and `frontend`).
- Backend manual setup: `cd backend; python -m venv venv; .\venv\Scripts\Activate.ps1; pip install -r requirements.txt; uvicorn main:app --reload --env-file ../.env`.
- Frontend: `cd frontend; npm install; npm run dev` for development, `npm run build` for a production build, and `npm run lint` for ESLint.
- Run backend tests with `pytest backend/tests`.

## Coding Style & Naming Conventions

Use 4-space indentation in Python and the existing TypeScript/JS formatting (2-space indentation, semicolons, single-quoted imports where already established). Name Python modules/functions in `snake_case`, React components in `PascalCase`, and hooks/utilities in `camelCase` or `use*`. Keep API concerns in routers/services rather than embedding them in UI components. Run `npm run lint` before submitting frontend changes.

## Testing Guidelines

Add focused pytest tests in `backend/tests/` using `test_*.py` files and `test_*` functions. Cover validation, authentication, uploads, and security-sensitive behavior, including rejection paths. No repository-wide coverage threshold is currently enforced; run the relevant tests plus the full backend suite when changing shared code.

## Commit & Pull Request Guidelines

Recent history uses short Conventional Commit-style prefixes such as `feat:`, `fix:`, `chore:`, `infra:`, `ci:`, and `seguranca:`. Keep subjects imperative and scoped. PRs should explain behavior changes, list validation commands, link the issue or task, and include screenshots for UI changes. Never commit `.env`, credentials, tokens, or generated/private uploads; use `.env.example` for configuration documentation.
