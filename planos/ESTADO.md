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

---

## ARC Stone — reorganizacao do orcamento de marmoraria (2026-08-11)

Plano: `planos/PLANO-ATUAL.md`. Executado em tres commits, com verificacao no navegador
contra o backend real a cada bloco.

## TAREFAS 2-3 (catalogos + cliente PF/PJ) — concluida em 2026-08-11
Commit: 8af4cf0
Arquivos: backend/models.py, backend/schemas.py, backend/main.py,
  backend/routers/catalogos.py (novo), backend/routers/clientes.py,
  backend/tests/test_catalogos.py (novo), backend/tests/test_clientes.py,
  frontend/src/App.tsx, frontend/src/index.css, .gitignore
Verificacao: pytest 143 passam. Migracoes e seeds aplicados no banco de dev. CEP real
  testado (01001000 -> Praca da Se/SP). Build e lint do frontend limpos.
Desvios: nenhum em relacao ao plano.
Duvidas: nenhuma.

## TAREFAS 4-6 (medidas, servico composto, modalidade) — concluida em 2026-08-11
Commit: 99bd2ef
Arquivos: backend/models.py, backend/schemas.py, backend/main.py,
  backend/routers/orcamentos.py, backend/routers/servicos.py,
  backend/tests/test_marmoraria.py (novo), demais testes migrados para o vocabulario novo
Verificacao: pytest 158 passam. Unica falha e
  `test_push_revisao_nova_cria_projeto_preservando_anterior`, pendencia conhecida de
  isolamento de teste — confirmada como anterior a esta entrega via `git stash`.
Desvios: `PerdaAvaria.motivo` mantido como String (catalogo alimenta o seletor, mas a
  coluna nao virou FK) — trocar o tipo de uma coluna usada em filtros e risco fora do
  escopo. Registrado no plano como decisao consciente.
Duvidas: nenhuma.

## TAREFAS 7-10 (frontend) — concluida em 2026-08-11
Commit: 3b347fa (+ ajuste de alinhamento da tabela)
Arquivos: frontend/src/App.tsx, frontend/src/api.ts, frontend/src/index.css
Verificacao no navegador (Chrome headless, backend + Vite reais):
  - Sidebar: dois <nav>, grupos fixos ancorados acima do card de usuario. OK
  - Configuracoes do orcamento: 4 abas, 7 itens built_in com badge e Excluir
    desabilitado, 10 botoes de ordem. Reordenacao persistiu apos reload. OK
  - Formula do total, ponta a ponta: m2 2,5x0,6 a R$300/m2 = R$450; linear 3,2 m a
    R$80/m = R$256; unidade 3x R$120 = R$360; menos R$50 de desconto global = R$1.016.
    Backend devolveu exatamente 101600. OK
  - Cartao sem forma -> 400 com mensagem clara. Peca com servico -> 422. OK
  - Venda direta cria Orcamento (status Aprovado) + Venda numa transacao. OK
  - Checkout so aparece em venda direta e some ao voltar para orcamento formal. OK
  - Formulario de cliente PF: Nome, Sobrenome, CPF, Telefone, E-mail. OK
Desvios: dois defeitos visuais encontrados no screenshot e corrigidos antes de fechar —
  a coluna TOTAL ficava cortada (o checkbox de selecao somou uma coluna ao grid sem o
  cabecalho acompanhar) e o combobox de Tipo mostrava "Selecionar..." porque
  `tipoOrcamentoOptions` ainda listava Venda/Locacao/Producao.
Duvidas: a verificacao de tema claro e de responsivo em 800px (itens 19-20 do plano)
  nao foi executada.

### Nao executado / proximos passos
- Itens 19-20 da verificacao do plano (responsivo em 800px, tema claro nas telas novas).
- Limite de desconto por perfil de usuario: divida consciente registrada no plano —
  desconto livre sem teto e vazamento de margem conhecido em CPQ.
- Split de `App.tsx` (hoje ~3.000 linhas) em modulos: entrega propria, puro movimento.
- "Esteira de producao": nao existe no repositorio nem no plano; escopo a definir.
- `CLAUDE.md` referencia `planos/CHECKLIST-reorganizacao-nav-tema.md`, que nao existe.
