# Estado da execução — Terminar o Portal do Cliente

Plano: `planos/PLANO-ATUAL.md` · Base: `6dc2a0b` · 4 tarefas

O **executor** escreve aqui ao concluir cada tarefa. O **orquestrador** lê daqui antes de
validar, e é notificado automaticamente quando um bloco novo aparece. Acrescente ao fim; não
reescreva o que já está registrado.

Formato de cada bloco:

```
## TAREFA N — concluida em AAAA-MM-DD HH:MM
Commit: <sha>
Arquivos: <lista>
Verificacao: <o que rodou e o resultado, incluindo o que NAO deu para rodar>
Desvios: <o que fez diferente do plano, e por que — ou "nenhum">
Duvidas: <o que ficou incerto — ou "nenhuma">
```

Se precisar **parar** no meio de uma tarefa, registre o bloqueio no formato descrito no plano e
não continue.

---

## Histórico dos planos anteriores

| Commit | Conteúdo |
|---|---|
| `dd968b1` | Med-Stone, endurecimento de segurança, compose de produção |
| `2c64c2e` | Portal do cliente — implementação inicial, base deste plano |
| `ed78630` | `plano(1)` modo executor em `AGENTS.md` |
| `776d425` | `plano(2)` fecha o bypass global de rate limit — validado |
| `6dc2a0b` | `plano(3)` closure fora do laço; **primeira execução de testes de banco** (9 em `test_projetos_push.py`) |

Blocos de estado do plano anterior: `planos/arquivo/2026-08-05-rate-limit-ESTADO.md`.

---

<!-- nenhuma tarefa deste plano executada ainda -->

## TAREFA 1 — concluida em 2026-08-05 11:44
Commit: 065ea9d
Arquivos: backend/routers/portal.py, backend/tests/test_portal.py
Verificacao: `python -m pytest backend/tests/test_portal.py -q` passou com 5 testes; `git diff --check` passou; busca por `cliente.nome` em `backend/` não encontrou ocorrências. Não executados: testes de integração com banco, previstos para tarefas posteriores.
Desvios: nenhum
Duvidas: nenhuma

## TAREFA 4 — concluida em 2026-08-05 12:03
Commit: nenhum (tarefa sem alteração de código)
Arquivos: nenhum
Verificacao: `docker compose up -d db` executado; `docker exec ... python -m pytest tests -q` executado contra o Postgres com 99 testes, 98 passaram e 1 falhou. `cd frontend && npm run build` passou; `cd frontend && npm run lint` passou.
Falha nominal: `tests/test_projetos_push.py::test_push_revisao_nova_cria_projeto_preservando_anterior` — esperava 2 projetos com `origem_ref=projeto-versionado`, encontrou 4. A falha foi apenas registrada, sem correção, conforme o plano.
Desvios: nenhum
Duvidas: a falha de contagem do teste de projetos precisa de decisão separada do orquestrador; não foi atribuída ao Portal.

## TAREFA 2 — concluida em 2026-08-05 12:01
Commit: f8e18eb
Arquivos: backend/routers/portal.py
Verificacao: a reprodução no Postgres confirmou `NotSupportedError: FOR UPDATE cannot be applied to the nullable side of an outer join`; a consulta foi separada em `_travar_proposta` sem eager loading e o lock direto retornou `LOCK_OK`. A suíte integrada posterior exercitou `POST /portal/decisao` com aprovação e recusa, ambos com sucesso; `git diff --check` passou.
Desvios: nenhum
Duvidas: nenhuma

## TAREFA 3 — concluida em 2026-08-05 12:01
Commit: 49733a1
Arquivos: backend/tests/test_portal_integracao.py
Verificacao: `docker exec ... python -m pytest tests/test_portal.py tests/test_portal_token.py tests/test_portal_integracao.py -q` passou com 23 testes no Postgres (5 unitários, 3 de token e 15 de integração). A suíte não revelou defeito de produção.
Desvios: os casos integrados foram separados em novo arquivo, conforme permitido pelo plano; nenhum código de produção foi alterado.
Duvidas: nenhuma
