# Estado da execução — Portal do Cliente

Plano: `planos/PLANO-ATUAL.md` · Base: `2c64c2e` · TAREFA 0 + 8 tarefas

O **executor** escreve aqui ao concluir cada tarefa. O **orquestrador** lê daqui antes de
validar. Acrescente ao fim; não reescreva o que já está registrado.

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

## Higiene da árvore — feita pelo orquestrador em 2026-08-05

Registro fora do formato porque não foi o executor que fez, e porque explica de onde vieram os
commits que já estão no histórico.

A árvore tinha 28 alterações pendentes de três frentes misturadas (Med-Stone, endurecimento de
segurança e o início do portal), o que impedia qualquer validação de dizer de quem era cada
linha. Foram commitadas por fronteira de arquivo — o corte mais fino possível sem staging
interativo. `backend/main.py`, `models.py`, `schemas.py` e `auth.py` contêm as três frentes no
mesmo diff e ficaram no commit do portal; está registrado aqui porque não dá para inferir isso
do histórico.

| Commit | Conteúdo |
|---|---|
| `2ead6f6` | `docs:` pasta `planos/` (só documentação) |
| `dd968b1` | `seguranca:` rate limit, Dockerfile, compose de produção, nginx, Med-Stone, docs |
| `2c64c2e` | `feat(portal):` trabalho em andamento do portal — **não validado** |

Verificado após os commits: 21 testes sem banco passando; `npm run build` e `npm run lint`
limpos. **Os testes que exigem Postgres não rodaram** — Docker estava desligado. Isso inclui
todos os testes de `/projetos/push` e de `/portal`.

### Achados anteriores — situação

| Achado | Situação |
|---|---|
| 🔴 Bypass de rate limit por `X-API-Key` | **Parcialmente corrigido.** As 4 rotas de `/auth` receberam `key_func=_rate_limit_ip`, mas o `key_func` global segue confiando no header — os `default_limits` e as 4 rotas novas de `/portal` continuam expostos. Virou a **TAREFA 0** do plano atual. |
| 🟡 Índice único não cobre `origem_rev` nulo | **Corrigido**, com abordagem diferente da proposta: em vez de `COALESCE`, um índice parcial complementar `uq_projetos_origem_ref_sem_rev` sobre `(usuario_id, origem, origem_ref) WHERE origem_ref IS NOT NULL AND origem_rev IS NULL` (`main.py:204`). Solução válida e menos invasiva — não exige recriar o índice existente. Desvio aceito. |
| 🟢 `dimensao_em_cm` recriada dentro do laço | **Aberto.** `projetos.py:162-168`. Cosmético; sem tarefa alocada. |

---

<!-- nenhuma tarefa do plano atual executada pelo executor ainda -->
