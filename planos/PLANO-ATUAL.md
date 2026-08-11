# Plano de execução — Marmoraria: cliente, itens, pagamento e configurações

Repositório: `c:\projects\ARC-Stone` · Base: `9fa6e73`
Stack: FastAPI + PostgreSQL (`backend/`) · React 19 + TS + Vite (`frontend/`)
Gerado em: 2026-08-11

Documento para o agente executor. **11 tarefas**, uma por vez, na ordem. Não comece a tarefa N+1
antes da N estar verificada e o usuário mandar seguir.

**Leia `CLAUDE.md` na raiz antes de começar.** Código e comentários em português, dinheiro em
centavos inteiros, TypeScript com 2 espaços, componentes `PascalCase`, Conventional Commits.

---

## 0. Contexto e decisões

> Este bloco acompanha **toda** tarefa entregue, não só a primeira.

### Por que esta entrega existe

O ARC Stone nasceu como fork de um ERP de arquitetura/interiores. O fluxo de orçamento herdado
não descreve como uma marmoraria vende: não há medidas (m²) por item, o pagamento é uma string
solta pedida antes de existir orçamento, "local de instalação" é texto livre, serviço é uma linha
única sem composição, e não há distinção entre vender no balcão e mandar proposta para aprovação.
Esta entrega reescreve esse núcleo.

### Decisões fechadas com o usuário

| Tema | Decisão |
|---|---|
| Tipo de orçamento | `Obra` \| `Peça` \| `Projeto` \| `Externo`. Substitui `Venda`/`Locacao`/`Producao`. Obra e Projeto aceitam produto **e** serviço; Peça só produto; Externo só produto com `is_externo`. |
| **Locação** | **Descartada por completo.** Marmoraria não aluga. Remover o tipo, a renovação, `prazo_locacao_*` e `data_fim_locacao` da UI. |
| Modalidade | Campo **novo e ortogonal** a tipo: `venda_direta` \| `orcamento_formal`. Venda direta = pagamento no Builder e venda fechada na hora. Formal = sem pagamento no Builder, vai ao portal do cliente, pagamento só na conversão em venda. |
| Pagamento | Dois catálogos: `TipoPagamento` (Cartão, Dinheiro, Crediário, Cheque, Pix) e `FormaPagamento` (Crédito/Débito, **só** sob Cartão). Mais `CondicaoPagamento` (parcelamento), que já existe. Cascata Tipo→Forma→Condição. |
| Serviço composto | `Servico` ganha `ServicoComponente` (nome, obrigatório/opcional, unidade, preço). Cada componente incluído vira **uma linha própria** no orçamento. Sem hierarquia pai/filho. |
| Medidas | `comprimento_m` × `largura_m` = `area_m2`, **calculado no backend**. |
| Fórmula da linha | `m2` → `area_m2 × preço`; `linear` → `comprimento_m × preço`; `un` → `quantidade × preço`. Depois `+ acréscimo − desconto`. A `unidade_medida` do produto/componente decide. |
| Desconto | **Por linha e global.** Acréscimo/desconto por item, mais um desconto de fechamento no total do orçamento. |
| Cliente | PF (Nome+Sobrenome+CPF) e PJ (Razão social+CNPJ), com seletor. Endereço estruturado, Carteira, Indicado por, Profissional, criado/editado por. |
| Configurações | CRUD genérico com ordem/ativo/`built_in` para 5 catálogos. Item padrão do sistema não se exclui — só desativa e reordena. |
| Portal do cliente | **Já existe e funciona** (`QuotePortalModal`, `Portal({token})`, `gerarPortalLink`). Reusar, não reescrever. |

### Contradições resolvidas (decisões de engenharia, derivadas do acima)

1. **Gate de aprovação.** `atualizar_status` (`orcamentos.py:799`) hoje recusa ir a `Aprovado` sem
   `condicoes_pagamento_selecionadas`. Isso conflita com Orçamento Formal, onde o pagamento só é
   coletado na conversão. → **Remover essa pendência.** O pagamento passa a ser exigido na criação
   da `Venda`, que é onde ele de fato importa.
2. **Onde mora o pagamento.** Em **`Venda`**, não em `Orcamento`. Pagamento só é definitivo quando
   há venda — nas duas modalidades. Em `Orcamento` seriam 3 colunas nulas durante todo o ciclo.
3. **Atomicidade da venda direta.** Salvar → aprovar → converter são 3 chamadas com efeito
   colateral cada (lançamento financeiro, baixa de estoque). Falha no meio deixa estoque baixado
   sem venda. → **Um endpoint atômico** `POST /orcamentos/{id}/finalizar-venda`.
4. **`nome_fantasia`.** É lido em ~12 lugares (PDF, portal, kanban). Vira **derivado**: o router o
   calcula de `nome+sobrenome` (PF) ou `razao_social` (PJ). Sai do `ClientInput`.
5. **Catálogo inativo em registro antigo.** FK apontando para item desativado faz o `Combobox`
   renderizar placeholder e perder o dado no próximo save. → Backend devolve o `*_nome` junto; o
   frontend injeta a opção histórica marcada "inativo".
6. **Venda direta no funil.** Não pode poluir kanban/dashboard. → `Pipeline` e `Dashboard` filtram
   `modalidade !== 'venda_direta'`; venda direta vive em Histórico de vendas.
7. **Editar orçamento já faturado.** O Builder hoje abre qualquer status. Com venda direta isso
   permitiria alterar preço de venda já faturada. → Builder recusa carregar (somente leitura +
   "Duplicar como novo") quando há `Venda` associada ou status ∈ {Aprovado, Entregue, Faturado,
   Devolvido}.
8. **CEP.** O CSP (`main.py:69`, `connect-src 'self'`) bloqueia ViaCEP no navegador. → Proxy no
   backend usando o `ssrf_utils.py` que já existe.

### Regra de Ouro

> **O backend é a única fonte de verdade de dinheiro e medida.**

`area_m2`, o total de cada linha e o total do orçamento são **calculados no backend** e devolvidos
prontos. O frontend calcula só a prévia enquanto o usuário digita, e substitui pelo valor do
servidor após salvar. Divergência de centavo entre tela e PDF é reclamação de cliente.

Corolário: o gating de tipo no frontend é conveniência. A regra real vive em `schemas.py`.

---

## Sequência

Backend e frontend são separados. **TAREFA 1 é o contrato** e trava as duas frentes.

| # | Entrega | Frente |
|---|---|---|
| 1 | Contrato: schemas Pydantic + tipos de `api.ts`, sem implementação | ambas |
| 2 | Catálogos: models, mixin, helper de router, seeds | back |
| 3 | Cliente PF/PJ + auditoria de autoria + proxy de CEP | back |
| 4 | `ServicoComponente` | back |
| 5 | `OrcamentoItem`: medidas, local, acréscimo/desconto, código | back |
| 6 | Modalidade, tipo novo, remoção de locação, `finalizar-venda` atômico | back |
| 7 | `CatalogoConfiguravel` + rota Configurações do orçamento | front |
| 8 | `ClienteFormulario` PF/PJ (criação + edição) | front |
| 9 | `TabelaItensOrcamento` (medidas, m², seleção múltipla, `−`) | front |
| 10 | Modalidade + gating + `ModalItemServico` + pagamento + envio ao cliente | front |
| 11 | Verificação visual ponta a ponta | — |

Tarefas 2-6 podem correr em paralelo com 7-10 depois que a 1 estiver fechada.

---

## TAREFA 1 — Contrato

**Arquivos:** `backend/schemas.py`, `frontend/src/api.ts`.

Só tipos e assinaturas. Nenhum endpoint implementado, nenhum componente alterado. Existe para que
as duas frentes não divirjam.

**Backend** — schemas novos: `TipoPagamentoCreate/Update/Out`, `FormaPagamento*`, `LocalCreate/*`,
`MotivoPerdaAvaria*`, `ServicoComponente*`, `VendaPagamentoIn`, `ReordenarIn`. Alterar:
`ClienteCreate/Out` (PF/PJ, endereço, autoria), `OrcamentoItemCreate/Out` (medidas, local_id,
acréscimo/desconto, `total_centavos`, `tipo_item` derivado), `OrcamentoCreate/Out` (modalidade,
tipo novo, desconto global), `VendaOut` (3 FKs + nomes expandidos).

Cada catálogo tem `Create`/`Update`/`Out` **próprios** — não herde de uma base Pydantic
compartilhada. A reutilização fica no helper de router, não no schema; base comum acopla catálogos
que vão divergir.

**Frontend** — espelhar em `api.ts`: `ItemCatalogo`, `TipoPagamento` (com `exige_forma`),
`FormaPagamento`, `Local`, `MotivoPerda`, `ServicoComponente`, `Modalidade`. Alterar `QuoteItem`
(incluindo `local_nome` e `total_centavos` vindos do servidor), `Quote`, `QuoteCreateInput`,
`Client`, `ClientInput`.

**Verificação:** `pytest backend/tests` e `npm run build` limpos. Nada muda de comportamento.

---

## TAREFA 2 — Catálogos configuráveis

**Arquivos:** `backend/models.py`, `backend/main.py`, `backend/routers/` (arquivo novo).

`CatalogoSimplesMixin` com `nome`, `ativo`, `ordem`, `built_in`. Tabelas novas: `TipoPagamento`
(+`exige_forma`), `FormaPagamento` (+`tipo_pagamento_id`), `Local`, `MotivoPerdaAvaria`. Alterar
`CondicaoPagamento` para ganhar `ordem` e `built_in`.

`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` em `on_startup()`, seguindo o padrão de `main.py:187-227`.

Helper `criar_router_catalogo_simples(model, schemas, prefixo)` gerando por catálogo:

| Método | Rota | Nota |
|---|---|---|
| GET | `/{catalogo}` | ordenado por `ordem`; `?ativos=true` opcional |
| POST | `/{catalogo}` | `ordem = max+1`, `built_in=False` sempre |
| PATCH | `/{catalogo}/{id}` | só `nome` e `ativo` |
| PATCH | `/{catalogo}/reordenar` | recebe lista de ids na ordem nova |
| DELETE | `/{catalogo}/{id}` | **400 se `built_in`** |

`GET /formas-pagamento?tipo_pagamento_id=` para a cascata.

Seeds em `on_startup()` **só se a tabela estiver vazia** (padrão do admin em `main.py:236`), todos
`built_in=True`: Tipos = Cartão (`exige_forma=True`), Dinheiro, Crediário, Cheque, Pix; Formas =
Crédito, Débito sob Cartão; Motivos = os 6 slugs hoje em `schemas.py:627`.

`PerdaAvaria.motivo` **continua String** — não vire FK. Trocar o tipo de uma coluna já usada em
filtros é risco fora do escopo; o catálogo alimenta o seletor, o valor gravado segue texto.

**Verificação:** `pytest`. Testes novos: 400 ao excluir `built_in`, reordenação persiste, seed não
duplica em segundo start.

---

## TAREFA 3 — Cliente PF/PJ

**Arquivos:** `backend/models.py`, `backend/main.py`, `backend/routers/clientes.py`, `schemas.py`.

Colunas novas em `clientes`: `tipo_pessoa` (default `'juridica'`), `nome`, `sobrenome`,
`razao_social`, `telefone_secundario`, `cep`, `numero`, `complemento`, `bairro`, `cidade`,
`estado` (2), `carteira`, `indicado_por`, `profissional_tipo`, `criado_por_id`, `editado_por_id`,
`editado_em`. `contato` continua sendo o telefone principal — não duplique.

`nome_fantasia` **permanece NOT NULL** e vira derivado, calculado no router no create e no update.
Não use trigger. É o único ponto de escrita, e ~12 leitores dependem dele.

Validação em `ClienteCreate`: PF exige `nome`+`sobrenome`+`cpf_cnpj`; PJ exige `razao_social`+`cpf_cnpj`.

`criado_por_id` só no create, nunca editável. `editado_por_id`/`editado_em` em toda edição.

`GET /clientes/cep/{cep}` — proxy usando `ssrf_utils.py`. Falha devolve 200 com corpo vazio ou 404
tratável; **nunca** bloqueia o cadastro.

`endereco_entrega`/`endereco_faturamento` (texto livre) ficam como estão — os campos estruturados
são aditivos. Mexer neles arrasta PDF e portal.

**Atenção:** `backend/tests/test_clientes.py` envia `nome_fantasia` direto e vai quebrar. Atualizar
os testes faz parte desta tarefa.

**Verificação:** `pytest`. Testes: PF sem sobrenome → 422; PJ sem razão social → 422;
`nome_fantasia` derivado corretamente nos dois; `editado_por_id` preenchido no update.

---

## TAREFA 4 — Componentes de serviço

**Arquivos:** `backend/models.py`, `schemas.py`, `backend/routers/servicos.py`, `main.py`.

`ServicoComponente`: `servico_id`, `nome`, `obrigatorio`, `unidade_medida` (`m2`|`linear`|`un`),
`preco_unitario` (centavos), `ativo`, `ordem`.

`Servico.preco_padrao` permanece, mas passa a ser informativo quando há componentes — o preço real
vem da soma dos componentes efetivamente incluídos. Serviço sem componentes segue como hoje.

Rotas: POST/PATCH/DELETE `/servicos/{id}/componentes[/{componente_id}]`. `ServicoOut` ganha
`componentes`.

**Verificação:** `pytest` com CRUD de componente e serialização aninhada.

---

## TAREFA 5 — Itens do orçamento

**Arquivos:** `backend/models.py`, `schemas.py`, `backend/routers/orcamentos.py`, `main.py`.

Colunas em `orcamento_itens`: `codigo_item` (**nullable**, backfill no startup — sem default por
linha), `local_id` FK, `comprimento_m`/`largura_m`/`area_m2` (`Numeric(10,2)`),
`acrescimo_centavos`/`desconto_centavos` (default 0), `servico_componente_id` FK,
`unidade_medida` (copiada do produto/componente na inserção — **congela** junto com o preço).

`local_instalacao` fica como legado nullable. Exibição: `local.nome` se houver, senão o texto.

Centralizar em `_processar_itens_orcamento(itens, orcamento_id, db)`: hidratar prazo (a lógica de
`_hidratar_prazo_servico` entra aqui), gerar `codigo_item` sequencial, calcular
`area_m2 = comprimento_m × largura_m`, expandir componentes de serviço em N linhas, e computar o
total de cada linha.

Fórmula, a documentar em comentário no código:

```
base = area_m2        × preco_unitario_aplicado   se unidade_medida == 'm2'
     = comprimento_m  × preco_unitario_aplicado   se unidade_medida == 'linear'
     = quantidade     × preco_unitario_aplicado   se unidade_medida == 'un'
total_linha = base + acrescimo_centavos - desconto_centavos
```

Arredondar **uma vez**, no total da linha, para centavo inteiro (half-up). Não arredonde a área.

`Orcamento` ganha `desconto_global_centavos` (default 0). Total do orçamento = soma das linhas −
desconto global. `OrcamentoItemOut` devolve `total_centavos` e `tipo_item` derivado.

`codigo_item` e `area_m2` **não entram** em `OrcamentoItemCreate` — o backend gera e ignora o que
vier. `updateQuote` é PUT de substituição total (`api.ts:571`); sem isso o frontend apagaria campos
calculados a cada edição.

**Verificação:** `pytest` cobrindo as 3 fórmulas, acréscimo/desconto, desconto global, `area_m2`
calculada e sequência de `codigo_item`.

---

## TAREFA 6 — Modalidade, tipo novo e venda atômica

Tarefa mais arriscada: toca aprovação, estoque e financeiro. Só depois de 2-5 verificadas.

**Arquivos:** `backend/models.py`, `schemas.py`, `backend/routers/orcamentos.py`, `main.py`,
`backend/pdf_generator.py`, `backend/routers/portal.py`.

`Orcamento.modalidade` (default `'orcamento_formal'`). `Venda` ganha `tipo_pagamento_id`,
`forma_pagamento_id`, `condicao_pagamento_id`.

`tipo_orcamento` vira `Literal["Obra","Peça","Projeto","Externo"]`. Validação: Peça e Externo
rejeitam `servico_id`; Externo exige `is_externo` em todo item.

**Remover locação:** o tipo, a rota de renovação, `prazo_locacao_valor/unidade`,
`data_fim_locacao` dos schemas e do PDF/portal. As colunas podem ficar no banco (inertes); o
código para de lê-las. Registrar em `ESTADO.md` o que ficou órfão.

**Remover** a pendência "Definir o método de pagamento" de `atualizar_status:799` (contradição 1).

Extrair `_gerar_lancamento_financeiro_venda(...)` de dentro de `atualizar_status` — hoje o
lançamento nasce acoplado à transição de status, e agora três caminhos precisam dele.

`POST /orcamentos/{id}/finalizar-venda` — **atômico, uma transação**: valida pré-condições, aprova,
baixa estoque, gera lançamento, cria `Venda` com o pagamento. Idempotente: se já existe `Venda`,
devolve a existente em vez de 400.

`POST /orcamentos/{id}/converter-venda` ganha body `VendaPagamentoIn` (hoje não recebe nada).
Forma obrigatória quando o Tipo tem `exige_forma` — validação no router, precisa consultar o banco.

Venda direta nasce com `status='Aprovado'`, pulando o funil, e é excluída do Pipeline por
`modalidade`.

**Verificação:** `pytest`. Testes: venda direta cria Orçamento+Venda numa transação; falha no meio
não deixa estoque baixado; `finalizar-venda` duas vezes não duplica; Peça com serviço → 422;
formal continua indo ao portal sem pagamento.

---

## TAREFA 7 — CRUD genérico de configurações

**Arquivos:** `frontend/src/App.tsx`, `api.ts`, `index.css`.

Rota nova `orcamentoConfig` (`Route`, `routes`, `iconPaths`, `navGroups` em Configurações, acima de
Integrações). `IconName` é `Exclude<Route,'orcamento'>` — esquecer o ícone quebra o build, o que é
bom.

`CatalogoConfiguravel<T>` + hook `useCatalogo<T>`. Props: `titulo`, `descricao` (diz **onde** o item
aparece para o usuário final), `acoes` (listar/criar/atualizar/reordenar/excluir), `placeholderNovo`,
e no máximo `colunasExtras` e `camposCriacao`. **Dois pontos de extensão, não mais** — um terceiro
significa que não é o mesmo componente.

Visual: reusa `.card.list-card`, `DataTable` e `.condicao-nova` (o CSS de "input + adicionar" já
existe). Colunas: ORDEM (`↑`/`↓`) · NOME (+ `Badge` "Padrão do sistema" se `built_in`) · STATUS
(`Toggle`) · AÇÕES (Renomear, `HoldButton` Excluir).

`built_in` → botão excluir **`disabled` com `title`**, não escondido. Botão ausente parece bug;
botão que só devolve 400 é desrespeito.

**Reordenação por `↑`/`↓`, não drag-and-drop.** São listas de 4-15 itens editadas raramente por
admin. Botões dão teclado e leitor de tela de graça — e um DnD acessível precisaria de `↑`/`↓` como
alternativa de qualquer forma. Troca otimista local + PATCH com a lista inteira, debounce ~400ms,
reverte em erro. `aria-label` específico ("Mover «Cartão» para cima").

Abas via `.segmented` no `PageHead`: Pagamento (os 3 catálogos) · Locais · Perdas e avarias ·
Textos da proposta. Estado local, **não** estenda o roteador — `lerHash` só aceita `/\d+/`.

Mover `CoMarca`, `CondicoesPagamento` e `ResetConfiguracao` de `Integrations` para cá. Migrar
`Losses` para consumir o catálogo em vez do mapa estático `motivoPerdaLabel` (`App.tsx:1649`).

**Verificação:** `npm run build`, `npm run lint`. Criar, renomear, desativar, reordenar e tentar
excluir um item padrão.

---

## TAREFA 8 — Formulário de cliente PF/PJ

**Arquivos:** `frontend/src/App.tsx`, `api.ts`, `overlays.css`.

`ClienteFormulario` com prop `modo: 'criacao' | 'edicao'`, usado nos dois fluxos.

- **Criação (`Drawer`):** 5 campos — tipo, nome/razão, documento, telefone, e-mail. O resto atrás de
  "Completar cadastro". 20 campos em coluna única de 420px destrói o cadastro rápido no balcão.
- **Edição (`Drawer`):** tudo, em `<fieldset>` com `<legend className="mono">`: IDENTIFICAÇÃO ·
  CONTATO · ENDEREÇO · RELACIONAMENTO.

`.segmented` para PF/PJ. Trocar o tipo **não apaga** o que foi digitado no outro (guarde os dois no
estado, envie só o ativo). Rótulo do documento muda com o tipo.

CPF/CNPJ: máscara na digitação, validação de dígito no `onBlur` como aviso **não bloqueante**
(`aria-invalid` + `<small>`). Existe cadastro provisório e cliente estrangeiro; o backend decide.

CEP: consulta no `onBlur` via proxy da TAREFA 3, preenche bairro/cidade/estado **editáveis**, falha
silenciosa.

`criado_por`/`editado_por` nunca no formulário — vão no `dl` de `ClientDetail` (`App.tsx:851`).
`updateClient` já existe em `api.ts:652`, só não está importado.

`Clients`: ação "Editar" na `DataTable`, antes de "Excluir". `ClientDetail`: botão "Editar" no
`PageHead`. Não adicione colunas à lista — já tem 6.

**Verificação:** `npm run build`, `npm run lint`. Criar PF e PJ, editar, confirmar que o nome
exibido bate nas duas telas.

---

## TAREFA 9 — Tabela de itens

**Arquivos:** `frontend/src/App.tsx`, `index.css`.

`TabelaItensOrcamento` própria — **não** reuse `DataTable`: ela usa índice como `key`
(`App.tsx:1235`), e com célula editável isso faz o React reaproveitar o DOM da linha errada (foco
salta, valor aparece na linha vizinha). Reuse o CSS de `.table-wrap`.

10 colunas: ☐ · ITEM (`<b>` descrição + `<small className="mono">` cód · tipo) · LOCAL (Combobox) ·
#QTD · #COMP. (m) · #LARG. (m) · #M² (read-only) · #ACRÉSC. · #DESC. · #TOTAL (read-only) · `−`.

Código e Tipo viram sublinha em vez de colunas próprias: 13 colunas dariam ~1400px contra ~1090px
disponíveis em 1366px, forçando scroll horizontal permanente numa tela de digitação. Cabeçalho
numérico com prefixo `#` herda alinhamento à direita e `tabular-nums`.

Comportamento por `unidade_medida`:

| unidade | Comp. | Larg. | m² | preço |
|---|---|---|---|---|
| `m2` | editável, obrigatório | editável, obrigatório | calculado | R$/m² |
| `linear` | editável, obrigatório | desabilitado | desabilitado | R$/m |
| `un` | desabilitado | desabilitado | desabilitado | R$/un |

Célula inaplicável mostra `—` em `var(--ink3)` com `title`, **nunca** input vazio (convida a digitar)
nem célula em branco (parece bug). Nunca esconder — quebra o alinhamento.

Entrada decimal: `type="text" inputMode="decimal"` + normalizar vírgula no `onBlur`. `type="number"`
com pt-BR rejeita `1,20` em parte dos navegadores. Validar **ao salvar**, não a cada tecla.

`−` vermelho remove **na hora**, sem `confirm()`, com `Feedback` + **"Desfazer"** (guardar a linha e
o índice num `useRef`). Diálogo por remoção é insuportável numa tabela de digitação; perder 6 campos
medidos por um clique errado é caro. Requer prop `acao?` no `Feedback` (`App.tsx:1281`).

Seleção múltipla: checkbox nativo, header com `indeterminate` via `ref`. A barra de ações aparece
**no lugar do cabeçalho** do card (onde ficam os botões de adicionar), não flutuando — sem layout
shift. `HoldButton` "Remover selecionados" se justifica aqui: dano proporcional a N.

Linha expandida (padrão `.item-detalhe` existente) para campos de item externo e prazo.

Responsivo `@media(max-width:900px)`: tabela vira **lista de cartões**, não scroll lateral. Digitar
medida com scroll horizontal no tablet do balcão é inviável. ~40 linhas de CSS — orce isso.

**Verificação:** `npm run build`, `npm run lint`. Adicionar item, medir, conferir m² e total contra
o backend após salvar, remover e desfazer, seleção múltipla.

---

## TAREFA 10 — Modalidade, gating, serviço e pagamento

**Arquivos:** `frontend/src/App.tsx`, `api.ts`, `index.css`.

**Identificação** (card do topo, 3 colunas): Cliente · Modalidade · Tipo. Pagamento sai daqui.

Modalidade em `.segmented`, não Combobox: duas opções que mudam a tela inteira precisam estar
visíveis. Default `orcamento_formal` — é o caminho reversível; escolher venda direta por engano
aprova e fatura uma proposta que o cliente não viu. `<small>` embaixo explicando a consequência de
cada uma.

Cliente ganha `onCreate` (prop já existe no `Combobox`, `App.tsx:151`, nunca usada): digitar nome
inexistente oferece "+ Criar «Fulano»". Mandar o vendedor sair da tela com o cliente no balcão é o
principal ponto de abandono.

Gating por tipo — botão bloqueado fica **visível e `disabled` com `title`**, nunca some:

| tipo | Catálogo | Item livre | Serviço | Importar projeto |
|---|---|---|---|---|
| Obra / Projeto | ✔ | ✔ | ✔ | ✔ |
| Peça | ✔ | ✔ | — | — |
| Externo | — | ✔ | — | — |

**Trocar o tipo nunca apaga item já adicionado.** Marque os incompatíveis com `Badge` de aviso e
ofereça "Remover os N incompatíveis". Apagar dado do usuário como efeito colateral de um combobox
é inaceitável.

`ModalItemServico` (quarto botão "+ Serviço"): Combobox de serviço + Local, depois a lista de
componentes. Obrigatórios com checkbox `checked disabled` + `Badge`; opcionais livres. Inputs de
medida só no componente marcado, conforme a unidade dele. Subtotal por componente e total no rodapé
— sem isso o vendedor marca opcional no escuro. Serviço sem componentes degrada para o formulário
simples. Preço congela na adição.

Resultado: **uma linha por componente**, `descricao = "{Serviço} · {Componente}"`. Sem hierarquia
visual — o `OrcamentoItem`, o PDF e o portal são planos; agrupar só no frontend vira mentira no
primeiro reload.

**Pagamento** — último card da coluna principal, **só quando `venda_direta`**. Cascata
Tipo→Forma→Condição; Forma só **renderiza** quando `exige_forma` (campo permanentemente desabilitado
é ruído). Trocar Tipo limpa Forma e Condição. Rodapé com total repetido + CTA "Finalizar venda" — o
`aside` já saiu do campo de visão depois de 8 itens. CTA primário mora aqui; o `PageHead` fica só
com "Salvar rascunho".

Pré-voo **antes** de salvar: sem CNPJ configurado ou cliente `pendente` → banner com link e CTA
desabilitado. Descobrir isso no último clique, com o orçamento já salvo, é o pior momento possível.

Finalização chama o endpoint atômico da TAREFA 6. Estado `'idle'|'salvando'|'concluido'|'erro'`.
Sucesso → `location.hash = 'orcamento/{id}'`, não permanecer no Builder.

**Orçamento formal** — CTA "Enviar ao cliente" na mesma posição. Salva, transiciona para
`Orçamento gerado` (**só** se estiver em `Gerando orçamento`/`Planejando` — não sobrescreva
`Ajuste solicitado`, que é estado causado pelo cliente) e abre o `QuotePortalModal` existente sem
modificá-lo.

**Não gere o link automaticamente ao salvar:** `POST /portal-link` invalida o anterior. Reabrir o
orçamento para corrigir uma vírgula quebraria o link que o cliente tem aberto no celular.

Sem e-mail no cliente → CTA desabilitado com o texto de `motivoSemPortal` (`App.tsx:637`, alargar o
parâmetro para `{status, cliente_email}`) e atalho "Adicionar e-mail".

Ainda nesta tarefa: `Pipeline`/`Dashboard` filtram venda direta (contradição 6); Builder recusa
carregar orçamento com venda (contradição 7); `beforeunload` com alterações não salvas — 10 linhas
que evitam perder 20 minutos de digitação.

**Verificação:** `npm run build`, `npm run lint`, e a TAREFA 11.

---

## TAREFA 11 — Verificação visual ponta a ponta

**Arquivos:** nenhum. Se algo precisar mudar, **pare e reporte.**

Não há teste de frontend. Build e lint provam que compila, não que funciona.

| # | Passo | Esperado |
|---|---|---|
| 1 | Cadastrar cliente PF e PJ | nome exibido correto na lista e no detalhe |
| 2 | Editar cliente | "editado por" aparece no detalhe |
| 3 | CEP válido no cadastro | bairro/cidade/estado preenchem, editáveis |
| 4 | Criar catálogo, reordenar, desativar | ordem persiste após recarregar |
| 5 | Excluir item padrão do sistema | botão desabilitado com explicação |
| 6 | Orçamento Obra + serviço com componentes | uma linha por componente, preços somados |
| 7 | Item m²: comp 2,5 × larg 0,6 | m² = 1,50 e total = 1,50 × preço |
| 8 | Item linear e item unidade | células de medida inaplicáveis mostram `—` |
| 9 | Acréscimo, desconto por linha e desconto global | total confere com o backend após salvar |
| 10 | Tipo Peça e tentar adicionar serviço | botão desabilitado com motivo |
| 11 | Trocar tipo com itens incompatíveis | avisa, não apaga |
| 12 | Remover linha e "Desfazer" | linha volta com os valores |
| 13 | Seleção múltipla e remover selecionados | remove só as marcadas |
| 14 | Venda direta completa | Orçamento + Venda criados, aparece em Histórico de vendas |
| 15 | Venda direta no Pipeline | **não** aparece no kanban |
| 16 | Reabrir orçamento já convertido em venda | somente leitura, com explicação |
| 17 | Orçamento formal → Enviar ao cliente | portal abre em aba anônima e aprova |
| 18 | Converter aprovado em venda | pede pagamento e registra |
| 19 | Tabela de itens em 800px de largura | vira cartões, sem scroll horizontal |
| 20 | Tema claro e escuro nas telas novas | sem contraste quebrado |

Registre **cada item** com passou/falhou em `ESTADO.md`. Item não executado é "não executado",
nunca "passou".

---

## Fora de escopo

- Locação e renovação — **removidas**, não reimplementar
- Limite de desconto por perfil de usuário (dívida registrada: desconto livre sem teto é vazamento
  de margem conhecido em CPQ; resolver com `role` + override auditado numa entrega própria)
- Rascunho em `localStorage` no Builder (`beforeunload` cobre o v1)
- Migrar `PerdaAvaria.motivo` para FK
- Split de `App.tsx` em módulos — recomendado (2.569 linhas + ~1.200 desta entrega), mas é entrega
  própria, puro movimento, commit isolado. **Não replique o estilo de linha única do `Builder` no
  código novo.**
- Esteira de produção — não existe no repositório nem nos planos; escopo a definir

---

## Quando parar e reportar

- Precisar tocar arquivo fora da lista da tarefa
- O plano contradizer o código real
- Teste existente quebrar sem ser um dos previstos (TAREFA 3)
- Duas formas razoáveis e o plano não decidir
- Cálculo de total divergir entre frontend e backend

Nesses casos: **pare, escreva em `planos/ESTADO.md`, não continue.**

---

## Ao concluir cada tarefa

1. Commit único, `plano(N): <o que foi feito>`.
2. Acrescente **ao fim** de `planos/ESTADO.md`:

```
## TAREFA N — concluida em AAAA-MM-DD HH:MM
Commit: <sha>
Arquivos: <lista>
Verificacao: <o que rodou e o resultado, incluindo o que NAO deu para rodar>
Desvios: <o que fez diferente do plano, e por que — ou "nenhum">
Duvidas: <o que ficou incerto — ou "nenhuma">
```

3. **Não comece a tarefa N+1** sem o usuário mandar.
