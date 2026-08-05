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

## TAREFA 1 — concluida em 2026-08-05 12:24
Commit: 9e8da9b
Arquivos: frontend/src/App.tsx
Verificacao: `npm run build` e `npm run lint` passaram. A inspeção de código confirmou rota `orcamento/<id>`, leitura de hash parametrizado, listener de `hashchange` e `go(nome, id?)`.
Desvios: verificação manual no navegador não executada nesta tarefa; será coberta na verificação visual ponta a ponta.
Duvidas: nenhuma

## TAREFA 5 — concluida em 2026-08-05 12:41
Commit: 7d91794
Arquivos: frontend/src/index.css
Verificacao: `npm run build` e `npm run lint` passaram. Selects nativos agora usam a tipografia do app, seta visual, `appearance`, foco visível, estados disabled, cursor e dimensões compactas no card do kanban.
Desvios: confirmação visual em Firefox/dispositivos ficou reservada para a TAREFA 6.
Duvidas: nenhuma

## TAREFA 4 — concluida em 2026-08-05 12:39
Commit: f0457f4
Arquivos: frontend/src/App.tsx, frontend/src/index.css
Verificacao: `npm run build` e `npm run lint` passaram. Arrasto usa Pointer Events, limiar de 8px, `setPointerCapture`, `elementFromPoint`, `pointer-events:none` durante arrasto, destaque da coluna, cancelamento fora do alvo e rollback quando a API falha. Aprovação mantém o modal de CNPJ compartilhado.
Desvios: teste manual de mouse/toque ficou reservado para a TAREFA 6.
Duvidas: nenhuma

## TAREFA 3 — concluida em 2026-08-05 12:37
Commit: 2f39bf5
Arquivos: frontend/src/App.tsx, frontend/src/index.css
Verificacao: `npm run build` e `npm run lint` passaram. Implementados carregamento paralelo de orçamento/anexos/histórico, layout responsivo, decisão, anexos, PDF, portal, histórico mais recente primeiro, card clicável e acessível por teclado, além de status compartilhado com o kanban. Builder existente permanece desabilitado com explicação.
Desvios: inspeção manual com orçamento real ficou reservada para a TAREFA 6; nenhum arquivo backend foi tocado.
Duvidas: nenhuma

## TAREFA 2 — concluida em 2026-08-05 12:25
Commit: 29f56d8
Arquivos: frontend/src/api.ts
Verificacao: contrato conferido em `backend/schemas.py`: `AuditLogOut` fornece `id`, `acao`, `detalhes`, `usuario_nome` e `created_at`; `npm run build` e `npm run lint` passaram.
Desvios: nenhum
Duvidas: nenhuma
