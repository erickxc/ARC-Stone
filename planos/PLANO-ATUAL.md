# Plano de execução — Terminar o Portal do Cliente

Repositório: `C:\Users\bi_2d_gzgh6n0\Desktop\Yann\Pessoal\ARC-ERP`
Stack: FastAPI + PostgreSQL (`backend/`) · React 19 + TS + Vite (`frontend/`)
Base: `6dc2a0b` · Árvore: **limpa**
Gerado em: 2026-08-05

Documento para o agente executor. São **4 tarefas**, executadas uma por vez, na ordem. Não
comece a tarefa N+1 antes da N estar verificada e o usuário mandar seguir.

> **A numeração recomeça em 1.** O `planos/ESTADO.md` foi zerado junto com este plano; os blocos
> do plano anterior estão em `planos/arquivo/2026-08-05-rate-limit-ESTADO.md`.
>
> **O Docker já está de pé** e o banco `arc_erp_test` funcionando — foi usado em `6dc2a0b`.
> Não há desculpa para teste de banco não executado neste plano.

**Leia `CLAUDE.md` na raiz antes de começar.** Convenções: código e comentários em português,
dinheiro em centavos inteiros, sem ferramenta de migração, commits em Conventional Commits.

---

## 0. Contexto e decisões

> Este bloco acompanha **toda** tarefa entregue, não só a primeira.

### O que se quer

O Portal do Cliente está **quase pronto** — backend, frontend e lado do ERP foram implementados
em `2c64c2e`. Este plano fecha o que falta: **dois defeitos que impedem a tela de funcionar**, a
cobertura de testes que nunca existiu, e a primeira execução real da suíte contra o banco.

Plano original arquivado em `planos/arquivo/2026-08-05-portal-cliente.md` — consulte-o para o
contexto de projeto (modelo de ameaça, listas brancas, decisões). Este documento cobre só a
diferença.

### O que já existe e está correto — não reimplemente

| Área | Situação |
|---|---|
| Colunas e `ALTER` (`models.py`, `main.py`) | ✅ completo |
| Token `type="portal"` + `get_portal_orcamento` (`auth.py`) | ✅ completo |
| `routers/portal.py` — proposta, decisão, 2 downloads | ✅ estrutura correta, 2 defeitos abaixo |
| Geração/revogação de link (`orcamentos.py`) | ✅ completo e bem feito |
| Liberação de anexo (`PATCH .../visibilidade`) | ✅ completo |
| Frontend do portal + roteamento por fragmento | ✅ implementado |
| Frontend do ERP (enviar link, toggle, bloco de decisão) | ✅ implementado |
| Rate limit das rotas públicas | ✅ herdado do IP após `776d425` |

Pontos que revisei e considero bem resolvidos, para você não "melhorar" sem motivo: o `404`
genérico nos dois casos de download (`portal.py:249` e `:253`), o `try/except` que impede o
e-mail derrubar a decisão (`portal.py:206`), a recusa por atribuição direta em vez de
`atualizar_status` (`portal.py:181`), e o incremento de `portal_token_version` a cada envio.

### Regra de Ouro desta entrega

> **A aprovação do cliente não movimenta estoque nem financeiro.**

O código respeita isso hoje (`portal.py:174-181` só grava a decisão; o status muda apenas na
recusa). **Não existe teste que prove.** A TAREFA 3 cria esse teste. Se ele passar a falhar,
alguém religou o portal ao `atualizar_status`.

---

## TAREFA 1 — 🔴 `cliente.nome` não existe

**Arquivos que esta tarefa pode tocar:** `backend/routers/portal.py`, `backend/tests/test_portal.py`.

### O defeito

`portal.py:123` faz `cliente_nome=proposta.cliente.nome`. O model `Cliente` (`models.py:90-103`)
**não tem** o atributo `nome`. Os campos disponíveis são `nome_fantasia` (obrigatório) e
`nome_responsavel` (opcional).

Resultado: `AttributeError` em **toda** chamada de `GET /portal/proposta` → 500. A tela do
cliente não abre. É o defeito que bloqueia a entrega inteira.

Troque por `nome_fantasia`.

### Por que o teste não pegou — corrija a raiz também

`test_portal.py:37` monta o cliente falso como `SimpleNamespace(nome="Cliente Teste")`, ou seja,
**o dublê tem um atributo que o model real não tem**. O teste fica verde enquanto a produção
quebra. É a pior categoria de teste: dá confiança sem dar cobertura.

Corrija o dublê para usar `nome_fantasia`. E entenda a lição para a TAREFA 3: dublê de model
inventado à mão só prova que o código concorda consigo mesmo. Os testes novos da TAREFA 3 usam
o banco real e as fixtures de `conftest.py`, não `SimpleNamespace`.

### Segundo item — 🟡 `_foto_publica` aceita URL que o cliente não consegue abrir

`portal.py:80` deixa passar caminhos que começam com `/static/` e `/api/`. Mas
`GET /static/uploads/{filename}` valida JWT de sessão do ERP (`main.py`), e o portal manda
`credentials: 'omit'`. O cliente recebe a URL, o navegador busca, toma 401 e mostra imagem
quebrada.

Restrinja `_foto_publica` a URLs absolutas `http://`/`https://` e devolva `None` para o resto.
Foto de item é um "nice to have" na tela; imagem quebrada é pior que imagem ausente.

**Verificação:** `python -m pytest backend/tests/test_portal.py -q` passa. Confirme com
`grep -rn "cliente\.nome\b" backend/` que não sobrou nenhuma outra ocorrência.

---

## TAREFA 2 — 🔴 `with_for_update()` combinado com `joinedload`

**Arquivos que esta tarefa pode tocar:** `backend/routers/portal.py`.

### O defeito, e como confirmá-lo antes de corrigir

`_carregar_proposta` (`portal.py:34-54`) aplica `joinedload(cliente)` e `joinedload(vendedor)`,
que geram `LEFT OUTER JOIN`. Quando `bloquear=True`, o `with_for_update()` (`portal.py:50`)
adiciona `FOR UPDATE` à mesma consulta.

O PostgreSQL **recusa** `FOR UPDATE` sobre o lado nulável de um outer join, com erro do tipo
*"FOR UPDATE cannot be applied to the nullable side of an outer join"*. Se for esse o caso, o
`POST /portal/decisao` falha com 500 sempre — o cliente nunca consegue aprovar nem recusar.

**Isto ainda não foi observado em execução**, porque nenhum teste de banco do portal rodou.
Portanto: **primeiro confirme, depois corrija.** Suba o banco e chame a decisão uma vez, ou
escreva o teste da TAREFA 3 que exercita `POST /portal/decisao` e observe o erro.

- Se o erro ocorrer: corrija.
- Se **não** ocorrer, reporte em `ESTADO.md` no campo Desvios com a evidência (a query gerada ou
  o teste passando) e **não mexa** — não quero mudança especulativa em código que funciona.

### A correção, se confirmado

Separe o travamento da carga de dados. A consulta que trava pega só a linha do orçamento, sem
nenhum `joinedload`:

```python
def _travar_proposta(db: Session, orcamento_id: int) -> models.Orcamento:
    """Trava apenas a linha do orçamento. Sem eager loading: o Postgres recusa
    FOR UPDATE sobre o lado nulável de um outer join, que é o que joinedload gera."""
    proposta = (
        db.query(models.Orcamento)
        .filter(models.Orcamento.id == orcamento_id)
        .with_for_update()
        .first()
    )
    if not proposta:
        raise HTTPException(status_code=404, detail="Proposta não encontrada.")
    return proposta
```

Em `registrar_decisao`, trave com essa função, faça as checagens de 409, grave a decisão e
commite. Só **depois** chame `_carregar_proposta(db, proposta.id)` (sem lock) para montar a
resposta — o que o código já faz na linha 210.

Mantenha `_carregar_proposta` sem o parâmetro `bloquear`, já que ele deixa de ser usado. Não
deixe parâmetro morto.

**Não faça nesta tarefa:** não mude a lógica de decisão, não mexa nos códigos 409, não altere
o `AuditLog`.

**Verificação:** `POST /portal/decisao` executa com sucesso contra o Postgres. Se o Docker não
estiver disponível, **diga isso** no campo Verificação — esta tarefa não pode ser dada como
concluída sem execução real, porque o defeito é exatamente um que só aparece no banco.

---

## TAREFA 3 — Testes de integração do portal

**Arquivos que esta tarefa pode tocar:** `backend/tests/test_portal.py`,
`backend/tests/test_portal_token.py`, e um novo `backend/tests/test_portal_integracao.py` se
preferir separar os que exigem banco.

Hoje existem 4 testes, todos sobre funções puras. **Nenhum** exercita uma rota. A superfície
pública do sistema está sem cobertura de integração.

Use as fixtures de `conftest.py` (`client`, `db_session`, `make_user`, `make_client`,
`make_product`). **Não** use `SimpleNamespace` para simular models — foi exatamente o que
escondeu o defeito da TAREFA 1.

Casos obrigatórios:

| # | Caso | Espera |
|---|---|---|
| 1 | Token válido em `GET /portal/proposta` | 200 e os campos do contrato |
| 2 | Resposta não contém `preco_custo`, `vendedor_id`, `cnpj_faturamento`, `fornecedor_externo` — asserção sobre `resp.text` cru | ausente |
| 3 | Token `type="access"` no `X-Portal-Token` | 401 |
| 4 | Token com `ver` desatualizado após revogar | 401 |
| 5 | Token do orçamento A tentando ler o B | 401/404, nunca dado do B |
| 6 | `recusar` sem motivo, e com motivo de 5 caracteres | 422 nos dois |
| 7 | `recusar` válido | status vira `"Ajuste solicitado"`, motivo gravado, `AuditLog` com `usuario_id` nulo |
| 8 | **`aprovar`** | `decisao_cliente='aprovado'` **E** `status` continua `"Orçamento gerado"` **E** nenhum `LancamentoFinanceiro` criado **E** `produto.quantidade_retida` inalterado |
| 9 | Segunda decisão no mesmo orçamento | 409 |
| 10 | Decisão em orçamento com status `"Aprovado"` | 409 |
| 11 | Download de anexo com `visivel_cliente=False` | 404 |
| 12 | Download de anexo de **outro** orçamento | 404 — **asserte que a resposta é idêntica à do caso 11** |
| 13 | Download de anexo liberado | 200 e `Content-Disposition: attachment` |
| 14 | `POST /orcamentos/{id}/portal-link` sem `cliente.email` | 400 |
| 15 | Gerar link duas vezes | o primeiro token passa a dar 401 |

**O caso 8 é o mais importante do conjunto.** Ele é a Regra de Ouro em forma executável. Escreva
as quatro asserções separadamente, com mensagem própria, para que a falha diga qual invariante
quebrou.

**O caso 12 exige comparar as duas respostas**, não só checar que ambas são 404. Se um dia
alguém devolver `403` para "existe mas não é seu", o atacante consegue enumerar `anexo_id`.

**Não faça nesta tarefa:** não altere código de produção. Se um teste revelar um defeito,
**pare** e registre em `ESTADO.md` — a correção vira decisão do orquestrador, não uma emenda
sua no meio da tarefa de teste.

**Verificação:** todos os testes passam contra o Postgres. Comando no fim deste documento.

---

## TAREFA 4 — Primeira execução completa da suíte

**Arquivos que esta tarefa pode tocar:** nenhum de produção. Se algo precisar mudar, **pare e
reporte**.

Nenhum teste de banco deste repositório rodou nesta sequência de trabalho. Existem ~50 testes de
integração (orçamentos, clientes, financeiro, uploads, projetos, portal) que estão sem execução
desde antes do Med-Stone.

1. Suba o banco e rode a suíte **inteira** de dentro do container (comando no fim).
2. Rode também `cd frontend && npm run build && npm run lint`.
3. Registre em `ESTADO.md`: total de testes, quantos passaram, e **a lista nominal dos que
   falharam**, se houver.

Se houver falhas, **não as corrija**. Liste-as. Falha antiga e falha nova são problemas
diferentes e precisam de decisão separada — corrigir tudo junto apaga a informação de qual
mudança quebrou o quê.

**Verificação:** a própria execução. O que não puder rodar deve ser dito explicitamente.

---

## Fora de escopo — não faça

- Reescrever `routers/portal.py` — a estrutura está correta, são dois defeitos pontuais
- Mexer no frontend do portal ou do ERP, salvo se um teste provar defeito (aí: pare e reporte)
- Assinatura digital, upload pelo cliente, histórico de revisões da proposta
- Corrigir falhas antigas de teste descobertas na TAREFA 4 — listar, não corrigir
- Trocar o backend do rate limit

---

## Resumo das mudanças

| Tipo | Alvo | Observação |
|---|---|---|
| 🔴 | `portal.py:123` | `cliente.nome` → `cliente.nome_fantasia` |
| 🔴 | `portal.py:34-54` | separar lock de eager loading (se confirmado) |
| 🟡 | `portal.py:76-82` | `_foto_publica` só aceita URL absoluta |
| Teste | `test_portal.py:37` | dublê passa a refletir o model real |
| Testes | novos | 15 casos de integração, incluindo a Regra de Ouro |
| Execução | suíte inteira | primeira vez contra o banco nesta sequência |

Ao fim das 4 tarefas, o portal deve estar funcional de ponta a ponta: gerar link no ERP, abrir a
tela pelo fragmento, ver a proposta, baixar documento liberado, aprovar ou recusar, e o card
aparecer na coluna Ajuste do funil.

---

## Como rodar os testes

Sem banco:

```
python -m pytest backend/tests/test_rate_limiter.py backend/tests/test_portal_token.py backend/tests/test_portal.py backend/tests/test_ssrf_utils.py backend/tests/test_anexo_utils.py -q
```

Com banco — no Windows é preciso rodar de dentro do container `api`, por um bug de encoding do
psycopg2 sem relação com o projeto (`conftest.py:10`):

```
docker compose up -d db
docker exec -e DATABASE_URL="postgresql://<user>:<senha>@db:5432/arc_erp_test" \
    -e SECRET_KEY="test-secret-key-somente-para-pytest" -w /app arc_api \
    python -m pytest tests -q
```

O banco `arc_erp_test` precisa existir uma vez (`CREATE DATABASE arc_erp_test;`).

Frontend: `cd frontend && npm run build && npm run lint`.

---

## Quando parar e reportar em vez de improvisar

- Precisar tocar arquivo que não está na lista da tarefa
- Descobrir que o plano contradiz o código real
- Um teste existente quebrar por causa da sua mudança
- Duas formas razoáveis de fazer e o plano não decidir qual
- Uma tarefa exigir credencial, serviço externo ou dado que você não tem
- **O erro de `FOR UPDATE` da TAREFA 2 não se manifestar** — reporte a evidência e não mexa
- **Um teste da TAREFA 3 revelar defeito de produção** — liste, não emende

Nesses casos: **pare, escreva o que encontrou em `planos/ESTADO.md`, e não continue.**

---

## Ao concluir cada tarefa

1. **Commit único**, mensagem `plano(N): <o que foi feito>`, seguindo Conventional Commits.
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
