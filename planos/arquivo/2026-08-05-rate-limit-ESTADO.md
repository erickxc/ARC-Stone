# Estado da execução — Fechar a raiz do bypass de rate limit

Plano: `planos/PLANO-ATUAL.md` · Base: `f0399f4` · 3 tarefas

O **executor** escreve aqui ao concluir cada tarefa. O **orquestrador** lê daqui antes de
validar, e é notificado automaticamente quando este arquivo muda. Acrescente ao fim; não
reescreva o que já está registrado.

Formato de cada bloco:

```
## TAREFA N — concluída em AAAA-MM-DD HH:MM
Commit: <sha>
Arquivos: <lista>
Verificação: <o que rodou e o resultado, incluindo o que NÃO deu para rodar>
Desvios: <o que fez diferente do plano, e por quê — ou "nenhum">
Dúvidas: <o que ficou incerto — ou "nenhuma">
```

Se precisar **parar** no meio de uma tarefa (ver "Quando parar e reportar" no plano), registre
assim e não continue:

```
## TAREFA N — BLOQUEADA em AAAA-MM-DD HH:MM
Onde parei: <arquivo:linha ou passo do plano>
O que encontrei: <o fato concreto que contradiz o plano ou falta>
O que preciso: <decisão, credencial, ou correção do plano>
```

---

## Histórico anterior (contexto, não é tarefa deste plano)

| Commit | Conteúdo |
|---|---|
| `2ead6f6` | `docs:` pasta `planos/` |
| `dd968b1` | `seguranca:` rate limit parcial, Dockerfile, compose prod, nginx, Med-Stone, docs |
| `2c64c2e` | `feat(portal):` portal do cliente em andamento — **não validado** |
| `f0399f4` | `docs(planos):` higiene registrada |

Achados abertos ao gerar este plano:

| Achado | Situação |
|---|---|
| 🔴 Bypass de rate limit pelo `key_func` global | **TAREFA 2** deste plano |
| 🟢 `dimensao_em_cm` recriada dentro do laço | **TAREFA 3** deste plano |
| 🟡 Índice único com `origem_rev` nulo | Corrigido em `dd968b1` (índice parcial complementar) |

Pendente de validação, fora deste plano: as 282 linhas de `backend/routers/portal.py` e os
testes de banco de `/projetos/push` e `/portal`, que nunca rodaram (Docker desligado).

---

<!-- nenhuma tarefa deste plano executada ainda -->

## TAREFA 1 — concluída em 2026-08-05 11:29
Commit: ed78630
Arquivos: AGENTS.md
Verificação: `git status --short` limpo após o commit; `git log --oneline -1` mostra `ed78630 plano(1): define modo executor de planos`; `git diff --check` passou. Não foram executados testes de código, pois esta tarefa altera somente documentação.
Desvios: nenhum
Dúvidas: nenhuma

## TAREFA 2 — concluída em 2026-08-05 11:34
Commit: 776d425
Arquivos: backend/rate_limiter.py, backend/routers/projetos.py, backend/tests/test_rate_limiter.py
Verificação: Atributo `limiter._key_func` confirmado e aponta para `_rate_limit_ip`; `git diff --check` passou; `python -m pytest backend/tests/test_rate_limiter.py -q` passou com 4 testes; bateria `python -m pytest backend/tests/test_rate_limiter.py backend/tests/test_portal_token.py backend/tests/test_ssrf_utils.py backend/tests/test_anexo_utils.py -q` passou com 22 testes. Não executados: suíte completa do backend e testes que exigem banco/Docker, fora da verificação desta tarefa. Foram emitidos apenas avisos de depreciação do Pydantic/FastAPI/SlowAPI e aviso do cache do pytest.
Desvios: nenhum
Dúvidas: nenhuma

## TAREFA 3 — concluída em 2026-08-05 11:38
Commit: 6dc2a0b
Arquivos: backend/routers/projetos.py
Verificação: `docker compose up -d db` executado com sucesso; `test_projetos_push.py` executado dentro do container `arc_api` usando o banco dedicado `arc_erp_test`, com 9 testes passando; `git diff --check` passou. Foram emitidos 19 avisos de depreciação do FastAPI, Pydantic, Starlette e Passlib.
Desvios: nenhum
Dúvidas: nenhuma
