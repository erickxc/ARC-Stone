# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ARC Stone is an ERP/CRM for a **marmoraria** (stone/countertop shop) — sales, production
tracking, and inventory of finished pieces and raw slabs. Backend is a FastAPI +
PostgreSQL service; frontend is a React 19 + TypeScript + Vite SPA. The domain language
and code identifiers are in Portuguese (`orcamento` = quote, `cliente` = client,
`fornecedor` = supplier, `estoque` = inventory, `usuario` = user).

Forked from `ARC-ERP` (an interiors/architecture ERP) on 2026-08-10; the two repos now
evolve independently. Rental (`Locacao`) was removed entirely — a marmoraria doesn't
rent — along with all renewal logic. See "ARC Stone — estado atual" below for what was
built on top of the fork and what's still open.

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
- **No migration tool.** On startup, `Base.metadata.create_all` creates tables from `models.py`, then hand-written `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements in `on_startup()` patch new columns onto existing tables (create_all never ALTERs). When you add a column to an existing model, add the matching `ALTER` there. Startup also seeds an admin user from `ADMIN_EMAIL`/`ADMIN_PASSWORD` when the `usuarios` table is empty, and seeds the configurable catalogs (payment types/forms, production stages, loss reasons) when each is empty — see `_semear_catalogos()`.
- `models.py` — all SQLAlchemy models in one file. **Money is stored as integer cents** (`preco_custo`, `preco_venda`); convert at the boundary, never store floats for currency. `CatalogoSimplesMixin` (`nome`/`ativo`/`ordem`/`built_in`) backs every configurable catalog (`TipoPagamento`, `FormaPagamento`, `CondicaoPagamento`, `Local`, `MotivoPerdaAvaria`, `EtapaProducao`) — `built_in=True` rows can be renamed/deactivated/reordered but never deleted (enforced in the router, not just convention).
- `routers/` — one `APIRouter` per domain, each with a `prefix` (`/orcamentos`, `/auth`, `/clientes`, `/fornecedores`, `/estoque`, `/usuarios`, `/calendario`, `/uploads`, `/logs`, `/catalogos`, `/producao`, `/servicos`). Keep API/DB logic in routers and shared helpers, not spread elsewhere. `routers/catalogos.py` has a generic `registrar_catalogo()` helper that mounts GET/POST/PATCH/PATCH-reordenar/DELETE for a catalog in one call; `FormaPagamento` gets hand-written routes instead (POST validates the parent `TipoPagamento`, GET filters by it) since it doesn't fit the generic shape.
- `schemas.py` — Pydantic request/response models. **`*Out` schemas never inherit from `*Create`/`*Base`** — a validator or field constraint meant for input would otherwise apply retroactively to reading already-persisted rows (a single row that predates a new validation rule can 500 an entire list endpoint). Declare output schemas standalone.
- `auth.py` — JWT auth with token `type`s (`access`, `refresh`, `reset`, `mfa_pending`) and TOTP MFA (`pyotp`). Tokens accepted via `Authorization: Bearer` **or** an `access_token` cookie (`extract_bearer_or_cookie`). RBAC via `RoleChecker(['admin', ...])` used as a route dependency; `get_current_user` for any authenticated user. Roles include `admin` and `estoquista`. Routers additionally scope data by ownership (e.g. non-admins only see their own `orcamentos` via `vendedor_id`).
- Helper modules: `pdf_generator.py` (reportlab quote PDFs), `anexo_utils.py` (attachment validation/storage), `ssrf_utils.py` (SSRF guards for outbound fetches), `rate_limiter.py` (slowapi limiter, default `100/minute`).

**Uploads are served authenticated, not statically.** `main.py` intentionally does *not* mount `StaticFiles`. `GET /static/uploads/{filename}` validates the JWT and guards against path traversal before returning the file. Private attachments live in `uploads_private/anexos/`; `_migrate_legacy_anexos` moves legacy public attachments there on startup.

**Frontend (`frontend/src/`)** — a flat, minimal SPA (note: this differs from what AGENTS.md describes — there is no `components/` or `services/` directory yet):
- `App.tsx` — the whole UI: hash-based routing over a `Route` union (`dashboard | clients | pipeline | builder | ...`), sidebar shell, and page components inline. **~2900 lines and growing** — a split into modules (`ui.tsx`, `orcamento.tsx`, `clientes.tsx`, `configuracoes.tsx`, ...) is planned but not done (see "O que falta" below); don't make it worse by adding new screens as one-line JSX blobs — write new components with normal multi-line JSX.
- `api.ts` — the single typed API client. All calls hit the `/api` prefix; Vite (dev, `vite.config.ts`) and Nginx (`nginx.conf`, prod) proxy `/api` → the backend and strip the prefix. Add new endpoints and their TypeScript interfaces here.
- `data.ts` — static seed/mock data still referenced by some screens.
- Styling is plain CSS (`index.css`, `overlays.css`); no component/CSS framework. Sidebar nav is two `<nav>` elements: a scrollable one (`navGroups`) and a fixed one anchored above the user card (`navGroupsFixos`, currently "Configurações" and "Meu Perfil").

**Domain concepts specific to ARC Stone (not in the original ARC-ERP fork):**
- `Orcamento.tipo_orcamento` — `Obra | Peça | Projeto | Externo` (replaced `Venda/Locacao/Producao`). Obra/Projeto accept produto and serviço items; Peça only produto; Externo only `is_externo` items. Validated in `schemas.OrcamentoCreate`.
- `Orcamento.modalidade` — `venda_direta | orcamento_formal`, orthogonal to `tipo_orcamento`. Venda direta closes the sale (payment, stock reservation, financial ledger entry, production order) in the same request as `POST /orcamentos`; orçamento formal defers all of that until the quote is approved via the client portal and explicitly converted with `POST /orcamentos/{id}/converter-venda`.
- `OrcamentoItem.unidade_medida` — `m2 | linear | un`, copied from the product/service-component at insertion time. Decides the line-total formula in `schemas.calcular_total_linha()`: `m2` multiplies by `area_m2` (computed server-side as `comprimento_m × largura_m`, `ROUND_HALF_UP`), `linear` by `comprimento_m`, `un` by `quantidade`. **This formula has one canonical implementation** (`_valor_total_orcamento` in `routers/orcamentos.py`) consumed by the PDF, the client portal, and the financial ledger — don't recompute totals ad hoc elsewhere.
- `Cliente` supports PF (`nome`+`sobrenome`) and PJ (`razao_social`); `nome_fantasia` is **derived**, computed by the router on every write from whichever applies — it's read in ~12 places (PDF, portal, kanban, calendar) so it stays as the single display-name column rather than requiring every reader to branch on `tipo_pessoa`.
- **Esteira de produção** (`routers/producao.py`): an `OrdemProducao` is created automatically alongside every `Venda` (`criar_ordem_para_venda`), starting at the first active `EtapaProducao`. It advances (or *retreats* — a piece that breaks in cutting goes back a stage) via `PATCH /producao/ordens/{id}/mover`, which appends to `OrdemProducaoEtapa` history. Reaching an `is_final` stage sets `concluida_em`; moving back out of one clears it. Vendedores see only orders from their own sales; admin/estoquista move orders.

## Conventions

- Python: 4-space indent, `snake_case` modules/functions. TypeScript/React: 2-space indent, `PascalCase` components, `camelCase`/`use*` hooks and utilities.
- Commits use Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, `infra:`, `ci:`, `seguranca:`), imperative and scoped. Commit messages and code are written in Portuguese.
- Add pytest tests in `backend/tests/` as `test_*.py` / `test_*` functions; cover validation, auth, uploads, and rejection paths for security-sensitive changes.
- Never commit `.env`, credentials, or generated/private uploads (`uploads/`, `uploads_private/`); document config in `.env.example`.

## ARC Stone — estado atual (atualizado em 2026-08-11)

> Nota: uma versão anterior deste arquivo apontava para
> `planos/CHECKLIST-reorganizacao-nav-tema.md` como fonte de decisões. **Esse arquivo nunca
> existiu no repositório** — referência quebrada, removida nesta atualização. O plano real
> vivo é [`planos/PLANO-ATUAL.md`](planos/PLANO-ATUAL.md); histórico de execução em
> [`planos/ESTADO.md`](planos/ESTADO.md).

### O que já está construído

- **Tema claro** — `--bg` é cinza neutro (`#f2f2f0`), sidebar num cinza intermediário nos
  dois temas (não branca). Ver `index.css`.
- **Menu lateral em acordeão**, 4 grupos roláveis (Orçamentos, Vendas, Galpão, Gestão) + 2
  grupos fixos no rodapé (Configurações, Meu Perfil) — ver `navGroups`/`navGroupsFixos` em
  `App.tsx`. Estrutura atual, não a original planejada (ex.: "Carteira de clientes" mora em
  Gestão, não em Vendas).
- **`Venda`** é entidade própria (`models.py`), criada por ação explícita
  (`POST /orcamentos/{id}/converter-venda`, exige `status=Aprovado`) ou automaticamente
  quando `modalidade=venda_direta` fecha a venda no mesmo request de criação do orçamento.
  "Histórico de vendas" lista essa tabela, não `Orcamento`.
- **`Servico`** (catálogo próprio, separado de `Produto`) suporta composição: um serviço
  pode ter `ServicoComponente`s (ex. "Bancada Banheiro" = Bancada + Saia + Front
  obrigatórios + Ilharga opcional), cada um com sua própria `unidade_medida` e preço.
  Componentes marcados num orçamento entram como linhas próprias do `OrcamentoItem`
  (`servico_componente_id`), não como um item polimórfico agregado.
- **Perdas e Avarias** (`routers/perdas.py`) — motivo vem do catálogo configurável
  `MotivoPerdaAvaria` (ver abaixo); registrar uma perda debita `Produto.quantidade_estoque`
  via `MovimentacaoEstoque` de saída, igual a uma venda.
- **Equipamentos** e **matéria-prima** (`models.Equipamento`, `models.MateriaPrima`) —
  cadastros próprios, `materia_prima.py` separado do Controle de Estoque de `Produto`.
- **Catálogos configuráveis** (`routers/catalogos.py`, tela "Configurações do orçamento"):
  `TipoPagamento`, `FormaPagamento`, `CondicaoPagamento`, `Local`, `MotivoPerdaAvaria`,
  `EtapaProducao`. Todos com ordenação (botões ↑/↓, não drag-and-drop — ver
  `CatalogoConfiguravel` em `App.tsx`) e a regra `built_in`: desativa e reordena, nunca
  exclui.
- **Esteira de produção** (`routers/producao.py`, rota `producao`) — kanban por etapa,
  ordem nasce com a venda, histórico de transições, responsável e previsão de entrega.
  Ver "Domain concepts" acima para os detalhes de modelagem.
- **Cliente PF/PJ** com endereço estruturado (CEP com autopreenchimento via proxy
  server-side ao ViaCEP), carteira/indicação/profissional, data de nascimento, origem e
  preferência de contato, e trilha de autoria (`criado_por`/`editado_por`).
- **Tabela de itens do orçamento** com 11 colunas fixas (Cód., Local, Qtd, Descrição,
  Tipo, Comp., Larg., m², Acréscimos, Descontos, Total) mais seleção múltipla e exclusão
  em lote.

### O que ainda falta / dívidas conhecidas

- **Frete fixo de R$ 250,00 hardcoded em todo PDF** (`pdf_generator.py`, rotulado "Frete RJ
  Capital") — herança do ARC-ERP original (negócio no Rio); precisa virar configuração ou
  sair do documento. O cliente assina um total com um frete que ninguém escolheu.
- **Sem teto de desconto por perfil de usuário** — `desconto_centavos`/`desconto_global_centavos`
  são validados para não deixar o total negativo, mas qualquer vendedor pode zerar a
  margem de uma linha. Vazamento de margem conhecido em CPQ; precisa de limite por `role`
  com override auditado.
- **`App.tsx` não foi dividido** em módulos (ver nota na seção Architecture) — é uma
  entrega própria, de puro movimento de código, ainda não feita.
- **`PerdaAvaria.motivo` continua `String`**, não FK para `MotivoPerdaAvaria` — decisão
  consciente (evitar migração de dados/filtros existentes fora de escopo), não esquecimento.
- Responsável/previsão de entrega da ordem de produção têm UI (Modal de detalhe), mas
  não há indicador de atraso agregado fora da tela da esteira (ex. no dashboard).
