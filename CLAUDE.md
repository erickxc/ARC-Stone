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

## ARC Stone — origem e visão

Este repositório (`erickxc/ARC-Stone`) nasceu em 2026-08-10 como um **fork completo** (histórico de
commits preservado) de `ARC-ERP` (voltado a escritórios de arquitetura/interiores). A partir de
agora os dois evoluem **como sistemas separados**, não como um único sistema com uma flag de
"vertical" — cada segmento da construção civil tem seu próprio repositório/deploy. A visão de longo
prazo é o ARC se tornar um conjunto de microserviços por segmento (arquitetura, marmoraria, e outros
que vierem depois), mas isso é direção futura, não algo já implementado — hoje são só dois
repositórios independentes que compartilham a mesma base de código original.

Este repositório é o ponto de partida para **ARC Stone**, a variante para **marmorarias**.

### Mudanças planejadas (em andamento)

O detalhamento completo — com todas as decisões fechadas e pendentes — está em
[`planos/CHECKLIST-reorganizacao-nav-tema.md`](planos/CHECKLIST-reorganizacao-nav-tema.md). Resumo
prático do que muda em relação ao ARC-ERP original:

**1. Tema claro** — hoje `--bg` é creme (`#f8f6f0`) e a sidebar é escura fixa nos dois temas.
Decisão: `--bg` claro vira cinza neutro (próx. `#f2f2f0`), e a sidebar clareia (fica num cinza
intermediário — usa `--surface2` do tema claro), sem virar branca.

**2. Menu lateral reorganizado em acordeão** — os grupos hoje são cabeçalhos estáticos
(`VENDAS`/`GALPÃO`/`GESTÃO`) sem colapsar. Passam a ser 6 grupos colapsáveis, clicáveis:

```
▾ Orçamentos
    Novo Orçamento              (era "Construtor de orçamento" / rota builder)
    Listagem de orçamentos      (nova: tabela de Orcamento, todos os status; clique na linha abre o detalhe)
▸ Vendas
    Clientes                    (era "Carteira de clientes")
    Pipeline de vendas          (kanban, sem mudança de comportamento)
    Histórico de vendas         (nova: listagem tabular da entidade Venda, não de Orcamento)
▸ Galpão
    Catálogo de produtos
    Catálogo de serviços        (novo — ver item 4)
    Fornecedores
    Perdas e Avarias            (novo — ver item 5)
    Equipamentos                (novo — ver item 6)
    Controle de Estoque
▸ Gestão
    Calendário
    Painel Financeiro
    Equipe
▸ Configurações
    Integrações
    Logs de Auditoria
    Configurações do Orçamento  (absorve a tela OrcamentoConfig, que hoje fica solta no fluxo do builder)
▸ Meu Perfil                    (nova tela — hoje o avatar leva para Equipe, que mistura MFA/segurança)
```

**3. Venda passa a ser entidade própria**, distinta de Orçamento — não é um filtro por status.
Exemplo prático: um orçamento pode ficar `Aprovado` e o cliente desistir antes de qualquer entrega —
nesse caso não existe Venda, só o Orçamento aprovado. A conversão **não é automática**: é uma ação
explícita (ex.: botão "Converter em venda" na tela de detalhe do orçamento, condicionado a
`status=Aprovado`), que cria um registro em uma nova tabela `Venda` referenciando o `Orcamento`.
"Histórico de vendas" no menu lista essa tabela nova, não `Orcamento`.

**4. Catálogo de serviços** — nova entidade `Servico`, separada de `Produto`. Exemplo prático:
"Instalação de bancada — banheiro", com preço padrão e tempo médio de execução (ex.: 3h). O tempo
médio alimenta o cálculo automático de prazo de entrega no Calendário quando o serviço entra num
orçamento — hoje `OrcamentoItem` só referencia `Produto`; vai precisar aceitar item de serviço
também.

**5. Perdas e Avarias** — nova tela/tabela para registrar perda de estoque (peça ou bancada que
quebrou etc.), com motivo, justificativa e data. Ao ser registrada, deve debitar o estoque do
`Produto` afetado (gerando uma `MovimentacaoEstoque` de saída), do mesmo jeito que uma venda abateria
estoque.

**6. Equipamentos** — cadastro de máquinas/ferramentas que a marmoraria tem (ex.: cortadeira,
policorte), com estado/condição. Inclui também inventário de **matéria-prima** (ex.: chapas de
granito/mármore antes de virarem produto) como entidade própria, separada do catálogo de `Produto`
acabado — não reaproveita o Controle de Estoque existente.

### O que ainda está pendente de decisão

- Enum exato de motivos de Perda/Avaria.
- Schema definitivo de `Venda`, `Servico`, `PerdaAvaria`, `Equipamento` e da matéria-prima nova.
- Regra de cálculo de prazo de entrega a partir do tempo médio de serviços (soma simples? considera
  capacidade da equipe/equipamentos em paralelo?).
- Se `OrcamentoItem` vira polimórfico (produto ou serviço) ou ganha uma segunda FK opcional.

Antes de implementar qualquer um dos módulos novos, releia o checklist citado acima — ele tem o
raciocínio completo por trás de cada decisão, não só a conclusão.
