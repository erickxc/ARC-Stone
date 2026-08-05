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

## Modo Executor de Planos

Este protocolo substitui qualquer modo executor anterior e só se aplica enquanto o usuário mantiver o modo `/executor` ligado. Ative com `/executor`. Desative com `/executor off`. Com o modo desligado, pedidos comuns para executar, rodar, continuar ou concluir um plano não ativam este protocolo automaticamente.

### Início obrigatório

1. Leia integralmente as instruções aplicáveis já existentes, incluindo `AGENTS.md`, `CLAUDE.md` e instruções mais específicas dos diretórios envolvidos.
2. Leia integralmente `planos/PLANO-ATUAL.md`. Se o usuário não indicar outro plano, esse é o único plano válido. Nunca substitua silenciosamente por outro arquivo.
3. Leia `planos/ESTADO.md`. Arquivos em `planos/arquivo/` são históricos e nunca devem ser executados.
4. Continue pela primeira tarefa ainda incompleta. Nunca refaça uma tarefa marcada como concluída.

### Escopo de uma execução

- Execute exatamente uma tarefa por chamada do usuário. Ao concluir ou bloquear essa tarefa, pare e devolva o controle.
- Respeite rigorosamente a seção `arquivos que esta tarefa pode tocar`. Se precisar de qualquer arquivo fora da lista, pare e peça decisão; não improvise nem expanda escopo.
- Siga o plano como contrato: não adicione melhorias, refatorações ou correções não solicitadas. Registre problema preexistente e não relacionado em `Dúvidas`; não o corrija nesta tarefa.
- Preserve alterações preexistentes do usuário e nunca as sobrescreva.
- Antes de alterar código, entenda o comportamento existente e mantenha segurança da informação, responsividade, documentação/comentários e o design já estabelecido.

### Conclusão obrigatória

Uma tarefa só está concluída quando a implementação e a verificação terminarem:

1. Execute as validações previstas no plano e as validações relevantes para a mudança.
2. Separe claramente verificações aprovadas de verificações não executadas. Nunca declare que tudo passou se algo não foi executado.
3. Crie exatamente um commit exclusivo para a tarefa, com mensagem Conventional Commit no idioma do repositório, no formato obrigatório `plano(N): <o que foi feito>`.
4. Acrescente ao final de `planos/ESTADO.md`, sem reescrever nem remover registros anteriores:

   ```text
   ## TAREFA N — concluída em AAAA-MM-DD HH:MM
   Commit: <sha>
   Arquivos: <lista>
   Verificação: <o que foi executado e resultado, incluindo o que não pôde ser executado>
   Desvios: <diferença e motivo ou "nenhum">
   Dúvidas: <incerteza ou "nenhuma">
   ```

### Bloqueios e parada segura

Pare imediatamente, sem criar commit de conclusão, quando ocorrer qualquer condição abaixo: necessidade de arquivo fora da lista permitida; contradição entre plano e código; teste existente quebrado pela mudança; duas escolhas razoáveis sem decisão; credencial, serviço externo ou dado ausente.

Registre o bloqueio ao final de `planos/ESTADO.md`, sem apagar histórico:

```text
## TAREFA N — BLOQUEADA em AAAA-MM-DD HH:MM
Onde parei: <arquivo:linha ou etapa do plano>
O que encontrei: <fato concreto que contradiz o plano ou está ausente>
O que preciso: <decisão, credencial ou correção do plano>
```

Após registrar o bloqueio, pare e informe o usuário. Não contorne a restrição, não escolha silenciosamente entre alternativas e não avance para outra tarefa.

### Relato

Ao final, informe a tarefa tratada, arquivos tocados, commit (quando houver), verificações aprovadas, verificações não executadas, desvios, dúvidas e bloqueios. O registro em `planos/ESTADO.md` é obrigatório e deve corresponder exatamente ao que ocorreu no ambiente.
