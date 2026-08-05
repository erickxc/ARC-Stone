# Plano de execução — Higiene da árvore + 2 correções de segurança

Repositório: `C:\Users\bi_2d_gzgh6n0\Desktop\Yann\Pessoal\ARC-ERP`
Stack: FastAPI + PostgreSQL (`backend/`) · React 19 + TS + Vite (`frontend/`)
Base do código: `f5526b2` · A pasta `planos/` foi commitada em `0921d58` (só documentação,
nenhuma linha de código) · Árvore no momento do plano: **suja — 25 arquivos** (trabalho
Med-Stone / `projetos/push` + endurecimento de segurança, revisado e ainda não commitado)
Gerado em: 2026-08-05

Documento para o agente executor. São **4 tarefas**, executadas uma por vez, na ordem. Não
comece a tarefa N+1 antes da N estar verificada e o usuário mandar seguir.

**Leia `CLAUDE.md` na raiz antes de começar.** Convenções: código e comentários em português,
dinheiro em centavos inteiros, sem ferramenta de migração (coluna/índice novo exige DDL manual
no startup), commits em Conventional Commits.

---

## 0. Contexto e decisões

> Este bloco acompanha **toda** tarefa entregue, não só a primeira.

### O que se quer

Duas coisas, nesta ordem. Primeiro **destravar o fluxo**: a árvore tem 25 arquivos alterados e
não commitados, o que torna impossível distinguir trabalho novo de trabalho antigo numa
validação. Segundo **fechar dois achados** de uma revisão do trabalho Med-Stone que já está
nessa árvore — um deles é uma regressão de segurança real.

Este plano é pré-requisito do plano do Portal do Cliente, que está arquivado em
`planos/arquivo/2026-08-05-portal-cliente.md` e volta a ser o `PLANO-ATUAL.md` assim que estas
4 tarefas passarem.

### Decisões já fechadas

| Tema | Decisão |
|---|---|
| Trabalho pendente | **Commitar como está**, em commits lógicos separados, antes de corrigir. Histórico honesto: primeiro a feature, depois o fix. |
| Achado do rate limiter | Voltar o `key_func` **global** para IP e oferecer o balde por API key como **opt-in por rota**, só onde a rota de fato autentica por chave. |
| Achado do índice único | Índice sobre `COALESCE(origem_rev, '')`, para que revisão nula deixe de ser tratada como distinta pelo Postgres. |
| `security-protocol.zip` | Não entra no repositório — vai para o `.gitignore`. |

### Estado atual do código — verificado, não presuma nada além disto

- `backend/rate_limiter.py:16` — `_rate_limit_key()` lê `X-API-Key` do header e usa o hash como
  chave do balde **sem nunca validar se a chave existe no banco**. Só checa `len <= 128`.
- `backend/routers/auth.py:75, 126, 208, 228` — `/login`, `/mfa-login`, `/forgot-password` e
  `/reset-password` são `@limiter.limit("5/minute")` e usam o `key_func` **global**.
- `backend/main.py:49` — os `default_limits` (`100/minute`) são aplicados a todas as rotas via
  `SlowAPIMiddleware`, também com o `key_func` global.
- `backend/routers/projetos.py:270` — `/projetos/push` é `@limiter.limit("20/minute")` e é a
  única rota que autentica por API key (`auth.get_api_key_identity`).
- `slowapi` (`extension.py:783`) — **`limiter.limit()` aceita `key_func` por rota**. É isso que
  torna a correção possível sem duplicar o limiter.
- `backend/main.py:186` — o índice parcial é
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_projetos_origem_ref ON projetos (usuario_id, origem, origem_ref, origem_rev) WHERE origem_ref IS NOT NULL`.
- `backend/routers/projetos.py:262` — a consulta prévia de idempotência usa
  `models.Projeto.origem_rev == payload.origem_rev`; o SQLAlchemy converte `== None` para
  `IS NULL`, então **essa parte funciona**. O buraco é só no índice.
- `backend/routers/projetos.py:141` — `fator_unidade` e a função `dimensao_em_cm` são definidos
  **dentro** do `for item in itens`, sendo recriados a cada item.

### Regra de Ouro desta entrega

> **Nenhuma requisição não autenticada pode escolher o próprio balde de rate limit.**

É o que o achado 1 viola hoje: mandando um `X-API-Key` aleatório a cada tentativa, o atacante
ganha um balde novo por requisição e o `5/minute` do `/auth/login` deixa de existir. Qualquer
correção que mantenha um header controlado pelo cliente como chave de balde em rota pública
está errada, por mais que os testes passem.

---

## TAREFA 1 — Commitar o trabalho pendente

**Arquivos que esta tarefa pode tocar:** `.gitignore` e o índice do git. **Nenhuma alteração de
lógica.** Se você sentir vontade de "arrumar" algo enquanto commita, pare — é a TAREFA 2.

1. Acrescente ao `.gitignore`:

```
# Pacote local da skill de segurança — não versionar
security-protocol.zip
```

2. Commite o que está pendente em commits lógicos separados. Sugestão de agrupamento (ajuste se
   o conteúdo real pedir outro corte, e registre o desvio):

   - `feat(backend): idempotência e unidade mm no push de projetos Med-Stone`
     → `models.py`, `routers/projetos.py`, `schemas.py`, `main.py` (só os ALTER/índice de
     `projetos`), `tests/test_projetos_push.py`
   - `feat(frontend): exibe origem Med-Stone, revisão e status de rascunho`
     → `App.tsx`, `api.ts`
   - `seguranca: endurece CSP, health check, expiração de token e validação de API key`
     → `auth.py`, `main.py` (CSP/health/CORS/advisory lock), `rate_limiter.py`,
     `tests/test_auth.py`, `tests/test_rate_limiter.py`
   - `infra: exige variáveis de produção e adiciona healthcheck no compose`
     → `docker-compose*.yml`, `backend/Dockerfile`, `frontend/nginx.conf`, `.env.example`
   - `docs: documenta integração Med-Stone e atualiza SketchUp`
     → `docs/`, `.gitignore`, `.agents/skills/`

3. **Não commite** `security-protocol.zip` (agora ignorado). `.agents/skills/security-protocol/`
   **pode** ser commitado — é conteúdo de projeto, não artefato.

**Por que commitar antes de corrigir:** o histórico fica legível ("a feature entrou, depois o
fix"), e a partir daqui toda validação vira um diff contra um ponto conhecido. Enquanto a
árvore estiver suja, ninguém consegue afirmar de quem é cada linha.

**Verificação:** `git status` limpo (fora arquivos ignorados); `git log --oneline -6` mostra os
commits novos; `python -m pytest backend/tests/test_rate_limiter.py backend/tests/test_ssrf_utils.py backend/tests/test_anexo_utils.py -q`
continua passando (17 testes); `cd frontend && npm run build && npm run lint` limpos.

---

## TAREFA 2 — 🔴 Corrigir o bypass de rate limit

**Arquivos que esta tarefa pode tocar:** `backend/rate_limiter.py`, `backend/routers/projetos.py`,
`backend/tests/test_rate_limiter.py`.

### O problema, concretamente

`_rate_limit_key()` transforma um header arbitrário em chave de balde. Como `/auth/login` usa o
`key_func` global, isto acontece hoje:

```
POST /auth/login   X-API-Key: ak_aaaaaaaa   → balde novo, 1/5 usado
POST /auth/login   X-API-Key: ak_bbbbbbbb   → balde novo, 1/5 usado
POST /auth/login   X-API-Key: ak_cccccccc   → balde novo, 1/5 usado
```

O limite de 5 tentativas por minuto some, e com ele a proteção contra força bruta de senha. Vale
também para `/mfa-login`, `/forgot-password` e `/reset-password`. A chave nem precisa existir no
banco — nada é consultado.

### A correção

1. Em `rate_limiter.py`, **volte o `key_func` global para o IP real**:

```python
def _real_client_ip(request) -> str:
    """Chave padrão de rate limit: o IP real do cliente.

    Em produção o Nginx sobrescreve X-Real-IP com o IP de origem
    (proxy_set_header X-Real-IP $remote_addr), então o header não é spoofável por quem está
    atrás do proxy. Sem isso, toda requisição chegaria com o IP do container do Nginx e o
    limite viraria global. Cai para o IP de socket quando não há proxy (dev local).
    """
    return request.headers.get("X-Real-IP") or get_remote_address(request)


limiter = Limiter(key_func=_real_client_ip, default_limits=["100/minute"])
```

2. Mantenha o balde por chave, mas como função **separada e opt-in**, com o motivo documentado:

```python
def api_key_or_ip(request) -> str:
    """Chave de rate limit para rotas de integração autenticadas por API key.

    Extensões atrás de Cloudflare compartilham o IP de borda, então uma integração acabaria
    consumindo o limite da outra. Só use em rota que exija API key válida como dependência —
    em rota pública, o cliente escolheria o próprio balde e o limite deixaria de existir.
    O hash evita guardar o segredo em claro no estado do limiter.
    """
    api_key = request.headers.get("X-API-Key")
    if api_key and len(api_key) <= 128:
        return f"api-key:{hashlib.sha256(api_key.encode('utf-8')).hexdigest()}"
    return _real_client_ip(request)
```

3. Em `projetos.py:270`, aplique explicitamente na única rota que autentica por chave:

```python
@limiter.limit("20/minute", key_func=api_key_or_ip)
```

`slowapi` aceita `key_func` por rota (`extension.py:783`) — confirmado nesta versão instalada.

**Por que ainda é seguro no `/projetos/push`:** a rota exige `auth.get_api_key_identity`, que
valida a chave contra o banco; e o `default_limits` de `100/minute` por IP continua valendo por
cima, via middleware, como rede de segurança.

**Não faça nesta tarefa:** não mexa nos limites numéricos, não mexa em `auth.py`, não toque no
`get_api_key_identity`.

**Verificação:** atualize `backend/tests/test_rate_limiter.py` — os dois testes existentes
mudam de significado. Os casos agora são:

1. `_real_client_ip` devolve o `X-Real-IP` quando presente.
2. **`_real_client_ip` ignora `X-API-Key` por completo** — duas requisições com chaves
   diferentes e o mesmo IP devolvem a mesma chave de balde. Este é o teste que trava o achado.
3. `api_key_or_ip` agrupa por chave quando ela está presente.
4. `api_key_or_ip` cai no IP quando não há chave.

Rodam sem banco: `python -m pytest backend/tests/test_rate_limiter.py -q`.

---

## TAREFA 3 — 🟡 Corrigir o índice único com `origem_rev` nulo

**Arquivos que esta tarefa pode tocar:** `backend/main.py`, `backend/tests/test_projetos_push.py`.

### O problema, concretamente

No Postgres, valores `NULL` são **distintos entre si** num índice único. O índice atual é

```sql
CREATE UNIQUE INDEX uq_projetos_origem_ref
  ON projetos (usuario_id, origem, origem_ref, origem_rev)
  WHERE origem_ref IS NOT NULL
```

Quando o Med-Stone manda `origem_ref` mas **não** manda `origem_rev` — caso comum, nem toda
origem versiona —, duas linhas com o mesmo `origem_ref` e `origem_rev` nulo não colidem. O
resultado é que o bloco `except IntegrityError` de `projetos.py:290`, escrito justamente para o
push concorrente, **nunca dispara** nesse caso: dois pushes simultâneos criam dois projetos.

A consulta prévia (`projetos.py:262`) continua protegendo o caso sequencial, porque o SQLAlchemy
traduz `== None` para `IS NULL`. O buraco é só a corrida.

### A correção

Em `main.py:186`, troque a criação do índice por:

```python
        # Postgres trata NULL como distinto em índice único, então uma revisão nula deixaria
        # dois pushes concorrentes do mesmo origem_ref criarem projetos duplicados. O COALESCE
        # normaliza a ausência de revisão para string vazia e fecha a corrida.
        conn.execute(text("DROP INDEX IF EXISTS uq_projetos_origem_ref"))
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_projetos_origem_ref "
            "ON projetos (usuario_id, origem, origem_ref, COALESCE(origem_rev, '')) "
            "WHERE origem_ref IS NOT NULL"
        ))
```

O `DROP` antes do `CREATE` é necessário porque o `IF NOT EXISTS` sozinho manteria o índice
antigo, já criado em bancos que rodaram a versão anterior.

**Atenção:** se já existirem duplicatas no banco (mesmo `usuario_id`/`origem`/`origem_ref` com
`origem_rev` nulo), o `CREATE UNIQUE INDEX` vai falhar e derrubar o startup. Antes do `CREATE`,
verifique com:

```sql
SELECT usuario_id, origem, origem_ref, COUNT(*)
FROM projetos WHERE origem_ref IS NOT NULL AND origem_rev IS NULL
GROUP BY 1,2,3 HAVING COUNT(*) > 1;
```

Se retornar linhas, **pare e reporte** em `ESTADO.md` — decidir qual duplicata sobrevive é
decisão do usuário, não sua.

**Verificação:** acrescente a `test_projetos_push.py` um teste de push repetido com `origem_ref`
preenchido e `origem_rev` **ausente**, confirmando que o segundo push devolve 200 e reaproveita
o mesmo projeto, e que existe uma única linha no banco. Testes de banco exigem Docker (ver fim
do documento).

---

## TAREFA 4 — 🟢 Limpeza do laço em `_criar_projeto_com_itens`

**Arquivos que esta tarefa pode tocar:** `backend/routers/projetos.py`.

Em `projetos.py:141`, `fator_unidade` e a função `dimensao_em_cm` estão declarados **dentro** do
`for item in itens`, e portanto recriados a cada item. Mova os dois para **antes** do laço. O
comportamento não muda; é só clareza — a conversão de unidade é uma propriedade do payload
inteiro, não de cada item, e o código deve dizer isso.

**Não faça nesta tarefa:** nenhuma outra refatoração em `projetos.py`. Se enxergar outra coisa
para melhorar, anote em `ESTADO.md` no campo Dúvidas em vez de mexer.

**Verificação:** `python -m pytest backend/tests/test_projetos_push.py -q` com Docker de pé;
o comportamento de conversão mm → cm continua idêntico.

---

## Fora de escopo — não faça

- Qualquer item do plano do Portal do Cliente (`planos/arquivo/2026-08-05-portal-cliente.md`)
- Trocar o backend de rate limit (Redis, etc.) — o balde em memória serve por ora
- Refatorar `atualizar_status`, o gerador de PDF, ou qualquer coisa que o plano não cite
- Mudar limites numéricos de rate limit
- Resolver duplicatas de dados no banco por conta própria (TAREFA 3)

---

## Resumo das mudanças

| Tipo | Alvo | Observação |
|---|---|---|
| Git | 25 arquivos pendentes | 5 commits lógicos, sem mudança de lógica |
| Config | `.gitignore` | ignora `security-protocol.zip` |
| Correção 🔴 | `rate_limiter.py`, `projetos.py:270` | `key_func` global volta a ser IP; chave vira opt-in |
| Correção 🟡 | `main.py:186` | índice único sobre `COALESCE(origem_rev, '')` |
| Limpeza 🟢 | `projetos.py:141` | closure sai de dentro do laço |
| Testes | `test_rate_limiter.py`, `test_projetos_push.py` | 4 casos reescritos + 1 caso novo |

---

## Como rodar os testes

Sem banco (roda em qualquer ambiente):

```
python -m pytest backend/tests/test_rate_limiter.py backend/tests/test_ssrf_utils.py backend/tests/test_anexo_utils.py -q
```

Com banco — no Windows é preciso rodar de dentro do container `api`, por um bug de encoding do
psycopg2 sem relação com o projeto (`conftest.py:10`):

```
docker compose up -d db
docker exec -e DATABASE_URL="postgresql://<user>:<senha>@db:5432/arc_erp_test" \
    -e SECRET_KEY="test-secret-key-somente-para-pytest" -w /app arc_api \
    python -m pytest tests -q
```

Frontend: `cd frontend && npm run build && npm run lint`.

---

## Quando parar e reportar em vez de improvisar

- Precisar tocar arquivo que não está na lista da tarefa
- Descobrir que o plano contradiz o código real
- Um teste existente quebrar por causa da sua mudança
- Duas formas razoáveis de fazer e o plano não decidir qual
- Uma tarefa exigir credencial, serviço externo ou dado que você não tem
- **A consulta de duplicatas da TAREFA 3 retornar linhas**

Nesses casos: **pare, escreva o que encontrou em `planos/ESTADO.md`, e não continue.**

---

## Ao concluir cada tarefa

1. **Commit único**, mensagem `plano(N): <o que foi feito>`, seguindo Conventional Commits.
   (Exceção: a TAREFA 1 é ela própria uma sequência de commits — nela, registre todos os SHAs.)
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
