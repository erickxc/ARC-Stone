# Estado da execução — Tela do orçamento + kanban arrastável

Plano: `planos/PLANO-ATUAL.md` · Base: `df20b64` · 6 tarefas

O **executor** escreve aqui ao concluir cada tarefa, **acrescentando ao fim do arquivo**. O
**orquestrador** lê daqui antes de validar e é notificado quando um bloco novo aparece.

```
## TAREFA N — concluida em AAAA-MM-DD HH:MM
Commit: <sha>
Arquivos: <lista>
Verificacao: <o que rodou e o resultado, incluindo o que NAO deu para rodar>
Desvios: <o que fez diferente do plano, e por que — ou "nenhum">
Duvidas: <o que ficou incerto — ou "nenhuma">
```

Bloqueio: use o formato descrito no plano e não continue.

---

## Histórico

| Commit | Conteúdo |
|---|---|
| `2c64c2e` | Portal do cliente — implementação inicial |
| `776d425` | Fecha o bypass global de rate limit |
| `065ea9d` / `f8e18eb` | Dois defeitos fatais do portal (`cliente.nome`, `FOR UPDATE`) |
| `49733a1` | 15 testes de integração do portal |
| `df20b64` | Fecha o plano do portal — suíte: 99 testes, 98 passam |

Planos e estados anteriores em `planos/arquivo/`.

### Pendências conhecidas, fora deste plano

- `test_push_revisao_nova_cria_projeto_preservando_anterior` falha da 2ª execução em diante:
  conta projetos sem filtrar por usuário e o `conftest` não limpa as tabelas. Defeito de
  isolamento do teste, não de produção.
- Builder não carrega orçamento existente — entrega própria (ver TAREFA 3).
- **Tela do cliente** não abre: não há como ver os dados de um cliente nem os orçamentos dele.
- **Painel financeiro** reportado como mockado pelo usuário — a apurar; o código lê os endpoints
  reais (`getFinanceiroResumo`, `listLancamentos`, `getFluxoMensal`).

---

<!-- nenhuma tarefa deste plano executada ainda -->
