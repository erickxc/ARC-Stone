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

## Varredura de segurança e refatoração — concluída em 2026-08-11

Auditoria do diff `9fa6e73..HEAD` por leitura de código (dois revisores independentes) e
por **sonda de exploração real** contra a API rodando.

### Corrigido — segurança / integridade

| Sev. | Problema | Correção |
|---|---|---|
| ALTO | Venda direta gravava `status="Aprovado"` sem passar pela máquina de aprovação: não retinha estoque, não validava a whitelist de CNPJ e não gerava o título a receber. Vendia peça inexistente. | Efeitos colaterais extraídos em `_reter_estoque`, `_validar_cnpj_faturamento` e `_gerar_lancamento_financeiro`, chamados nos dois caminhos. `OrcamentoCreate` ganhou `cnpj_faturamento_venda`. |
| ALTO | Total divergia entre tela e PDF/portal/financeiro: só `_enrich_orcamento` usava a fórmula por unidade; os demais seguiam `quantidade × preço`, errando todo item em m²/linear e ignorando descontos. O cliente assinava um documento com valor diferente do cobrado. | `_valor_total_orcamento` virou fonte única; PDF recebe `total_centavos` pronto; portal e financeiro chamam `calcular_total_linha`. |
| ALTO | `/orcamentos/condicoes-pagamento` continuou vivo duplicando `/catalogos/`, e tinha divergido: **permitia excluir item `built_in`** que o router novo recusa, e criava com `ordem=0`. | 4 rotas removidas; testes migrados; teste novo garante que não voltem. |
| MÉDIO | Preço e quantidade negativos aceitos → total negativo virava crédito no ledger e em `Venda.valor_total`. (Pré-existente, amplificado pelos campos novos.) | `quantidade: gt=0`, `preco_unitario_aplicado: ge=0`. |
| MÉDIO | Desconto de linha e de fechamento sem teto → total negativo. (Introduzido nesta entrega.) | Validadores `validar_desconto_nao_excede_linha` e `validar_desconto_global`. Total zero continua válido (cortesia). |
| MÉDIO | `PUT /orcamentos/{id}` reescrevia orçamento já aprovado/vendido: apagava os itens sem estornar a retenção de estoque e fazia a Venda divergir da origem. | Recusa quando o status está em `STATUS_FECHADOS` ou já existe `Venda`. |
| MÉDIO | Schema de saída herdava validador de entrada (`ClienteOut(ClienteCreate)`, `OrcamentoItemOut(OrcamentoItemCreate)`). Apertar uma regra de entrada derrubava a **leitura** de dado legado: `GET /orcamentos/` inteiro respondia 500 por causa de uma linha antiga. Reproduzido em runtime. | Saídas declaradas sem constraints nem validadores. |
| BAIXO | `POST /catalogos/motivos-perda` estourava 500: o helper genérico não preenchia `slug` (NOT NULL/unique). | Parâmetro `derivar` no helper + `_slug()`. |
| BAIXO | `_validar_pagamento` aceitava tipo/forma/condição **desativados** pelo admin. | Filtro `ativo=True` nas três consultas. |

**Auditado e correto** (sem alteração): RBAC das 24 rotas de catálogo e das de componente
de serviço; isolamento por vendedor (IDOR) em cliente, orçamento, venda e componente;
SSRF do proxy de CEP (host literal, `assert_public_http_url`, timeout, sem redirect);
mass assignment (`built_in`, `id`, `usuario_id`, `area_m2`, `codigo_item` não vêm do
payload); `PortalItemOut` sem vazamento de custo; frontend sem XSS.

### Corrigido — refatoração

- Código morto: `DashboardLegacy`, `ProfileLegacy`, `StatusBars`, `BuilderItem.unit`
  (escrito em 5 lugares, lido em nenhum) e o campo "Unidade" do modal de item livre que
  só o alimentava; CSS `.renovacao-campos`, `.profit-card` duplicado e a regra
  `content:attr(data-rotulo)` cujo atributo nunca foi emitido; comentários órfãos.
- Restos de locação: ramos inalcançáveis em `calendario.py` (eventos de fim de
  locação/produção) e em `pdf_generator.py` (prazo de locação).
- `Pipeline.abrirNovo` resetava `novoTipo` para `'Venda'`, valor que não existe mais.
- N+1: `_enrich_orcamento` passou a ler `servico`, `servico_componente` e `local` de cada
  item, mas as queries não pré-carregavam — ~500 queries extras num kanban de 40
  orçamentos. `joinedload` adicionado nos 4 pontos.
- `AuditLog` nos catálogos: era o único router de escrita sem rastro, num módulo cujo
  propósito é justamente proteger histórico.
- Arredondamento: `_processar_itens_orcamento` usava `round()` (banker's rounding) e
  divergia do `toFixed(2)` do frontend em valores terminados em 5 → trocado por
  `ROUND_HALF_UP`. O docstring de `calcular_total_linha` prometia uma garantia que a
  pipeline não dava (a área já chega quantizada por `Numeric(10,2)`) — corrigido.
- `FormasPagamentoConfig` exibia "nada cadastrado" durante o fetch → `Skeleton`.
- `codigoItem()` → `referenciaCatalogo()`: colidia com `OrcamentoItem.codigo_item`, que é
  outra coisa (sequencial da linha).

Testes novos: `backend/tests/test_seguranca_orcamento.py` (10 regressões). Suíte: 169
passam; a única falha segue sendo `test_push_revisao_nova...`, pendência pré-existente.

### Achados registrados, NÃO corrigidos (fora do escopo)

- **Frete de R$ 250,00 hardcoded em todo PDF**, rotulado "Frete RJ Capital"
  (`pdf_generator.py:348`) — herança do ARC-ERP (negócio no Rio). O cliente assina um
  total com R$ 250 que ninguém escolheu. Pré-existente; precisa virar configuração.
- Limite de desconto por perfil de usuário (dívida já registrada).
- Foto e endereço em `localStorage` sem chave por usuário: persistem entre contas no
  mesmo dispositivo (`App.tsx`, Meu Perfil). Privacidade, não segurança.
- Duplicação restante: `atualizar_forma_pagamento`/`excluir_forma_pagamento` são cópia do
  helper genérico (~35 linhas); `NOME_CATALOGO` não tem variante opcional e o pattern se
  repete nos 5 `*Update`; o Builder mantém estado de pagamento paralelo ao da
  `CascataPagamento`, causando duas requisições ao mesmo endpoint no mount.
