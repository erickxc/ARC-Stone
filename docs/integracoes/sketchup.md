# Integração ARC ERP ↔ SketchUp

## Visão geral

Um **Projeto** no ARC ERP é a lista de itens (móveis, materiais, componentes) importada de um
software de arquitetura — hoje, o SketchUp. Um Projeto é salvo de forma **independente** de
qualquer orçamento: ele não vira orçamento automaticamente. Só quando um vendedor/arquiteto
cria ou edita um orçamento é que ele opcionalmente seleciona um Projeto salvo, revisa item a
item (casa com um produto do catálogo, ajusta quantidade/preço, ou mantém como item externo) e
confirma — nesse momento, e só nesse momento, os itens entram de fato no orçamento.

Este documento descreve o **contrato de API** para integrar uma ferramenta externa (como uma
futura extensão do SketchUp) com a ERP. O código dessa extensão está fora do escopo deste
documento e deste repositório — aqui está definido apenas o contrato HTTP que ela precisa
respeitar.

Existem dois caminhos de entrada, e ambos produzem o mesmo resultado (um Projeto com seus itens):

1. **Importação manual de CSV** — pela tela "Projetos" da ERP, com um arquivo exportado do
   "Generate Report" do SketchUp (ou qualquer planilha equivalente).
2. **Push via API** — uma extensão rodando dentro do SketchUp envia o mesmo conjunto de dados
   diretamente para a ERP, autenticada por uma chave de API.

## Autenticação

O push via API usa uma **chave de API**, não o login de usuário — ela foi desenhada para uma
extensão rodando localmente por longos períodos, ao contrário do token de sessão (que expira em
15 minutos).

1. Um usuário `admin` ou `vendedor` gera uma chave na tela **Integrações** da ERP (menu lateral,
   seção Gestão).
2. A chave completa (formato `ak_...`) é mostrada **uma única vez**, no momento da criação. Ela
   precisa ser copiada e guardada nesse momento — a ERP nunca a exibe de novo (só o prefixo,
   para identificação).
3. Toda chamada ao endpoint de push deve enviar a chave no header:

```
X-API-Key: ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

4. Uma chave pode ser revogada a qualquer momento pela mesma tela. Chamadas com uma chave
   revogada recebem `401 Unauthorized`.

## Endpoint de push

```
POST {base_url}/api/projetos/push
Content-Type: application/json
X-API-Key: ak_...
```

### Corpo da requisição

| Campo         | Tipo                  | Obrigatório | Descrição |
|---------------|------------------------|-------------|-----------|
| `nome`        | string (máx. 200)      | sim         | Nome do projeto, ex. nome do arquivo/modelo. |
| `cliente_id`  | int ou `null`          | não         | Cliente já cadastrado na ERP, se conhecido no momento do envio. |
| `origem`      | string                 | não (default `"sketchup"`) | Identifica a origem — hoje aceita `"sketchup"` ou `"manual_csv"`. |
| `origem_meta` | string ou `null`       | não         | Metadados livres (ex: versão do SketchUp, versão da extensão, nome do arquivo `.skp`). |
| `itens`       | array (mín. 1 item)    | sim         | Lista de itens do projeto (ver abaixo). |

Cada item em `itens`:

| Campo                     | Tipo             | Obrigatório | Descrição |
|---------------------------|------------------|-------------|-----------|
| `nome`                    | string (máx. 200)| sim         | Nome do componente/bloco. |
| `quantidade`               | int (≥ 1)        | sim         | Quantidade de instâncias do componente. |
| `material`                | string ou `null` | não         | |
| `comprimento`, `largura`, `altura` | number ou `null` | não | Dimensões, na unidade que a origem usar (a ERP não converte unidades). |
| `referencia_externa`      | string ou `null` | não         | Identificador estável do componente na origem (ex: GUID da definição no SketchUp) — útil para rastrear o mesmo componente entre exportações futuras. |
| `preco_sugerido_centavos` | int ou `null`    | não         | Preço sugerido em centavos, se a origem já souber um valor de referência. |
| `observacoes`             | string ou `null` | não         | |

`produto_id` **não** deve ser enviado pela extensão — o casamento com o catálogo é feito pela
ERP (heurística por nome) ou manualmente pelo vendedor na tela de validação.

### Exemplo de requisição

```json
POST /api/projetos/push
X-API-Key: ak_9f2c...

{
  "nome": "Apto 302 - Torre B",
  "cliente_id": null,
  "origem": "sketchup",
  "origem_meta": "modelo.skp v12, exportado 2026-08-03 14:32",
  "itens": [
    {
      "nome": "Painel ripado carvalho",
      "quantidade": 3,
      "material": "MDF carvalho",
      "comprimento": 240.0,
      "largura": 60.0,
      "altura": 2.5,
      "referencia_externa": "guid-a1b2c3"
    },
    {
      "nome": "Bancada quartzo branco",
      "quantidade": 1,
      "material": "Quartzo",
      "referencia_externa": "guid-d4e5f6"
    }
  ]
}
```

### Resposta — `201 Created`

Retorna o Projeto criado, já com os itens e qualquer sugestão automática de produto do catálogo
(`produto_id`/`produto_nome_sugerido`, quando o nome do item bateu exatamente com um produto
ativo do catálogo):

```json
{
  "id": 42,
  "nome": "Apto 302 - Torre B",
  "cliente_id": null,
  "usuario_id": 7,
  "origem": "sketchup",
  "origem_meta": "modelo.skp v12, exportado 2026-08-03 14:32",
  "created_at": "2026-08-03T14:32:10Z",
  "cliente_nome": null,
  "usuario_nome": "Rafael Lima",
  "total_itens": 2,
  "itens": [
    {
      "id": 101,
      "projeto_id": 42,
      "nome": "Painel ripado carvalho",
      "quantidade": 3,
      "material": "MDF carvalho",
      "comprimento": 240.0,
      "largura": 60.0,
      "altura": 2.5,
      "referencia_externa": "guid-a1b2c3",
      "produto_id": 18,
      "produto_nome_sugerido": "Painel ripado carvalho",
      "preco_sugerido_centavos": 129000,
      "observacoes": null
    }
  ]
}
```

### Respostas de erro

| Status | Quando |
|--------|--------|
| `401 Unauthorized` | Header `X-API-Key` ausente, chave inválida ou revogada. |
| `403 Forbidden`    | `cliente_id` informado pertence a outro vendedor (quando a chave pertence a um usuário `vendedor`, não `admin`). |
| `404 Not Found`    | `cliente_id` informado não existe. |
| `422 Unprocessable Entity` | Corpo fora do schema (ex: `itens` vazio, `origem` fora da lista permitida, campo obrigatório faltando). |
| `429 Too Many Requests` | Limite de taxa excedido (ver abaixo). |

## Limite de taxa

`POST /projetos/push` tem limite de **20 requisições por minuto** por IP de origem. Como a
extensão roda localmente, isso é generoso para o uso esperado (poucos pushes por sessão de
modelagem); se o limite for atingido, a resposta é `429` e a extensão deve aguardar antes de
tentar de novo.

## Formato do CSV para importação manual

O caminho de importação manual (`POST /projetos/importar`, autenticado por sessão normal de
usuário, não por API key) aceita arquivos `.csv` ou `.txt`, codificados em UTF-8 (com ou sem
BOM). As colunas são reconhecidas por **nome do cabeçalho**, não por posição — a ordem das
colunas não importa. Cabeçalhos são comparados sem acento e sem diferenciar maiúsculas/minúsculas.

| Coluna aceita (e sinônimos)                              | Campo do item        |
|-----------------------------------------------------------|-----------------------|
| `nome`, `name`, `component`, `component name`, `definition name` | `nome` (obrigatório) |
| `quantidade`, `quantity`, `count`, `qty`                  | `quantidade` (default 1 se ausente) |
| `material`                                                 | `material` |
| `comprimento`, `length`                                    | `comprimento` |
| `largura`, `width`                                         | `largura` |
| `altura`, `height`                                         | `altura` |
| `referencia_externa`, `guid`, `definition guid`             | `referencia_externa` |

Linhas sem `nome`, ou com `quantidade` que não é um número válido, são **ignoradas** (não
derrubam a importação inteira) — a resposta registra quantas linhas foram ignoradas em
`origem_meta`.

Exemplo de arquivo válido:

```csv
nome,quantidade,material,comprimento,largura,altura,referencia_externa
Painel ripado carvalho,3,MDF carvalho,240,60,2.5,guid-a1b2c3
Bancada quartzo branco,1,Quartzo,,,,guid-d4e5f6
```

> **Nota de implementação**: os nomes de coluna exatos que o "Generate Report" do SketchUp
> produz variam por versão e idioma do programa. A lista de sinônimos acima cobre os nomes mais
> comuns em inglês/português, mas deve ser validada contra um export real antes de considerar o
> caminho de CSV testado de ponta a ponta.

## Fora de escopo

O código da extensão do SketchUp (plugin Ruby, usando a Ruby API/SketchUp Extension Warehouse)
**não** faz parte deste documento nem deste repositório — este documento define apenas o
contrato HTTP que essa extensão (ou qualquer outra ferramenta, hoje ou no futuro) deve respeitar
para enviar projetos para o ARC ERP.
