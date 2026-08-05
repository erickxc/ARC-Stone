# Plano de execução — Portal do Cliente (aprovação de proposta)

Repositório: `C:\Users\bi_2d_gzgh6n0\Desktop\Yann\Pessoal\ARC-ERP`
Stack: FastAPI + PostgreSQL (`backend/`) · React 19 + TS + Vite (`frontend/`)
Base: `f5526b2` · Árvore no momento do plano: **suja — 25 arquivos** (trabalho anterior do
executor sobre Med-Stone/`projetos/push` + segurança, ainda não commitado)
Gerado em: 2026-08-05

> **Atenção à árvore suja.** As 25 alterações pendentes **não fazem parte deste plano**. Não as
> commite junto, não as reverta, não as "arrume". Se possível, o usuário deve commitá-las ou
> guardá-las (`git stash`) antes da TAREFA 1 — isso torna a validação deste plano inequívoca.

Documento para o agente executor. São **8 tarefas**, executadas uma por vez, na ordem. Não
comece a tarefa N+1 antes da N estar verificada e o usuário mandar seguir.

**Leia `CLAUDE.md` na raiz antes de começar.** Convenções que valem aqui: código e comentários
em português, dinheiro sempre em centavos inteiros, sem ferramenta de migração (coluna nova
exige `ALTER TABLE` manual no startup), commits em Conventional Commits.

---

## 0. Contexto e decisões

> Este bloco acompanha **toda** tarefa entregue, não só a primeira.

### O que se quer

O cliente final recebe um link, abre uma página **fora do ERP**, vê o andamento e os valores da
proposta dele, baixa os documentos que o arquiteto liberou, e **aprova** ou **recusa com
motivo**. A recusa volta para o arquiteto dentro do ERP.

### Decisões já fechadas com o usuário

| Tema | Decisão |
|---|---|
| Acesso do cliente | **Link mágico por orçamento.** JWT `type="portal"`, sem conta, sem senha, escopo travado num único orçamento. |
| Quem é "o arquiteto" | **`orcamento.vendedor_id`** — usuário real do ERP. Notificação in-app (audit log + card no funil) e e-mail via SendGrid. |
| Efeito da recusa | Novo status **`"Ajuste solicitado"`**. `"Orçamento negado"` continua reservado para perda definitiva (decisão interna). |
| Documentos | Download **no escopo**, com liberação item a item pelo arquiteto (opt-in). |

### Estado atual do código — verificado, não presuma nada além disto

- `frontend/src/App.tsx:1018` — `Portal()` existe, é 100% mock hardcoded (valores, datas e
  nomes chumbados), e só é alcançável **depois** do login do ERP, porque `App.tsx:1109` devolve
  `<Login/>` antes de qualquer rota. Vai ser reescrito do zero.
- `backend/routers/orcamentos.py:644` — a lista real de status é
  `["Gerando orçamento", "Planejando", "Orçamento gerado", "Orçamento negado", "Aprovado", "Entregue", "Devolvido", "Faturado"]`.
  O comentário em `backend/models.py:115` está **errado/desatualizado** (diz "Gerado"/"Negado",
  que não existem). Corrija esse comentário de passagem.
- `backend/routers/orcamentos.py:634` — `atualizar_status` retém estoque com `with_for_update()`,
  cria/cancela `LancamentoFinanceiro`, exige CNPJ da whitelist configurada e levanta `400`
  quando há pendências (cadastro do cliente incompleto, condição de pagamento ausente).
- `backend/models.py:192` — `AuditLog.usuario_id` é **nullable**. Use `None` para ações do cliente.
- `backend/models.py:122-123` — `arquiteto_nome` / `arquiteto_contato` são texto livre sem
  validação. **Não** são o destinatário da notificação nesta entrega.
- `backend/auth.py:18` — `ACCESS_TOKEN_EXPIRE_MINUTES`; `auth.py:23-26` — os `TOKEN_TYPE_*`;
  `auth.py:47` — `decode_token(token, expected_types)`.
- `backend/auth.py:158-182` — SendGrid já integrado, com fallback que imprime `[MOCK EMAIL]`
  quando não há API key. Reuse esse mesmo padrão; **não** adicione outra biblioteca de e-mail.
- `models.Usuario.reset_token_version` é o padrão de revogação de token já usado no projeto.
  Copie a ideia.
- `backend/anexo_utils.py:84` — `anexo_disk_path()` já resolve o caminho com `os.path.basename`,
  o que neutraliza path traversal. `ANEXO_PRIVATE_DIR = uploads_private/anexos`.
- `backend/main.py` **não** monta `StaticFiles`: todo arquivo sai por endpoint que valida
  credencial. Mantenha essa propriedade.
- `orcamentos.py:501` — o campo `url` do anexo é reescrito na resposta para a rota de download
  autenticada; o caminho de disco nunca vaza para o cliente HTTP. Mantenha isso no portal.

### Regra de Ouro desta entrega

> **A aprovação do cliente não movimenta estoque nem financeiro.**

O cliente registra uma *intenção*. Quem executa a transição para `"Aprovado"` continua sendo o
vendedor dentro do ERP, porque só ele escolhe o CNPJ de faturamento e só ele resolve "estoque
insuficiente". Se o portal chamasse `atualizar_status`, o cliente receberia mensagens internas
como *"Estoque insuficiente para aprovar: 'Poltrona X' tem 2 unidades disponíveis"* — vazamento
de dado operacional e uma experiência quebrada por um erro que ele não pode corrigir.

```
Orçamento gerado ──cliente aprova──→ Orçamento gerado + decisao_cliente='aprovado'
                                          │
                                          └─ vendedor confirma no ERP (CNPJ + estoque) → Aprovado

Orçamento gerado ──cliente recusa──→ Ajuste solicitado + motivo
                                          │
                                          └─ arquiteto edita e reenvia → Orçamento gerado
```

### Modelo de ameaça do portal

O `/portal` é a **primeira superfície não autenticada do projeto** além do login. Trate cada
resposta como pública. Três suposições que devem guiar o código:

1. **O link vaza.** Vai por e-mail, é encaminhado, cai em caixa compartilhada de escritório de
   arquitetura. Por isso: escopo de um único orçamento, expiração, e revogação em um clique.
2. **O token vira log.** Por isso ele viaja no **fragmento** da URL e depois em header — nunca
   em query string nem em path. Detalhe na Tarefa 2.
3. **Tudo que a resposta contém é público.** Lista branca explícita de campos, nunca
   reaproveitamento de `OrcamentoDetailOut`.

---

## TAREFA 1 — Modelo, migração e novo status

**Arquivos que esta tarefa pode tocar:** `backend/models.py`, `backend/main.py`,
`backend/routers/orcamentos.py`. **Precisar de outro = pare e reporte.**

1. Em `models.py`, classe `Orcamento`, adicione:

```python
    # Portal do cliente — link mágico e decisão registrada pelo cliente final
    portal_token_version = Column(Integer, nullable=False, default=0, server_default="0")
    decisao_cliente = Column(String, nullable=True)          # 'aprovado' | 'recusado' | None
    decisao_cliente_motivo = Column(String, nullable=True)   # obrigatório quando recusado
    decisao_cliente_nome = Column(String, nullable=True)     # nome digitado por quem decidiu
    decisao_cliente_em = Column(DateTime(timezone=True), nullable=True)
```

2. Em `models.py`, classe `OrcamentoAnexo`, adicione:

```python
    # Liberação individual para o portal do cliente. Default False de propósito: o balde de
    # anexos mistura documento do cliente com nota de fornecedor e memorial interno, então a
    # visibilidade é opt-in — anexo existente nunca passa a ser visível por uma migração.
    visivel_cliente = Column(Boolean, nullable=False, default=False, server_default="false")
```

3. Corrija o comentário do campo `status` do `Orcamento` para a lista real de 8 status,
   acrescida de `"Ajuste solicitado"`.

4. Em `main.py::on_startup()`, junto dos outros `ALTER`:

```python
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS portal_token_version INTEGER NOT NULL DEFAULT 0"))
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS decisao_cliente VARCHAR"))
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS decisao_cliente_motivo VARCHAR"))
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS decisao_cliente_nome VARCHAR"))
        conn.execute(text("ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS decisao_cliente_em TIMESTAMPTZ"))
        conn.execute(text("ALTER TABLE orcamento_anexos ADD COLUMN IF NOT EXISTS visivel_cliente BOOLEAN NOT NULL DEFAULT FALSE"))
```

O `DEFAULT FALSE` na coluna de anexo não é detalhe de estilo: é o que garante que nenhum anexo
já existente no banco fique visível ao cliente no momento do deploy.

5. Em `orcamentos.py:644`, adicione `"Ajuste solicitado"` a `status_permitidos`.

**Não faça nesta tarefa:** nenhum endpoint novo, nenhuma mudança de frontend.

**Verificação:** a app sobe; rode o startup duas vezes seguidas e confirme que os `ALTER` são
idempotentes; `SELECT visivel_cliente FROM orcamento_anexos` devolve `false` para as linhas
pré-existentes.

---

## TAREFA 2 — Token do portal em `auth.py`

**Arquivos que esta tarefa pode tocar:** `backend/auth.py`, `.env.example`,
`backend/tests/test_portal_token.py` (novo).

1. `TOKEN_TYPE_PORTAL = "portal"` junto dos outros tipos.

2. `PORTAL_TOKEN_EXPIRE_DAYS = int(os.getenv("PORTAL_TOKEN_EXPIRE_DAYS", "30"))` — documente a
   variável em `.env.example`.

3. `create_portal_token(orcamento) -> str` — JWT com:
   - `type: "portal"`
   - `orcamento_id: int`
   - `ver: orcamento.portal_token_version`
   - `exp` conforme `PORTAL_TOKEN_EXPIRE_DAYS`
   - **Sem `sub`, sem e-mail, sem nome, sem valor.** O token vai por e-mail e pode ser
     encaminhado; um JWT é apenas base64, qualquer um lê o payload. Não carregue PII nele.

4. Dependência `get_portal_orcamento(request, db) -> models.Orcamento`:
   - Lê o token do header **`X-Portal-Token`**. Não aceite query string, não aceite cookie.
   - `decode_token(raw, expected_types={TOKEN_TYPE_PORTAL})`.
   - Carrega o orçamento por `orcamento_id` e **compara `payload["ver"] == orcamento.portal_token_version`**.
     Diferente → 401. É isso que faz a revogação funcionar sem tabela de blacklist.
   - Qualquer falha — token ausente, expirado, malformado, tipo errado, versão velha, orçamento
     inexistente — levanta **exatamente o mesmo** `HTTPException(401, "Link inválido ou expirado.")`.
     Nunca diferencie os casos: diferenciar transforma o endpoint num oráculo de enumeração.

### Por que header, e não query string

O link enviado ao cliente usa **fragmento de URL**: `https://app/#portal/<token>`. O fragmento
nunca é transmitido ao servidor, então o token não aparece no `access.log` do Nginx, não vaza em
cabeçalho `Referer` para terceiros, e não passa por proxy intermediário. O frontend lê o
fragmento, limpa a barra de endereço e envia o token em header a cada chamada.

Se o token for para o path (`/portal/abc123`) ou para a query (`?token=abc123`), ele vai para o
log de acesso em texto puro e sobrevive lá por meses. Não faça isso.

**Verificação:** `backend/tests/test_portal_token.py` — teste unitário puro, sem banco, cobrindo:
token gerado decodifica com o `orcamento_id` e `ver` corretos; token `type="access"` é rejeitado
por `expected_types`; token expirado é rejeitado. Roda com
`python -m pytest backend/tests/test_portal_token.py -q` mesmo sem Docker.

---

## TAREFA 3 — Router público `/portal`: proposta e decisão

**Arquivos que esta tarefa pode tocar:** `backend/routers/portal.py` (novo), `backend/schemas.py`,
`backend/main.py`.

### Schemas (`schemas.py`)

Listas brancas explícitas. **Não** reaproveite `OrcamentoItemOut` nem `OrcamentoDetailOut` —
esses schemas vão crescer no futuro e qualquer campo novo vazaria automaticamente para fora da
empresa. Um schema separado faz o vazamento exigir uma edição deliberada.

`PortalItemOut`:
```
nome, descricao, quantidade, preco_unitario (centavos), subtotal (centavos),
local_instalacao, prazo_entrega_valor, prazo_entrega_unidade, foto_url
```

`PortalDocumentoOut`:
```
id, nome_original, extensao, tamanho, created_at
```

`PortalPropostaOut`:
```
orcamento_id, numero_exibicao, tipo_orcamento, status_publico, cliente_nome,
itens: list[PortalItemOut], valor_total (centavos), condicoes_pagamento (texto formatado),
documentos: list[PortalDocumentoOut], tem_pdf_proposta: bool,
data_entrega, arquiteto_nome, arquiteto_contato,
decisao_cliente, decisao_cliente_motivo, decisao_cliente_em, criado_em
```

`PortalDecisaoIn`:
```python
acao: Literal["aprovar", "recusar"]
motivo: Optional[str] = Field(None, max_length=2000)
nome: str = Field(..., min_length=2, max_length=200)
```
Com `model_validator` exigindo `motivo` com **>= 10 caracteres quando `acao == "recusar"`**. Um
motivo vazio ou "não gostei" derrota o propósito inteiro da tela — o arquiteto precisa saber o
que mudar.

### O que a resposta NUNCA pode conter

Esta é a parte mais importante da tarefa:

- `preco_custo`, margem, ou qualquer valor derivado do custo
- `vendedor_id`, `usuario_id`, e-mail/telefone/role do vendedor
- `cnpj_faturamento`, ou `condicoes_pagamento_selecionadas` cru (formate para texto legível)
- `fornecedor_externo` dos itens — é informação de suprimento, não do cliente
- qualquer `AuditLog`, qualquer outro orçamento do mesmo cliente, qualquer caminho de disco
- anexos com `visivel_cliente = False`

`status_publico` é um **mapa**, não o status cru — o cliente não precisa saber que existe um
kanban interno, e "Orçamento negado" dito assim para o cliente é constrangedor:

```python
STATUS_PUBLICO = {
    "Gerando orçamento": "Em elaboração",
    "Planejando":        "Em elaboração",
    "Orçamento gerado":  "Aguardando sua aprovação",
    "Ajuste solicitado": "Ajuste solicitado por você",
    "Aprovado":          "Aprovada — produção liberada",
    "Entregue":          "Entregue",
    "Faturado":          "Concluída",
    "Devolvido":         "Encerrada",
    "Orçamento negado":  "Encerrada",
}
```

### Endpoints

```python
router = APIRouter(prefix="/portal", tags=["Portal do Cliente"])

@router.get("/proposta", response_model=schemas.PortalPropostaOut)
@limiter.limit("30/minute")
def obter_proposta(request: Request,
                   orcamento: models.Orcamento = Depends(auth.get_portal_orcamento),
                   db: Session = Depends(get_db)): ...

@router.post("/decisao", response_model=schemas.PortalPropostaOut)
@limiter.limit("5/minute")
def registrar_decisao(request: Request, payload: schemas.PortalDecisaoIn, ...): ...
```

Regras de `registrar_decisao`:

1. Se `orcamento.status` não estiver em `("Orçamento gerado", "Ajuste solicitado")` → `409`
   `"Esta proposta não está aberta para decisão."`
2. Se `orcamento.decisao_cliente` já estiver preenchido → `409`
   `"Uma decisão já foi registrada para esta proposta."` Idempotência: duplo clique, aba
   recarregada ou link reencaminhado não podem gerar dois registros nem sobrescrever o motivo.
3. `aprovar` → grava `decisao_cliente='aprovado'`, `decisao_cliente_nome`, `decisao_cliente_em`.
   **Não mexe em `status`.** Não toca estoque, não cria `LancamentoFinanceiro`, não chama
   `atualizar_status`. Veja a Regra de Ouro.
4. `recusar` → grava `decisao_cliente='recusado'` + motivo + nome + timestamp, e muda `status`
   para `"Ajuste solicitado"` **por atribuição direta**. Essa transição parte de
   `"Orçamento gerado"`, que não é status de retenção nem financeiro, portanto não há efeito
   colateral a executar. **Deixe um comentário no código dizendo exatamente isso**, para que
   ninguém "melhore" depois trocando por uma chamada a `atualizar_status` e arraste junto a
   validação de CNPJ e a trava de estoque.
5. Sempre grava `AuditLog` com `usuario_id=None`, `vendedor_id=orcamento.vendedor_id`,
   `acao="DECISAO_CLIENTE"`, detalhes com a ação e o nome de quem decidiu, e
   `ip=request.headers.get("X-Real-IP") or (request.client.host if request.client else None)`.
   É isso que faz a decisão aparecer em `GET /orcamentos/{id}/historico`, que já existe.
6. Notifica o `vendedor.email` reusando o helper SendGrid de `auth.py:158`. Falha de e-mail
   **não pode derrubar a requisição** — envolva em `try/except` e registre, como o projeto já
   faz com a geração de PDF (`orcamentos.py:248`). O registro no banco é a fonte da verdade; o
   e-mail é conveniência.

Registre o router em `main.py` junto dos demais.

### Atenção — interação com um bug já existente

`backend/rate_limiter.py:16` hoje aceita qualquer `X-API-Key` **não validado** como chave do
balde de rate limit. Enquanto isso não for corrigido, o `5/minute` do `/portal/decisao` é
contornável mandando um `X-API-Key` aleatório por requisição. Esse bug é anterior a este plano e
será tratado em separado — **não tente consertá-lo aqui**, mas não trate o rate limit como
defesa suficiente: as travas reais são a expiração do token, o `ver`, e a checagem de
idempotência do item 2.

---

## TAREFA 4 — Geração e revogação do link (lado ERP)

**Arquivos que esta tarefa pode tocar:** `backend/routers/orcamentos.py`, `backend/schemas.py`.

```python
@router.post("/{orcamento_id}/portal-link", response_model=schemas.PortalLinkOut)
@router.post("/{orcamento_id}/portal-link/revogar", status_code=204)
```

- **Autorização:** reuse `_get_orcamento_autorizado` (`orcamentos.py:22`) — admin ou vendedor dono.
- Gerar exige `orcamento.status` em `("Orçamento gerado", "Ajuste solicitado")` → senão `400`
  `"Gere o orçamento antes de enviar ao cliente."`
- Gerar exige `cliente.email` preenchido → senão `400` explicando que falta e-mail no cadastro
  do cliente.
- **Gerar sempre incrementa `portal_token_version` antes de emitir.** Reenviar o link invalida
  automaticamente o anterior. Se o e-mail do cliente foi comprometido, reenviar já resolve, sem
  precisar de um botão separado.
- Envia e-mail com a URL `{FRONTEND_URL}/#portal/{token}` e devolve **a mesma URL no corpo da
  resposta**, para o vendedor copiar e mandar por WhatsApp — que é como isso vai acontecer na
  prática na maioria das vezes.
- Revogar apenas incrementa `portal_token_version`.
- `AuditLog` nos dois casos (`acao="ENVIOU_PORTAL"` / `"REVOGOU_PORTAL"`), com `usuario_id` do
  usuário logado.

`PortalLinkOut`: `url: str`, `expira_em: datetime`, `enviado_para: str` (o e-mail do cliente).

---

## TAREFA 5 — Documentos: liberação e download pelo portal

**Arquivos que esta tarefa pode tocar:** `backend/routers/orcamentos.py`,
`backend/routers/portal.py`, `backend/schemas.py`.

Duas metades: o arquiteto libera, o cliente baixa.

### 5a. Liberação (lado ERP)

```python
@router.patch("/{orcamento_id}/anexos/{anexo_id}/visibilidade", response_model=schemas.OrcamentoAnexoOut)
```

Body: `{"visivel_cliente": bool}`. Autorização por `_get_orcamento_autorizado`. `AuditLog` com
`acao="ALTEROU_VISIBILIDADE_ANEXO"` — quem liberou qual documento para fora da empresa é
exatamente o tipo de coisa que se precisa saber depois.

Acrescente `visivel_cliente` ao `OrcamentoAnexoOut` para o ERP renderizar o estado do toggle.

### 5b. Download (lado portal)

```python
@router.get("/anexos/{anexo_id}/download")
@limiter.limit("60/minute")
def baixar_anexo(anexo_id: int, request: Request,
                 orcamento = Depends(auth.get_portal_orcamento),
                 db: Session = Depends(get_db)): ...

@router.get("/proposta/pdf")
@limiter.limit("60/minute")
def baixar_pdf_proposta(...): ...
```

Regras — todas obrigatórias:

1. **Dupla checagem.** O anexo só é servido se `anexo.orcamento_id == orcamento.id`
   **e** `anexo.visivel_cliente is True`. A primeira condição impede que um token válido de um
   orçamento baixe anexo de outro; a segunda é a liberação do arquiteto. As duas juntas, sempre
   — nunca confie só no `anexo_id` vindo da URL.
2. **404 genérico para os dois casos.** Anexo de outro orçamento e anexo não liberado devolvem
   a mesma resposta `404 "Documento não encontrado."`. Um `403` no caso "existe mas não é seu"
   confirma a existência do arquivo e permite enumerar `anexo_id` sequencial.
3. **Caminho de disco por `anexo_disk_path(anexo.url)`** (`anexo_utils.py:84`), que já normaliza
   com `basename`. Não construa o caminho por concatenação, não aceite nome de arquivo vindo do
   cliente em nenhuma hipótese.
4. **`content_disposition_type="attachment"` e `media_type="application/octet-stream"`**, igual
   ao download interno (`orcamentos.py:560`). Nunca `inline`: um `.txt` ou `.csv` renderizado
   inline executa no contexto de origem do portal. O CSP já está apertado
   (`script-src 'self'`), mas defesa em profundidade custa uma linha aqui.
5. **`/proposta/pdf`** serve `orcamento.anexo_url` (o PDF gerado pelo `pdf_generator.py`), pelo
   mesmo caminho e com as mesmas regras. Se `anexo_url` estiver vazio ou o arquivo não existir
   no disco → `404` genérico. Não tente regerar o PDF numa requisição pública: geração é cara e
   vira vetor de negação de serviço.
6. **`AuditLog` a cada download**, com `usuario_id=None`, `acao="BAIXOU_DOCUMENTO_PORTAL"`,
   `entidade="Orcamento"`, `entidade_id=orcamento.id`, e o nome do documento nos detalhes. Isso
   aparece no histórico do orçamento e dá ao arquiteto um sinal real: *"o cliente abriu a planta
   às 22h de ontem"* é informação comercial útil, não só rastro de auditoria.
7. O `documentos` do `PortalPropostaOut` (Tarefa 3) lista **apenas** os anexos com
   `visivel_cliente = True`, e cada item traz só `id`, `nome_original`, `extensao`, `tamanho`,
   `created_at`. Nunca o campo `url` do banco, que é caminho de disco.

---

## TAREFA 6 — Frontend: a tela do cliente

**Arquivos que esta tarefa pode tocar:** `frontend/src/api.ts`, `frontend/src/App.tsx`.

### `api.ts`

- Interfaces `PortalProposta`, `PortalItem`, `PortalDocumento`, `PortalDecisao`, `PortalLink`.
- As chamadas do portal **não** podem usar o `request()` existente, que envia cookie de sessão.
  Escreva um `portalRequest(path, token, init)` que manda `X-Portal-Token` e
  `credentials: 'omit'`. Um cliente que por acaso tenha sessão de ERP no mesmo navegador não
  pode ter essa sessão misturada com o contexto público.
- `getPortalProposta(token)`, `enviarDecisaoPortal(token, body)`,
  `baixarDocumentoPortal(token, anexoId)`, `baixarPdfPropostaPortal(token)`,
  `gerarPortalLink(orcamentoId)`, `revogarPortalLink(orcamentoId)`,
  `alterarVisibilidadeAnexo(orcamentoId, anexoId, visivel)`.
- Download com header não pode ser um `<a href>` simples. Faça `fetch` → `blob` →
  `URL.createObjectURL` → `<a download>` sintético → **`URL.revokeObjectURL` no fim** (sem o
  revoke, cada download vaza memória enquanto a aba viver).

### `App.tsx` — roteamento público

O portal precisa ser alcançável **sem login**. Hoje `App.tsx:1109` devolve `<Login/>` antes de
qualquer rota, então a checagem do portal tem que vir **antes** dessa linha:

```tsx
const [portalToken] = useState(() => {
  const h = location.hash
  if (!h.startsWith('#portal/')) return ''
  const t = h.slice('#portal/'.length)
  history.replaceState(null, '', location.pathname)  // tira o token da barra de endereço
  return t
})
if (portalToken) return <Portal token={portalToken} />
if (location.pathname === '/reset-password') return <ResetPassword/>
if (!authenticated) return <Login .../>
```

O `useState` com inicializador preguiçoso importa: o token precisa ser capturado **uma vez**,
antes do `replaceState` apagar o fragmento. Ler `location.hash` direto no corpo do componente
devolveria string vazia no segundo render.

Remova `'portal'` do `type Route` e do array `routes` (`App.tsx:8-9`) — deixou de ser rota
interna. Ajuste `IconName` na linha 11, que hoje faz `Exclude<Route, 'portal'>` e passa a poder
ser só `Route | 'menu' | 'close'`.

### `Portal({ token })` — reescrita completa

Descarte o mock da linha 1018 inteiro. Aproveite **só o CSS**, que já existe e está pronto:
`.portal`, `.portal-grid`, `.proposal`, `.documents`, `.decision`, `.timeline`, `.help`.

Estados: carregando · link inválido · proposta aberta · decisão já registrada.

- **Cabeçalho:** logo, "Portal de aprovações", nome do cliente.
- **`.card.proposal`:** itens (nome, quantidade, subtotal) e total no rodapé. Formate com
  `Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})` sobre `valor / 100` — **os
  valores chegam em centavos inteiros**, dividir é obrigatório.
- **`.card.documents`:** um botão por documento liberado, com nome e tamanho legível
  (`1,4 MB`). Estado de carregando por botão durante o download. Se `documentos` vier vazio e
  `tem_pdf_proposta` for falso, esconda o cartão inteiro — não mostre "Nenhum documento".
  Mostre o PDF da proposta em primeiro lugar quando `tem_pdf_proposta` for verdadeiro.
- **`.card.decision`:**
  - `status_publico === 'Aguardando sua aprovação'` → campo obrigatório de nome + os botões
    "Aprovar proposta" e "Pedir ajuste".
  - "Pedir ajuste" abre `<Modal>` com `<textarea>` obrigatório, mínimo 10 caracteres, validado
    **também no cliente**, com `aria-invalid` e mensagem visível. Não deixe só o 422 do backend
    falar — a mensagem de erro do Pydantic é técnica e está em inglês.
  - Já decidido → mostra a decisão, a data, e — se recusada — o motivo que o próprio cliente
    escreveu, para ele saber que foi registrado.
  - Qualquer outro status → texto informativo, sem botões.
- **`.card.timeline` "Andamento":** derive as etapas de `status_publico` + `decisao_cliente`.
  **Não invente prazos nem datas.** O mock atual tem `'04/08 · 09:12'` e `'entrega prevista
  12/11/2026'` chumbados; nada disso pode sobreviver — só use datas que a API devolveu.
- **Erro 401:** tela limpa — *"Este link expirou ou foi substituído. Peça um novo ao seu
  arquiteto."* Sem detalhe técnico, sem número de orçamento, sem nome de cliente.

---

## TAREFA 7 — Frontend: o lado do arquiteto

**Arquivos que esta tarefa pode tocar:** `frontend/src/App.tsx`, `frontend/src/index.css`,
`frontend/src/api.ts`.

1. **Novo status no funil.** `App.tsx:148-149` tem os dois mapas coluna ↔ status do kanban.
   Adicione `Ajuste` ↔ `"Ajuste solicitado"` nos dois e no `type Status`. Posicione a coluna
   **entre `Enviado` e `Aprovado`** — é para onde o trabalho volta, e a leitura do funil da
   esquerda para a direita precisa continuar contando a mesma história.
2. **Dashboard.** `App.tsx:106` monta `openQuotes` excluindo status fechados;
   `"Ajuste solicitado"` **é** orçamento aberto, então não entra na exclusão. Confira também o
   contador `pendingApproval` (linha 108) e o `StatusBars` (linha 141).
3. **CSS** (`index.css`): `.badge.ajuste` e `.kanban-col.ajuste h2 i`. Use `var(--gold)`, o tom
   de atenção já usado por `.planejando`. **Não introduza cor nova** — a paleta em `:root` é
   fechada e já tem o token certo.
4. **Detalhe do orçamento:**
   - Botão **"Enviar ao cliente"** → chama `gerarPortalLink`, exibe a URL retornada com botão de
     copiar, e avisa que o link anterior foi invalidado.
   - Botão **"Revogar link"**, com confirmação.
   - Na lista de anexos, um **toggle "Visível ao cliente"** por linha, chamando
     `alterarVisibilidadeAnexo`. Deixe explícito na interface que ligar o toggle publica o
     arquivo para fora da empresa.
   - Quando houver `decisao_cliente`, um **bloco destacado** com a decisão, o nome de quem
     decidiu, a data e — no caso de recusa — o **motivo em destaque**. Esse bloco é o "volta
     direto ao arquiteto": é o que ele abre quando vê o card na coluna Ajuste.

---

## TAREFA 8 — Testes

**Arquivos que esta tarefa pode tocar:** `backend/tests/test_portal.py` (novo),
`backend/tests/test_portal_token.py`.

### Token (sem banco, roda em qualquer ambiente)

1. Token gerado decodifica com `orcamento_id` e `ver` corretos.
2. Token `type="access"` é rejeitado por `expected_types`.
3. Token expirado é rejeitado.

### Portal (exige Postgres)

4. Token válido devolve a proposta com os campos esperados.
5. **A resposta não contém `preco_custo`, `vendedor_id`, `cnpj_faturamento`, `fornecedor_externo`.**
   Faça a asserção sobre o **JSON cru** (`assert "preco_custo" not in resp.text`), não sobre o
   schema — é o texto que sai pela rede que importa, e essa asserção continua valendo se alguém
   acrescentar um campo ao schema depois.
6. Token com `ver` desatualizado, após revogar → 401.
7. Token do orçamento A não enxerga o orçamento B.
8. `recusar` sem motivo → 422; com motivo de 5 caracteres → 422.
9. `recusar` válido → `status` vira `"Ajuste solicitado"`, motivo gravado, `AuditLog` criado com
   `usuario_id` nulo.
10. **`aprovar` → `decisao_cliente='aprovado'` E `status` permanece `"Orçamento gerado"`, E
    nenhum `LancamentoFinanceiro` foi criado, E `produto.quantidade_retida` não mudou.**
    Este é o teste que protege a Regra de Ouro; se ele passar a falhar, alguém religou o portal
    ao `atualizar_status`.
11. Segunda decisão no mesmo orçamento → 409.
12. Decisão em orçamento com status `"Aprovado"` → 409.
13. Download de anexo com `visivel_cliente=False` → 404.
14. Download de anexo de **outro** orçamento com token válido → 404 (mesma mensagem do 13 —
    asserte que as duas respostas são idênticas).
15. Download de anexo liberado → 200, `Content-Disposition: attachment`, e `AuditLog` gravado.
16. `POST /orcamentos/{id}/portal-link` sem `cliente.email` → 400.
17. Gerar link duas vezes invalida o primeiro token.

### Como rodar

Os testes de banco exigem Postgres no Docker. `conftest.py:10` documenta que no Windows é
preciso rodar de dentro do container `api`, por um bug de encoding do psycopg2 sem relação com o
projeto:

```
docker compose up -d db
docker exec -e DATABASE_URL="postgresql://<user>:<senha>@db:5432/arc_erp_test" \
    -e SECRET_KEY="test-secret-key-somente-para-pytest" -w /app arc_api \
    python -m pytest tests -q
```

Frontend: `npm run build` e `npm run lint` limpos antes de considerar qualquer tarefa pronta.

---

## Fora de escopo — não faça

- Conta ou login de cliente com senha
- Notificar `arquiteto_contato` (campo de texto livre) — o destinatário é o `vendedor`
- Assinatura digital, aceite com validade jurídica, carimbo de tempo
- **Consertar `backend/rate_limiter.py`** — bug pré-existente, tratado em separado
- **Tocar nos 25 arquivos que já estavam alterados** quando este plano foi gerado
- Histórico de revisões da proposta (o `rev. 02` do mock não tem lastro no modelo hoje)
- Upload de arquivo pelo cliente através do portal — inverteria o fluxo de confiança e exigiria
  um plano próprio de validação e quarentena

---

## Resumo das superfícies novas

| Método | Rota | Autenticação | Escopo |
|---|---|---|---|
| GET | `/portal/proposta` | `X-Portal-Token` | 1 orçamento |
| POST | `/portal/decisao` | `X-Portal-Token` | 1 orçamento |
| GET | `/portal/anexos/{id}/download` | `X-Portal-Token` | 1 anexo liberado |
| GET | `/portal/proposta/pdf` | `X-Portal-Token` | 1 PDF |
| POST | `/orcamentos/{id}/portal-link` | sessão ERP | admin ou vendedor dono |
| POST | `/orcamentos/{id}/portal-link/revogar` | sessão ERP | admin ou vendedor dono |
| PATCH | `/orcamentos/{id}/anexos/{aid}/visibilidade` | sessão ERP | admin ou vendedor dono |

| Tabela | Colunas novas |
|---|---|
| `orcamentos` | `portal_token_version`, `decisao_cliente`, `decisao_cliente_motivo`, `decisao_cliente_nome`, `decisao_cliente_em` |
| `orcamento_anexos` | `visivel_cliente` (default `FALSE`) |

Quatro rotas públicas novas. Todas em `routers/portal.py`, todas com rate limit, todas com a
mesma dependência `get_portal_orcamento`, todas devolvendo 401/404 genéricos. Se em algum
momento uma delas precisar de um caminho de autorização diferente do das outras, isso é sinal de
que o desenho está errado — pare e reporte antes de implementar.

---

## Quando parar e reportar em vez de improvisar

- Precisar tocar arquivo que não está na lista da tarefa
- Descobrir que o plano contradiz o código real
- Um teste existente quebrar por causa da sua mudança
- Duas formas razoáveis de fazer e o plano não decidir qual
- Uma tarefa exigir credencial, serviço externo ou dado que você não tem

Nesses casos: **pare, escreva o que encontrou em `planos/ESTADO.md`, e não continue.** Um plano
errado descoberto na tarefa 3 custa uma conversa; descoberto na tarefa 8 custa a entrega inteira.

---

## Ao concluir cada tarefa

1. **Commit único**, mensagem `plano(N): <o que foi feito>`, seguindo Conventional Commits.
   Um commit por tarefa — é o que permite reverter uma tarefa sem desfazer as outras.
2. **Acrescente ao fim de `planos/ESTADO.md`:**

```
## TAREFA N — concluída em AAAA-MM-DD HH:MM
Commit: <sha>
Arquivos: <lista>
Verificação: <o que rodou e o resultado, incluindo o que NÃO deu para rodar>
Desvios: <o que fez diferente do plano, e por quê — ou "nenhum">
Dúvidas: <o que ficou incerto — ou "nenhuma">
```

3. **Não comece a tarefa N+1** sem o usuário mandar.
