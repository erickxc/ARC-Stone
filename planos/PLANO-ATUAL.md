# Plano de execução — Tela do orçamento + kanban arrastável

Repositório: `C:\Users\bi_2d_gzgh6n0\Desktop\Yann\Pessoal\ARC-ERP`
Stack: FastAPI + PostgreSQL (`backend/`) · React 19 + TS + Vite (`frontend/`)
Base: `df20b64` · Árvore: **limpa**
Gerado em: 2026-08-05

Documento para o agente executor. São **6 tarefas**, executadas uma por vez, na ordem. Não
comece a tarefa N+1 antes da N estar verificada e o usuário mandar seguir.

**Leia `CLAUDE.md` na raiz antes de começar.** Convenções: código e comentários em português,
dinheiro em centavos inteiros, TypeScript com 2 espaços, componentes `PascalCase`. O
`planos/ESTADO.md` foi zerado — a numeração recomeça em 1.

**Este plano é 100% frontend.** Nenhum arquivo em `backend/` deve ser tocado. Todos os endpoints
necessários já existem.

---

## 0. Contexto e decisões

> Este bloco acompanha **toda** tarefa entregue, não só a primeira.

### O que se quer

Duas melhorias no fluxo de vendas:

1. **A tela do orçamento não existe.** Não há como clicar num orçamento e abri-lo. Hoje o card
   do kanban só oferece um `<select>` de status e um botão "Portal".
2. **O kanban deve ser arrastável**, para mover orçamento entre colunas sem usar o `<select>`.
3. **O envio do link ao cliente está escondido.** O usuário procurou e não achou — existe, mas
   atrás de um botão de texto rotulado "Portal" no rodapé do card.
4. **As comboboxes não seguem o design do app.** Renderizam com a cara padrão do navegador.

### Decisões já fechadas com o usuário

| Tema | Decisão |
|---|---|
| Forma da tela | **Rota própria `#orcamento/42`**, com itens, valores, status, histórico, anexos, decisão do cliente e ações de portal. Botão "Editar" leva ao Builder. |
| Arrastar | **Desktop e toque**, via Pointer Events. Não use HTML5 drag-and-drop: `dragstart` não existe em toque. |
| Envio do link | Vira **ação de primeira classe na tela de detalhe**, com rótulo que diz o que faz. Não é funcionalidade nova — é a mesma que já existe, tirada de onde ninguém acha. |
| Comboboxes | Alinhar `<select>` ao sistema de design existente, sem biblioteca e **sem trocar por componente customizado** — `<select>` nativo estilizado mantém teclado, leitor de tela e o seletor nativo do celular funcionando de graça. |
| Bibliotecas | **Nenhuma nova.** O projeto não usa framework de UI nem de DnD, e não vai passar a usar por causa disto. |

### Estado atual do código — verificado, não presuma nada além disto

- `frontend/src/App.tsx:159` — `Pipeline()`. O card é `<article className="quote-card">`, sem
  `onClick`. Tem um `<select>` de status e um botão "Portal".
- `App.tsx:200` — `moveQuote(card, status)` **já existe e funciona**: chama `updateQuoteStatus`,
  atualiza o estado local e, para `Aprovado`, abre o modal de CNPJ (`approveCard`,
  `confirmApproval`). **Reuse essa função inteira** — não escreva outra caminho de transição.
- `App.tsx:266` — `Builder()`. Tem `quoteId` no estado, mas ele **começa `null` e só é
  preenchido depois de salvar**. O Builder nunca carregou um orçamento existente.
- `App.tsx:226` — `QuotePortalModal` já carrega `getQuote(id)` e `listQuoteAttachments(id)`, e
  tem os botões de gerar/revogar link e o toggle de visibilidade de anexo.
- `App.tsx:8-9` — `Route` é uma união de literais e `routes` é o array correspondente.
- `App.tsx:1247` — **o roteamento lê `location.hash` uma única vez, no mount. Não há listener de
  `hashchange`.** Botão voltar/avançar do navegador já não funciona hoje.
- `App.tsx:1246` — `previewMode`: em DEV, `?preview=1` pula a autenticação. Útil na TAREFA 5.
- `frontend/src/api.ts:404` — `getQuote`; `:408` — `listQuoteAttachments`; `:424` —
  `updateQuoteStatus(id, status, cnpjFaturamento?)`. **Não existe** chamada de histórico.
- `backend/routers/orcamentos.py:465` — `GET /orcamentos/{id}/historico` existe e devolve
  `list[AuditLogOut]`. É o que alimenta o histórico da tela nova.
- `App.tsx:237` e `:257` — **o envio do link mágico já existe**, dentro de `QuotePortalModal`
  (`sendPortalLink`, `revokePortalLink`). Chega-se nele por um `<button className="text-action">`
  rotulado **"Portal"** no rodapé do card. Não é falta de funcionalidade: é falta de
  descobribilidade e de rótulo honesto.
- `frontend/src/index.css` — há **duas** regras globais `select{}` conflitantes (uma com
  `width:100%`, outra com `display:block;margin-top:6px`), e `select` **está de fora** de
  `button,input{font:inherit}` e de `.search:focus,input:focus`. Por isso a combobox aparece com
  a fonte padrão do navegador, sem anel de foco e com o widget nativo do sistema, destoando de
  todo o resto.
- `App.tsx:187` — `const cards = remoteQuotes === null ? quotes : …`. O `quotes` de `data.ts` é
  **fallback** para quando o backend não responde, não mock ativo. Não o remova neste plano.
- **Não há teste de frontend neste projeto** — sem `vitest`, sem script `test` no
  `package.json`. A verificação é `npm run build`, `npm run lint` e inspeção visual.

### Regra de Ouro desta entrega

> **Arrastar não pode inventar um caminho de transição paralelo ao que já existe.**

Toda mudança de status — por `<select>` ou por arrasto — passa por `moveQuote`. Ela é quem
conhece a regra de aprovação (modal de CNPJ) e o tratamento de erro. Se o arrasto escrever o
próprio `updateQuoteStatus`, um dia a regra muda num caminho e não no outro, e um orçamento é
aprovado sem CNPJ.

Corolário: **arrastar para "Aprovado" não move o card até o CNPJ ser confirmado.** Se o usuário
cancelar o modal, o card volta para a coluna de origem.

---

## TAREFA 1 — Roteamento com parâmetro e navegação de volta

**Arquivos que esta tarefa pode tocar:** `frontend/src/App.tsx`.

Hoje o roteamento não suporta parâmetro e não reage ao botão voltar. Antes de criar a tela nova,
arrume a base.

1. Represente a rota corrente como um objeto, não como string solta:

```tsx
type Rota = { nome: Route; id?: number }

function lerHash(): Rota {
  const bruto = location.hash.slice(1)
  const [nome, param] = bruto.split('/')
  if (nome === 'orcamento' && param && /^\d+$/.test(param)) {
    return { nome: 'orcamento', id: Number(param) }
  }
  return { nome: routes.includes(bruto as Route) ? (bruto as Route) : 'dashboard' }
}
```

2. Acrescente `'orcamento'` ao tipo `Route`. **Não** o acrescente ao array `routes` nem ao menu
   lateral — não é item de navegação, é destino de clique. Confira `IconName` (`App.tsx:11`) e
   qualquer `Record<Route, …>` que passe a exigir a chave nova; se um mapa exigir entrada para
   `'orcamento'`, prefira `Partial<Record<…>>` a inventar um ícone.

3. Escute `hashchange` e atualize o estado:

```tsx
useEffect(() => {
  const aoMudarHash = () => setRota(lerHash())
  window.addEventListener('hashchange', aoMudarHash)
  return () => window.removeEventListener('hashchange', aoMudarHash)
}, [])
```

Isso conserta o botão voltar para **todas** as rotas, não só a nova. É a razão de esta tarefa vir
primeiro: abrir a tela de detalhe sem poder voltar seria pior que não ter a tela.

4. `go(nome, id?)` passa a montar o hash com o parâmetro. Como o listener já reage ao
   `hashchange`, `go` pode simplesmente escrever `location.hash` — evite atualizar o estado nos
   dois lugares e criar duas fontes de verdade.

5. **Não remova** o `location.reload()` de `App.tsx:138` e `:53` sem verificar por quê existe;
   se com o listener novo ele ficou desnecessário, remova e diga no `ESTADO.md` que removeu.

**Não faça nesta tarefa:** nenhuma tela nova, nenhum arrasto.

**Verificação:** `npm run build` e `npm run lint` limpos. No navegador: navegar entre duas telas
pelo menu e voltar com o botão do navegador deve mudar a tela — comportamento que hoje não
existe. Se não puder abrir o navegador nesta tarefa, diga isso no campo Verificação.

---

## TAREFA 2 — Chamada de histórico na API

**Arquivos que esta tarefa pode tocar:** `frontend/src/api.ts`.

Acrescente a interface e a chamada do histórico, seguindo exatamente o padrão das funções
vizinhas (`getQuote`, `listQuoteAttachments`):

```tsx
export interface AuditLogEntry {
  id: number
  acao: string
  detalhes: string
  usuario_nome: string | null
  created_at: string
}

export function getQuoteHistory(id: number) {
  return request<AuditLogEntry[]>(`/orcamentos/${id}/historico`)
}
```

**Confirme os nomes dos campos** contra `schemas.AuditLogOut` no backend antes de escrever a
interface — não copie os nomes deste plano sem conferir. Um campo com nome errado aqui só
aparece em runtime, e o projeto não tem teste de frontend para pegar isso.

**Não faça nesta tarefa:** nada em `App.tsx`.

**Verificação:** `npm run build` (o `tsc` valida a interface) e `npm run lint`.

---

## TAREFA 3 — A tela de detalhe do orçamento

**Arquivos que esta tarefa pode tocar:** `frontend/src/App.tsx`, `frontend/src/index.css`.

Componente `QuoteDetail({ quoteId }: { quoteId: number })`, renderizado quando
`rota.nome === 'orcamento'`.

### Carregamento

`Promise.all([getQuote, listQuoteAttachments, getQuoteHistory])`, com o padrão de `mounted` já
usado em `Finance` (`App.tsx`) para não setar estado depois de desmontar. Estados: carregando ·
erro · carregado.

### Layout

Reuse as classes que já existem — `card`, `card-title`, `table-wrap`, `total-card`, `timeline`,
`badge`, `mono`, `person`. Não invente sistema de layout novo; se precisar de uma classe nova,
acrescente poucas linhas em `index.css` seguindo a paleta de `:root`. **Não introduza cor nova.**

- **`PageHead`** — eyebrow `ORC-0042 · <TIPO>`, título com o nome do cliente, e nas ações:
  `<select>` de status (mesma lista do kanban), **Editar**, **Gerar PDF**, **Portal**.
- **Coluna principal:** tabela de itens (descrição, quantidade, unitário, total) e, abaixo, o
  histórico em `.timeline` — ação, detalhes, autor e data, mais recente primeiro.
- **Aside:** `.total-card` com o total e os dados (cliente, vendedor, tipo, criado em); cartão de
  anexos com download e o toggle "Visível ao cliente"; e — quando `decisao_cliente` existir — o
  bloco destacado com a decisão, quem decidiu, a data e, na recusa, **o motivo em destaque**.

Valores vêm em **centavos inteiros**: formate com
`Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' })` sobre `valor / 100`.

### Ações

- **Status:** chame a mesma função de transição do kanban. Se ela estiver hoje dentro de
  `Pipeline`, **extraia-a** para o escopo do módulo de forma que as duas telas usem o mesmo
  código, incluindo o modal de CNPJ. Duplicar a regra de aprovação é exatamente o que a Regra de
  Ouro proíbe.
- **Editar:** navega para o Builder do orçamento. **Se o Builder ainda não souber carregar um
  orçamento existente** — e pela leitura de `App.tsx:266` ele não sabe —, **não implemente isso
  aqui**: deixe o botão desabilitado com `title` explicando, e registre em `ESTADO.md` no campo
  Dúvidas. Carregar orçamento no Builder é uma entrega própria, com decisões próprias sobre o que
  acontece ao editar um orçamento já aprovado.
### Enviar o link ao cliente — tem que ser óbvio

O usuário procurou essa função e não achou. Ela existe desde sempre em `QuotePortalModal`
(`App.tsx:237`), atrás de um botão de texto chamado **"Portal"** no rodapé do card — rótulo que
não diz o que a ação faz.

Nesta tela ela vira **ação de primeira classe**:

- Botão **"Enviar link ao cliente"** entre as ações do `PageHead`. O rótulo diz o que acontece;
  "Portal" não dizia.
- Depois de gerar, mostre a **URL completa com botão de copiar** — é assim que vai ser mandada
  por WhatsApp na prática, que é o caminho real na maioria das vezes.
- Mostre **para qual e-mail** foi enviado (`enviado_para`) e **até quando vale** (`expira_em`).
- Avise, em texto, que gerar um link novo **invalida o anterior** — o backend incrementa
  `portal_token_version` a cada envio (`orcamentos.py`), e o usuário precisa saber disso antes de
  clicar, não depois.
- Botão **"Revogar link"** ao lado, com confirmação.
- Quando o cliente não tiver e-mail cadastrado, o botão fica desabilitado com `title` explicando
  — o backend devolve 400 nesse caso e a mensagem crua não ajuda ninguém.

**Reuse `gerarPortalLink` / `revogarPortalLink` de `api.ts`.** Não escreva chamada nova.

**Portal / PDF:** o resto do que `QuotePortalModal` faz (download de anexo, toggle de
visibilidade) também cabe nesta tela. Se ficar mais limpo mover aquele conteúdo para cá, mova —
mas **mantenha o card do kanban funcionando**, ou avise no `ESTADO.md` que o botão saiu de lá e
por quê.

### Card do kanban clicável

No `Pipeline`, o `<article className="quote-card">` passa a navegar para `#orcamento/<id>` ao ser
clicado. Requisitos:

- **Não dispare navegação** quando o clique for no `<select>` de status ou no botão "Portal" —
  use `event.stopPropagation()` nesses controles.
- Torne o card alcançável por teclado: `role="button"`, `tabIndex={0}` e `Enter`/`Espaço`
  navegando. Um card que só responde a mouse deixa a tela nova inacessível pelo teclado.
- `cursor: pointer` no `.quote-card`.

**Não faça nesta tarefa:** arrastar.

**Verificação:** `npm run build` e `npm run lint` limpos; a tela abre com um orçamento real.

---

## TAREFA 4 — Arrastar cards entre colunas (mouse e toque)

**Arquivos que esta tarefa pode tocar:** `frontend/src/App.tsx`, `frontend/src/index.css`.

Use **Pointer Events**. Não use HTML5 drag-and-drop: `dragstart` não dispara em toque, e a
decisão do usuário foi explicitamente cobrir celular e tablet.

### O ponto difícil: o card agora é clicável E arrastável

O mesmo gesto começa igual nos dois casos. Resolva por **limiar de movimento**:

```
pointerdown          → guarda (x, y) e o id do card. Ainda NÃO é arrasto.
pointermove < 8px    → continua não sendo arrasto
pointermove >= 8px   → vira arrasto: marca o card, começa a seguir o ponteiro
pointerup sem arrasto→ é clique: navega para #orcamento/<id>
pointerup com arrasto→ solta na coluna sob o ponteiro
pointercancel        → aborta, card volta ao lugar
```

Sem o limiar, um clique com 1px de tremor vira arrasto e a tela nunca abre — ou o inverso, e o
usuário move o orçamento sem querer. **8px é o valor inicial; ajuste se ficar ruim no toque e
registre o valor final no `ESTADO.md`.**

### Detalhes que fazem funcionar

- **`setPointerCapture(event.pointerId)`** no `pointerdown`, para o card continuar recebendo
  eventos mesmo quando o ponteiro sai de cima dele. Libere no `pointerup`/`pointercancel`.
- **`touch-action: none`** no `.quote-card` (CSS). Sem isso, o navegador interpreta o gesto como
  rolagem e nunca entrega o `pointermove`.
- **Descobrir a coluna de destino:** `document.elementFromPoint(x, y)` e subir até o
  `.kanban-col` mais próximo com `closest()`. O elemento que segue o ponteiro precisa de
  `pointer-events: none`, senão `elementFromPoint` devolve o próprio card arrastado.
- **Retorno visual:** a coluna sob o ponteiro recebe uma classe de destaque; o card em arrasto
  fica semitransparente. Use `var(--brand)` para o destaque — a paleta em `:root` já tem o token.
- **Soltar fora de qualquer coluna** cancela, sem mudança de status.
- **Soltar na coluna de origem** não faz nada — não chame a API à toa.

### A transição

Ao soltar numa coluna diferente, chame **a mesma função de transição** usada pelo `<select>` e
pela tela de detalhe. Não escreva outra chamada a `updateQuoteStatus`.

- **Movimento otimista:** o card aparece na coluna nova imediatamente; se a API falhar, ele
  **volta** para a coluna de origem e o erro aparece. Não deixe o card num estado que o servidor
  não confirmou.
- **Aprovado é exceção:** abre o modal de CNPJ e o card **só se move depois da confirmação**. Se
  o usuário cancelar, volta para a origem. Aprovar também pode falhar por estoque insuficiente
  ou pendência de cadastro (`orcamentos.py:648-679`) — nesses casos a mensagem do backend precisa
  chegar ao usuário, não sumir.

### Não remova o `<select>`

Ele continua no card. É o caminho por teclado, o caminho de quem não consegue arrastar, e a rede
de segurança se o arrasto tiver algum problema em um dispositivo específico. Um kanban onde a
única forma de mover é arrastar é inacessível.

**Fora do escopo desta tarefa:** rolagem automática ao arrastar perto da borda da coluna, e
reordenação de cards dentro da mesma coluna. Se achar que fazem falta, anote em Dúvidas.

**Verificação:** `npm run build` e `npm run lint` limpos, e o teste manual da TAREFA 5.

---

## TAREFA 5 — Comboboxes alinhadas ao design

**Arquivos que esta tarefa pode tocar:** `frontend/src/index.css`, e `frontend/src/App.tsx`
somente se algum `<select>` precisar de classe nova.

### O que está errado hoje

O `<select>` ficou de fora do sistema de design. Três causas concretas:

1. `button,input{font:inherit}` **não inclui `select`** — por isso a combobox renderiza com a
   fonte padrão do navegador (~13px, Arial) enquanto o resto do app usa Outfit. É a diferença
   mais visível.
2. `.search:focus,input:focus` **não inclui `select`** — sem anel de foco, o único controle do
   app que não mostra onde o teclado está.
3. Sem `appearance:none`, o navegador desenha o widget nativo do sistema operacional, com seta e
   altura próprias.

Além disso há **duas regras globais `select{}` conflitantes** no arquivo, uma com `width:100%` e
outra com `display:block;margin-top:6px`. Consolide numa só.

### O que fazer

- Inclua `select` nas regras de `font:inherit` e de foco, junto de `input` e `button`.
- `appearance:none` (com `-webkit-appearance`/`-moz-appearance`) e uma seta própria via
  `background-image` com `data:` URI de SVG, ou um `::after` no rótulo que envolve. Deixe
  `padding-right` suficiente para o texto não passar por baixo da seta.
- Mesmo `height`, `border`, `border-radius`, `background` e `color` de `.search` e dos `input` —
  os tokens já estão em `:root`. **Não introduza cor nova.**
- Estado `:disabled` coerente com o resto, e `cursor:pointer`.
- Consolide as duas regras `select{}` em uma. Onde o `select` precisar de largura ou margem
  diferente (dentro de `.fields`, `.modal-form`, `.login`), faça pela regra do container, não
  por outra regra global.

### O `<select>` do card do kanban

Ele herda `width:100%;height:44px`, o que é enorme dentro de um `.quote-card`. Dê a ele um
tamanho compatível com o card — mas **não o remova nem o esconda**: depois da TAREFA 4 ele
continua sendo o caminho por teclado e a alternativa ao arrasto.

### Não troque por componente customizado

`<select>` nativo entrega de graça: navegação por teclado, busca por digitação, leitor de tela e
o seletor em roda do iOS/Android. Um dropdown customizado teria que reimplementar tudo isso, e
tipicamente reimplementa mal. Estilizar o nativo é a escolha certa aqui.

**Verificação:** `npm run build` e `npm run lint` limpos. Visualmente: abra uma tela com combobox
(Pipeline, Builder, Novo orçamento) e confirme que ela tem a mesma fonte, altura e borda dos
campos de texto ao lado, e anel de foco ao chegar por `Tab`. Confirme também no Firefox se
possível — `appearance` em `select` tem histórico de diferença entre navegadores.

---

## TAREFA 6 — Verificação visual ponta a ponta

**Arquivos que esta tarefa pode tocar:** nenhum. Se algo precisar mudar, **pare e reporte**.

Este projeto não tem teste de frontend. Build e lint provam que compila, **não** que funciona.
Duas telas inteiras deste plano nunca foram abertas por ninguém.

Suba o stack (`docker compose up -d` ou `.\dev.ps1`) e verifique, com um orçamento real:

| # | Passo | Esperado |
|---|---|---|
| 1 | Clicar num card do kanban | abre `#orcamento/<id>` com itens, total, histórico e anexos |
| 2 | Botão voltar do navegador | volta ao pipeline |
| 3 | Recarregar a página em `#orcamento/<id>` | a tela de detalhe abre direto |
| 4 | Clicar no `<select>` do card | muda o status, **sem** abrir a tela |
| 5 | Arrastar um card entre duas colunas (mouse) | move, e o status persiste após recarregar |
| 6 | Arrastar para "Aprovado" e **cancelar** o CNPJ | o card volta para a coluna de origem |
| 7 | Arrastar e soltar fora de qualquer coluna | nada acontece |
| 8 | Arrastar no toque (DevTools em modo dispositivo, ou tablet real) | move sem rolar a página |
| 9 | Clique curto no toque | abre a tela, não arrasta |
| 10 | `Tab` até o card e `Enter` | abre a tela |
| 11 | Na tela de detalhe, "Enviar link ao cliente" | gera, mostra a URL com botão de copiar, o e-mail de destino e o aviso de que o anterior foi invalidado |
| 12 | Abrir a URL gerada numa aba anônima | o portal do cliente carrega a proposta |
| 13 | Gerar o link de novo e abrir a URL antiga | o link antigo não funciona mais |
| 14 | Comboboxes em Pipeline, Builder e no modal de novo orçamento | mesma fonte, altura e borda dos campos de texto vizinhos |
| 15 | `Tab` até uma combobox | anel de foco visível, igual ao dos inputs |

Registre **cada item** com passou/falhou no `ESTADO.md`. Item não executado é "não executado",
nunca "passou".

Em DEV, `?preview=1` pula a autenticação (`App.tsx:1246`) — útil se o login atrapalhar, mas
prefira o fluxo real, porque o card depende de dados do backend.

---

## Fora de escopo — não faça

- **Qualquer alteração em `backend/`** — todos os endpoints já existem
- Fazer o Builder carregar um orçamento existente (entrega própria; ver TAREFA 3)
- Rolagem automática ao arrastar, e reordenar cards dentro da coluna
- Introduzir biblioteca de drag-and-drop, de UI ou de roteamento
- Redesenhar o kanban ou o card
- Corrigir `test_push_revisao_nova_cria_projeto_preservando_anterior`, que falha por isolamento
  de teste — pendência conhecida, decisão separada

---

## Resumo das mudanças

| Tipo | Alvo | Observação |
|---|---|---|
| Roteamento | `App.tsx:1247` | rota com parâmetro + listener de `hashchange` (conserta o botão voltar em todas as telas) |
| API | `api.ts` | `getQuoteHistory` + `AuditLogEntry` |
| Tela nova | `QuoteDetail` | `#orcamento/42` — itens, histórico, anexos, decisão, ações |
| Interação | `.quote-card` | clicável (mouse e teclado) e arrastável (mouse e toque) |
| Descobribilidade | `QuoteDetail` | "Enviar link ao cliente" vira ação de primeira classe, com URL copiável |
| CSS | `index.css` | estados de arrasto e destino, `touch-action`, `cursor`, e `<select>` no sistema de design |
| Verificação | 15 passos manuais | única prova de que funciona |

---

## Quando parar e reportar em vez de improvisar

- Precisar tocar arquivo que não está na lista da tarefa — **em especial qualquer coisa em `backend/`**
- Descobrir que o plano contradiz o código real
- Um teste existente quebrar por causa da sua mudança
- Duas formas razoáveis de fazer e o plano não decidir qual
- **O limiar de 8px se mostrar ruim no toque** — ajuste e registre; se nenhum valor funcionar, pare
- **Não conseguir abrir o navegador na TAREFA 5** — pare e reporte; não dê o plano por concluído
  com build e lint apenas

Nesses casos: **pare, escreva o que encontrou em `planos/ESTADO.md`, e não continue.**

---

## Ao concluir cada tarefa

1. **Commit único**, mensagem `plano(N): <o que foi feito>`, seguindo Conventional Commits.
2. **Acrescente ao FIM de `planos/ESTADO.md`** (ao fim mesmo — o bloco anterior foi inserido no
   meio do arquivo e passou despercebido pela vigia do orquestrador):

```
## TAREFA N — concluída em AAAA-MM-DD HH:MM
Commit: <sha>
Arquivos: <lista>
Verificação: <o que rodou e o resultado, incluindo o que NÃO deu para rodar>
Desvios: <o que fez diferente do plano, e por quê — ou "nenhum">
Dúvidas: <o que ficou incerto — ou "nenhuma">
```

3. **Não comece a tarefa N+1** sem o usuário mandar.
