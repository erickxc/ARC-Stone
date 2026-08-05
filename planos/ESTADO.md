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
