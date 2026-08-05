# Contrato Med-Stone ↔ ARC ERP — adendo obrigatório

Este documento complementa o *Contrato Med-Stone para integração ARC ERP* (a API somente leitura
`/integracoes/v1`, implementada no repositório do Med-Stone). Ele **não substitui** o contrato
original: reúne as correções e as seções que faltavam para que o plugin consiga, de fato, montar
um payload aceito pelo `POST /api/projetos/push` do ARC ERP.

O contrato original está aprovado no eixo de segurança/autorização. As seções abaixo são
pré-requisito para a interoperabilidade e para o fechamento dos critérios de aceite.

Fontes do lado ARC (autoridade sobre o formato aceito):
`backend/schemas.py` (`ProjetoCreatePush`, `ProjetoItemCreate`), `backend/routers/projetos.py`
(`push_projeto`), `docs/integracoes/sketchup.md`.

---

## 1. Mapeamento Med-Stone → ARC

O ARC não conhece o conceito de "peça". Ele armazena **itens de projeto** com `nome` e
`quantidade`. A transformação é responsabilidade do plugin (`packages/core`), e é definida aqui —
não deve ser inferida pelo implementador.

### 1.1 Projeto

| Campo ARC (`ProjetoCreatePush`) | Origem Med-Stone | Regra |
|---|---|---|
| `nome` (string, máx. 200, obrigatório) | `cliente` + `endereco` | `"{cliente} — {endereco}"`, truncado em 200 caracteres. Se `endereco` for vazio, usar só `cliente`. |
| `cliente_id` (int ou `null`) | — | Não existe no Med-Stone. Ver §1.4. |
| `origem` (string) | — | Sempre a constante `"stone"` (já aceita pelo ARC). |
| `origem_meta` (string, máx. 1000) | metadados livres | Opcional; pode carregar versão do plugin ou contexto de exportação. Não é chave de idempotência. |
| `origem_ref` (string, máx. 200) | `id` | Identificador estável do projeto Med-Stone. Obrigatório junto com `origem_rev` para reenvio idempotente. |
| `origem_rev` (string, máx. 200) | `atualizadoEm` | Revisão exportada. Valor diferente cria novo Projeto ARC, preservando a revisão anterior. |
| `origem_status` | `status` | Mapear para `"rascunho"` ou `"finalizado"`; identifica claramente dados ainda mutáveis. |
| `unidade_dimensao` | — | Sempre enviar `"mm"`; o ARC converte e grava as dimensões em cm. |
| `itens` (1–2000) | `pecas[]` agrupadas | Ver §1.2. |

### 1.2 Peça → item (agrupamento)

O plugin **agrupa** as peças por `assinaturaTecnica` antes de enviar. Cada grupo vira um item:

| Campo ARC (`ProjetoItemCreate`) | Regra de derivação |
|---|---|
| `nome` (obrigatório, máx. 200) | `"{categoria.nome} — {material.nome}"`, truncado em 200. |
| `quantidade` (int ≥ 1) | Contagem de peças no grupo (peças com a mesma `assinaturaTecnica`). |
| `material` (máx. 200) | `material.nome`. |
| `comprimento` | `comprimentoMm / 10` (ver §1.3). |
| `largura` | `larguraMm / 10` (ver §1.3). |
| `altura` | `espessuraMm / 10` (ver §1.3). A espessura da peça é a altura do item no ARC. |
| `referencia_externa` (máx. 200) | `assinaturaTecnica` do grupo — **não** o `id` de uma peça individual, que seria arbitrário dentro do grupo. Identificador estável entre exportações. |
| `preco_sugerido_centavos` (int ≥ 0) | `custoUnitarioCentavos` da peça (ver §1.6 e §2.4). Omitir quando o token não tiver `projetos:custos:read`. |
| `observacoes` (máx. 2000) | `"tipoTemplate: {tipoTemplate}; recortes: {quantidadeRecortes}; área líquida unitária: {areaLiquidaM2} m²"`. |

`produto_id` nunca é enviado — o casamento com o catálogo é feito no ARC.

Consequências a registrar no contrato:

- Uma peça sem `categoria` ou sem `material` não pode gerar `nome`. O Med-Stone deve garantir que
  ambos sejam não-nulos no DTO de exportação, ou o plugin precisa rejeitar o projeto com erro
  claro antes do push.
- Se o agrupamento reduzir para mais de 2000 itens distintos, o push falha (limite do ARC). Ver §2.7.

### 1.3 Unidades — normalização no ARC

O Med-Stone expõe dimensões em milímetros e os projetos SketchUp existentes estão em centímetros.
O plugin envia os números em mm e inclui `unidade_dimensao: "mm"`; o ARC divide por 10 e grava
sempre em cm. Assim, a conversão fica protegida no servidor e não depende de o cliente lembrar
de converter.

Precisão: o ARC arredonda o resultado normalizado para 2 casas decimais. A API do Med-Stone
continua em mm; nenhum campo do `/integracoes/v1` muda de unidade.

### 1.4 `cliente_id` — correlação manual

O Med-Stone tem `cliente` como texto livre; o ARC exige `cliente_id: int` de um cliente já
cadastrado. Não há correlação automática.

- O plugin exibe o `cliente` textual do Med-Stone e pede ao usuário que selecione o cliente
  correspondente no ARC (ou "sem cliente").
- `cliente_id: null` é válido no ARC — o vínculo pode ser feito depois, na tela de Projetos.
- Atenção: se a API key do ARC pertencer a um usuário `vendedor`, informar `cliente_id` de cliente
  de outro vendedor devolve `403`; cliente inexistente devolve `404`.

### 1.5 Idempotência — chave do servidor

O ARC identifica um push pela tupla `(usuario_id, origem, origem_ref, origem_rev)` e protege essa
tupla com índice único parcial. O `usuario_id` vem da API key; o plugin envia:

```
origem = "stone"
origem_ref = projetoId
origem_rev = atualizadoEm
unidade_dimensao = "mm"
```

Regras:

- Primeiro envio de uma revisão retorna `201`; reenvio da mesma revisão retorna `200` com o mesmo
  `id` e não cria itens duplicados. O servidor registra o reenvio ignorado em auditoria.
- Em timeout ou erro de rede, o plugin pode reenviar o mesmo payload. Também pode consultar
  `GET /api/projetos/?origem=stone&origem_ref={projetoId}` para reconciliar as revisões próprias.
- Mudança de `atualizadoEm` significa reenvio legítimo: gera Projeto ARC novo e preserva o antigo,
  que pode já estar vinculado a um orçamento.
- `origem_meta` continua metadado livre e não participa da chave.

### 1.6 Custos

- Sem o escopo `projetos:custos:read`, o Med-Stone **omite** os campos financeiros, e o plugin
  envia os itens **sem** `preco_sugerido_centavos` (campo ausente, nunca `0`).
- Com o escopo, o plugin envia `preco_sugerido_centavos = custoUnitarioCentavos` — valor
  **unitário**, porque o item ARC carrega `quantidade`. Enviar o total da peça multiplicaria o
  custo por `quantidade` no ARC.

### 1.7 Credenciais — são duas

| Credencial | Onde é usada | Formato |
|---|---|---|
| Token de integração Med-Stone | `GET /integracoes/v1/*` (leitura) | `Authorization: Bearer msi_...` |
| API key do ARC ERP | `POST /api/projetos/push` | Header `X-API-Key: ak_...` |

O plugin guarda **as duas** no armazenamento seguro do sistema operacional. A API key do ARC é
gerada na tela **Integrações** do ARC e é independente do ciclo de vida do token `msi_`; revogar
um não revoga o outro. Nenhuma das duas vai para o instalador ou para o código-fonte.

---

## 2. Correções no contrato Med-Stone

### 2.1 Novo endpoint: introspecção do próprio token

Sem isso o plugin não tem como cumprir a regra "desabilita a opção *Enviar custos ao ARC* quando o
token não possui o escopo" — os escopos só aparecem na resposta de criação, e o plugin recebe
apenas a string do token. Também resolve o aviso de vencimento (não existe refresh token).

```http
GET /integracoes/v1/me
Authorization: Bearer {token_integracao}
```

Resposta `200`:

```json
{
  "tokenId": "a86f3626-dfe5-44ad-a438-5d296775d88d",
  "usuarioId": "b1c4e9f0-2a77-4d1e-9c3b-58f0a2d7e611",
  "nome": "ARC ERP - Notebook Yann",
  "escopos": ["projetos:read", "projetos:custos:read"],
  "expiraEm": "2026-11-03T18:30:00.000Z"
}
```

- Exige apenas token válido e não revogado — **nenhum escopo específico**.
- Nunca retorna prefixo, hash ou qualquer material do segredo.
- Rate limit: 60 requests/minuto por token.
- O plugin chama no início da sessão, guarda os escopos em memória e avisa o usuário quando
  `expiraEm` estiver a menos de 14 dias.

### 2.2 Hash do token — especificação exata

O contrato original diz "hash/HMAC", o que é ambíguo e faria o Med-Stone e os testes de contrato
divergirem. Fixar:

```
hashToken = hex( HMAC_SHA256( key = INTEGRACAO_TOKEN_HMAC_KEY, message = segredo ) )
```

- Entrada do HMAC é **apenas o `segredo`**, não o token completo `msi_{prefixo}_{segredo}`.
- `INTEGRACAO_TOKEN_HMAC_KEY`: 32 bytes aleatórios, em variável de ambiente, documentada no
  `.env.example` do Med-Stone. Nunca em código.
- Saída: 64 caracteres hex — compatível com `char(64)`.
- Comparação com `crypto.timingSafeEqual` sobre buffers de tamanho igual.
- **Não usar bcrypt/argon2.** O segredo tem 32 bytes de entropia criptográfica; KDF lento aqui só
  adiciona custo em todo request, sem ganho de segurança.
- Rotação da chave HMAC invalida todos os tokens. Documentar como operação de emergência, com
  aviso prévio aos usuários.

### 2.3 Colisão de prefixo e limite de 5 tokens

- **Prefixo**: 6 caracteres alfanuméricos com `UNIQUE` podem colidir na criação. Gerar dentro de
  um retry (até 5 tentativas) tratando violação de unicidade; falha persistente → `500
  INTERNAL_ERROR`.
- **Limite de 5 tokens ativos**: `COUNT` seguido de `INSERT` tem race — dois `POST` concorrentes
  passam os dois. Executar a contagem e a inserção na **mesma transação**, com
  `SELECT ... FOR UPDATE` na linha do usuário (ou advisory lock por `usuarioId`). Teste de
  concorrência obrigatório (ver §3).

### 2.4 Arredondamento de custos

`custoTotal` no Med-Stone é ponto flutuante. Arredondar por peça e depois somar não dá o mesmo
resultado que arredondar o total — o plugin não consegue reconciliar.

Fixar no contrato:

- Cada peça expõe `custoUnitarioCentavos = Math.round(peca.custoTotal * 100)`.
- `custoTotalCentavos` do projeto (listagem e detalhe) = **soma dos valores já arredondados das
  peças**, nunca `Math.round(soma dos floats * 100)`.
- Renomear o campo da peça de `custoTotalCentavos` para `custoUnitarioCentavos`: "total" na peça
  colide semanticamente com o "total" do projeto e é a causa direta do erro de multiplicação
  descrito em §1.6.

### 2.5 `assinaturaTecnica` versionada

O contrato proíbe mudança de significado de campo dentro de `v1`. Se a normalização da assinatura
mudar, o mesmo formato de hash passa a significar outro agrupamento — violação silenciosa.

```
assinaturaTecnica = "sha256:v1:{hex}"
```

- O segmento de versão é obrigatório e faz parte do contrato.
- Mudança em qualquer entrada da normalização (categoria, material, template, espessura, forma
  normalizada, recortes normalizados, acabamento de bordas) ou na forma de serializá-las exige
  **bump para `v2`** no prefixo da assinatura.
- Duas versões podem coexistir na mesma resposta durante um recálculo em lote; o plugin agrupa
  apenas assinaturas de versão idêntica.
- A serialização canônica das entradas (ordem dos campos, precisão numérica, ordenação dos
  recortes) deve estar escrita no contrato, não só no código — é o que garante determinismo entre
  Med-Stone e as fixtures do plugin.

### 2.6 Tipos e formatos

- **`areaLiquidaM2`**: float contraria a própria regra "dinheiro inteiro, dimensão em mm". Trocar
  por `areaLiquidaMm2` (inteiro) ou, se mantido em m², declarar precisão fixa de 4 casas decimais
  no contrato. O ARC não consome esse campo — ele vai para `observacoes` (§1.2).
- **`data: "2026-08-05"`**: é *date-only*, exceção explícita à regra "ISO 8601 UTC". Declarar no
  contrato: sem horário, sem timezone, representa a data comercial do projeto, e **não** deve ser
  convertida para UTC pelo cliente.
- **400 vs 422**: `INVALID_QUERY` (400) e `VALIDATION_ERROR` (422) se sobrepõem, e o
  `ValidationPipe` do NestJS retorna `400` por padrão. Definir:
  - `400 INVALID_QUERY` — query string malformada: cursor inválido, `limit` fora de faixa, data
    não parseável, `status` fora do enum.
  - `422 VALIDATION_ERROR` — corpo de requisição inválido (só existe em `POST /tokens`).
  - Configurar `new ValidationPipe({ errorHttpStatusCode: 422 })` e tratar erros de query nos
    próprios DTOs de query, mapeando para `400`.

### 2.7 Cursor de paginação e limites

- O cursor carrega **apenas** `(atualizadoEm, id)`. Nunca `usuarioId`, `escopos` ou qualquer
  filtro de autorização — o dono vem sempre do `IntegrationPrincipal`. Registrar isso como regra
  explícita, para que nenhuma "otimização" futura transforme o cursor em vetor de IDOR.
- Cursor não precisa ser assinado (não carrega autorização), mas cursor malformado ou não
  decodificável retorna `400 INVALID_QUERY`.
- **`pecas` no detalhe não tem limite** no contrato original. O ARC aceita no máximo 2000 itens
  por push. Definir: se um projeto tiver mais de 2000 grupos distintos, o detalhe retorna
  `pecas` completo mas o plugin recusa o push com mensagem clara. Alternativa (preferível a médio
  prazo): paginar `pecas` no detalhe com o mesmo esquema de cursor.
- O push do ARC tem rate limit de **20 requisições/minuto por API key**. O plugin serializa os
  envios e respeita `429` com backoff.

---

## 3. Segurança e ordem de execução — correções

### 3.1 Ordem de entrega (correção obrigatória)

Na ordem original, o passo 2 (filtrar todas as rotas por `usuarioId`) vem **antes** do passo 3
(migrar projetos legados). Nesse intervalo, todo projeto legado com `usuarioId IS NULL` desaparece
para o próprio dono — perda de acesso a dados reais em produção.

Ordem corrigida:

1. Migration 1: adicionar `usuarioId` **nullable**, FK e índice.
2. Script administrativo de associação dos projetos legados (nunca atribuição automática ao
   primeiro usuário).
3. Validar `SELECT COUNT(*) FROM projetos WHERE "usuarioId" IS NULL` = 0.
4. Migration 2: aplicar `NOT NULL`.
5. **Só então** ativar o filtro obrigatório por `usuarioId` nas rotas de projetos/peças.

Se o passo 5 tiver de ir antes por urgência de segurança, o filtro deve tratar
`usuarioId IS NULL` como visível ao usuário autenticado durante a janela de migração — e a API de
integração (`/integracoes/v1`) **nunca** retorna projeto sem proprietário, em nenhuma fase.

### 3.2 `onDelete: 'RESTRICT'` em `projetos.usuarioId`

`RESTRICT` impede excluir usuário que tenha qualquer projeto. Se existe fluxo de exclusão de
usuário no Med-Stone hoje, ele passa a falhar. Decidir antes de aplicar a migration:

- **Recomendado**: soft delete de usuário (`desativadoEm`), mantendo `RESTRICT` e a integridade
  histórica dos projetos.
- Alternativa: exigir reatribuição explícita dos projetos antes da exclusão.

`ON DELETE CASCADE` em `tokens_integracao.usuarioId` está correto e é deliberadamente diferente:
token é credencial descartável, projeto é dado de negócio.

### 3.3 Token de 90 dias em plugin web

O contrato diz "plugin web/desktop" sem distinguir. Um bearer de 90 dias armazenado no navegador
fica exposto a XSS e a qualquer extensão instalada, e a revogação depende de o usuário perceber o
vazamento.

Escolher explicitamente:

- **Desktop**: token `msi_` de 90 dias, guardado no cofre de credenciais do sistema operacional.
  Este é o caminho suportado.
- **Web**: não usar o token `msi_`. A UI web autentica com o JWT normal do Med-Stone e chama as
  mesmas rotas de leitura via sessão, ou recebe um token de curta duração (≤ 1 h) derivado do JWT.

Enquanto a decisão não estiver no contrato, o `msi_` deve ser tratado como **exclusivo de
desktop**, e a UI de criação deve deixar isso claro para o usuário.

---

## 4. Testes adicionais obrigatórios

Complementam a lista do contrato original.

### Autenticação

- Prefixo válido combinado com o segredo de **outro** token → `401 TOKEN_INVALID`.
- Token bem formado com prefixo inexistente → `401 TOKEN_INVALID` (mesma resposta e mesmo tempo
  de resposta do caso anterior).
- `GET /integracoes/v1/me` funciona com token que tem apenas `projetos:read`.
- Criação concorrente de tokens: 3 `POST /tokens` simultâneos com 4 tokens ativos resultam em
  exatamente 5 ativos e um `409 TOKEN_LIMIT_REACHED`.

### Serialização e custos

- Peça com `custoTotal` fracionário (ex.: `1875.005`): `custoTotalCentavos` do projeto é igual à
  soma dos `custoUnitarioCentavos` das peças, não ao arredondamento da soma dos floats.
- `assinaturaTecnica` sempre traz o prefixo de versão `sha256:v1:`.
- Resposta de `/me` não contém `prefixo` nem `hashToken`.

### Paginação

- `updatedAfter` combinado com `cursor` não pula nem duplica projetos.
- Cursor de um usuário usado com o token de outro usuário não vaza projetos (o filtro vem do
  principal, não do cursor).

### Contrato ponta a ponta (novo — bloqueia a entrega)

Um teste em `packages/core` do plugin que, para cada fixture do detalhe Med-Stone:

1. aplica a transformação de §1;
2. valida o payload resultante contra o schema `ProjetoCreatePush` do ARC — `nome` presente e
   ≤ 200, `quantidade` ≥ 1, `origem: "stone"`, `origem_ref`/`origem_rev` preenchidos,
   `unidade_dimensao: "mm"`, `itens` entre 1 e 2000;
3. confere que o ARC normaliza as dimensões para centímetros;
4. confere que, sem o escopo financeiro, nenhum item traz `preco_sugerido_centavos`.

Fixtures necessárias, além das já listadas no contrato original: projeto com peças que geram mais
de 2000 grupos distintos, e peça sem `categoria`/`material` (caminho de rejeição).

---

## 5. Critérios de aceite — adições

- Plugin descobre os próprios escopos e a validade via `GET /integracoes/v1/me`, sem depender da
  resposta de criação do token.
- Payload gerado pelo plugin é aceito pelo `POST /api/projetos/push` sem ajuste manual, com
  dimensões enviadas em mm e gravadas pelo ARC na mesma unidade dos projetos SketchUp existentes.
- Push repetido da mesma revisão retorna `200` com o mesmo projeto, sem duplicata; revisão nova
  retorna `201` e preserva o projeto anterior.
- Custo enviado ao ARC é unitário e reconcilia com o total do projeto no Med-Stone.
- Nenhum projeto legado fica inacessível ao próprio dono em qualquer fase da migração.
