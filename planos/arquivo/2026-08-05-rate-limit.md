# Plano de execução — Fechar a raiz do bypass de rate limit

Repositório: `C:\Users\bi_2d_gzgh6n0\Desktop\Yann\Pessoal\ARC-ERP`
Stack: FastAPI + PostgreSQL (`backend/`) · React 19 + TS + Vite (`frontend/`)
Base: `f0399f4` · Árvore: **1 arquivo pendente** — `AGENTS.md` (a sua própria skill de executor,
tratada na TAREFA 1)
Gerado em: 2026-08-05

Documento para o agente executor. São **3 tarefas**, executadas uma por vez, na ordem. Não
comece a tarefa N+1 antes da N estar verificada e o usuário mandar seguir.

**Leia `CLAUDE.md` na raiz antes de começar.** Convenções: código e comentários em português,
dinheiro em centavos inteiros, sem ferramenta de migração, commits em Conventional Commits.

Plano pequeno de propósito — é a primeira rodagem do protocolo novo (commit + bloco em
`planos/ESTADO.md` a cada tarefa). A TAREFA 1 é trivial justamente para exercitar o protocolo
antes de mexer em código sensível.

---

## 0. Contexto e decisões

> Este bloco acompanha **toda** tarefa entregue, não só a primeira.

### O que se quer

Fechar em definitivo uma regressão de segurança que hoje está **parcialmente** corrigida: o
`key_func` global do rate limiter aceita um header controlado pelo cliente como chave de balde.

Isto bloqueia o trabalho do Portal do Cliente (plano arquivado em
`planos/arquivo/2026-08-05-portal-cliente.md`), porque as quatro rotas públicas de `/portal` já
implementadas usam o `key_func` global e portanto nascem sem proteção de rate limit.

### Decisões já fechadas

| Tema | Decisão |
|---|---|
| Direção da correção | **Inverter o default.** Global passa a ser IP; o balde por API key vira opt-in explícito por rota. Corrigir rota a rota é enxugar gelo — toda rota pública futura herdaria o furo. |
| Rotas de `/auth` | Mantêm o `key_func=_rate_limit_ip` explícito. Vira redundante, mas documenta a intenção no ponto onde ela importa. |
| Achado cosmético pendente | Entra como TAREFA 3, em commit separado. |

### Estado atual do código — verificado, não presuma nada além disto

- `backend/rate_limiter.py:28` — `limiter = Limiter(key_func=_rate_limit_key, default_limits=["100/minute"])`.
  **Este é o problema.**
- `backend/rate_limiter.py:12-25` — `_rate_limit_key()` lê `X-API-Key` e usa o hash como chave
  do balde **sem nunca validar se a chave existe no banco**. Só checa `len <= 128`.
- `backend/rate_limiter.py:7-9` — `_rate_limit_ip()` já existe e faz a coisa certa.
- `backend/routers/auth.py:78, 129, 211, 231` — as quatro rotas de autenticação **já** usam
  `key_func=_rate_limit_ip`. Foram corrigidas antes; não é preciso mexer nelas.
- `backend/routers/projetos.py:270` — `@limiter.limit("20/minute")`, sem `key_func`. É a **única**
  rota que autentica por API key (`auth.get_api_key_identity`).
- `backend/routers/portal.py:149, 160, 235, 264` — quatro rotas públicas, todas sem `key_func`,
  todas herdando o global. São elas que hoje estão desprotegidas.
- `backend/main.py:49` — os `default_limits` (`100/minute`) são aplicados a **todas** as rotas
  pelo `SlowAPIMiddleware`, também com o `key_func` global.
- `slowapi/extension.py:783` — `limiter.limit()` aceita `key_func` por rota. Confirmado nesta
  versão instalada; é o que torna o opt-in possível sem criar um segundo limiter.
- `backend/tests/test_rate_limiter.py` — 2 testes, ambos chamando `_rate_limit_key`. Serão
  reescritos na TAREFA 2.

### Regra de Ouro desta entrega

> **Nenhuma requisição não autenticada pode escolher o próprio balde de rate limit.**

É exatamente o que o código viola hoje. Mandando um `X-API-Key` aleatório a cada requisição, o
cliente ganha um balde novo por tentativa e o limite deixa de existir. Qualquer solução que
mantenha um header controlado pelo cliente como chave **padrão** está errada, por mais que os
testes passem.

O balde por chave continua legítimo — mas só onde uma dependência já validou a chave contra o
banco antes de a requisição chegar.

---

## TAREFA 1 — Commitar sua própria skill de executor

**Arquivos que esta tarefa pode tocar:** `AGENTS.md`. **Nenhum outro.**

`AGENTS.md` está modificado na árvore com a seção de modo executor que você acabou de criar.
Commite-a sozinha, antes de qualquer mudança de código.

**Por que isso é uma tarefa e não um detalhe:** enquanto houver arquivo pendente, a validação
das tarefas seguintes não consegue afirmar de quem é cada linha. E esta é a primeira vez que o
protocolo novo roda de ponta a ponta — melhor descobrir um problema nele aqui, num commit de
documentação, do que no meio da correção de segurança.

Mensagem sugerida:

```
docs(agents): define o modo executor de planos

Executor lê planos/PLANO-ATUAL.md, roda uma tarefa por vez, commita como
plano(N): ... e devolve o resultado em planos/ESTADO.md.
```

**Não faça nesta tarefa:** nenhuma alteração em `backend/` ou `frontend/`.

**Verificação:** `git status --short` vazio; `git log --oneline -1` mostra o commit novo.

Ao concluir, escreva o bloco em `planos/ESTADO.md` como descrito no fim deste documento. **Este
bloco é o teste real desta tarefa** — é o que avisa o orquestrador de que você terminou.

---

## TAREFA 2 — 🔴 Inverter o default do rate limiter

**Arquivos que esta tarefa pode tocar:** `backend/rate_limiter.py`,
`backend/routers/projetos.py`, `backend/tests/test_rate_limiter.py`.

### O problema, concretamente

Como `/portal/decisao` (`portal.py:160`) usa o `key_func` global, isto funciona hoje:

```
POST /portal/decisao   X-API-Key: qualquer-coisa-1   → balde novo
POST /portal/decisao   X-API-Key: qualquer-coisa-2   → balde novo
POST /portal/decisao   X-API-Key: qualquer-coisa-3   → balde novo
```

O `5/minute` não existe. O mesmo vale para o teto global de `100/minute` em **qualquer** rota da
aplicação, porque o middleware usa o mesmo `key_func`.

### A correção

1. Em `rate_limiter.py`, o limiter global passa a usar o IP:

```python
limiter = Limiter(key_func=_rate_limit_ip, default_limits=["100/minute"])
```

2. Renomeie `_rate_limit_key` para `api_key_or_ip`. O nome perde o underscore porque deixa de
   ser privado — passa a ser importado por outros módulos. Substitua a docstring por uma que
   diga onde ela **pode** ser usada:

```python
def api_key_or_ip(request) -> str:
    """Chave de rate limit para rotas de integração autenticadas por API key.

    Extensões atrás de Cloudflare compartilham o IP de borda, então sem isto uma integração
    consumiria o limite da outra. O hash evita guardar o segredo em claro no estado do limiter.

    Use SOMENTE em rota que exija uma API key válida como dependência. Em rota pública, o
    cliente escolheria o próprio balde trocando o header a cada requisição, e o limite deixaria
    de existir — foi exatamente o que aconteceu quando esta função era o key_func global.
    """
```

3. Em `projetos.py:270`, aplique o opt-in na única rota que autentica por chave:

```python
@limiter.limit("20/minute", key_func=api_key_or_ip)
```

Ajuste o import no topo do arquivo.

4. **Não** adicione `key_func` em `routers/portal.py`. Com o global corrigido, aquelas rotas
   passam a ser limitadas por IP, que é o comportamento correto para superfície pública.

5. Confirme que nenhum outro módulo importa `_rate_limit_key` pelo nome antigo. Se importar,
   atualize — não deixe import quebrado.

**Não faça nesta tarefa:** não mexa nos valores numéricos dos limites, não mexa em
`get_api_key_identity`, não toque em `routers/auth.py` (já está correto), não toque em
`routers/portal.py`.

### Verificação

Reescreva `backend/tests/test_rate_limiter.py` — os dois testes atuais chamam `_rate_limit_key`
e mudam de significado. Os casos passam a ser quatro:

1. `_rate_limit_ip` devolve o `X-Real-IP` quando o header está presente.
2. **O `key_func` global ignora `X-API-Key`**: duas requisições com chaves diferentes e o mesmo
   IP produzem a mesma chave de balde. Escreva este teste chamando `limiter._key_func` (ou o
   atributo equivalente na versão instalada — confirme antes) em vez de chamar `_rate_limit_ip`
   diretamente, para que ele falhe se alguém trocar o `key_func` do limiter no futuro. **Este é
   o teste que trava o achado**; se ele passar a falhar, a regressão voltou.
3. `api_key_or_ip` agrupa por chave quando ela está presente.
4. `api_key_or_ip` cai no IP quando não há chave.

Roda sem banco:

```
python -m pytest backend/tests/test_rate_limiter.py -q
```

Rode também a bateria que não precisa de banco, para garantir que nada quebrou:

```
python -m pytest backend/tests/test_rate_limiter.py backend/tests/test_portal_token.py backend/tests/test_ssrf_utils.py backend/tests/test_anexo_utils.py -q
```

Eram 21 testes passando antes desta tarefa; devem continuar passando, com os novos casos somados.

---

## TAREFA 3 — 🟢 Tirar a closure de dentro do laço

**Arquivos que esta tarefa pode tocar:** `backend/routers/projetos.py`.

Em `projetos.py:162-168`, `fator_unidade` e a função `dimensao_em_cm` estão declarados **dentro**
do `for item in itens`, e portanto recriados a cada item. Mova os dois para **antes** do laço.

O comportamento não muda; é clareza. A conversão de unidade é propriedade do payload inteiro,
não de cada item, e o código deve dizer isso.

**Não faça nesta tarefa:** nenhuma outra refatoração em `projetos.py`. Se enxergar outra coisa
para melhorar, anote no campo Dúvidas do `ESTADO.md` em vez de mexer.

**Verificação:** a conversão mm → cm continua idêntica. O teste que cobre isso
(`test_push_idempotente_e_normaliza_mm`) exige Postgres:

```
docker compose up -d db
docker exec -e DATABASE_URL="postgresql://<user>:<senha>@db:5432/arc_erp_test" \
    -e SECRET_KEY="test-secret-key-somente-para-pytest" -w /app arc_api \
    python -m pytest tests/test_projetos_push.py -q
```

Se o Docker não estiver disponível, **diga isso no campo Verificação** em vez de afirmar que
passou. `conftest.py:10` explica por que no Windows é preciso rodar de dentro do container.

---

## Fora de escopo — não faça

- Qualquer item do plano do Portal do Cliente (`planos/arquivo/2026-08-05-portal-cliente.md`) —
  ele volta a ser o plano atual depois que estas 3 tarefas passarem
- Revisar ou corrigir o código do portal já commitado em `2c64c2e` — ele ainda será validado
- Trocar o backend do rate limit (Redis, etc.) — o balde em memória serve por ora
- Mudar valores numéricos de limite
- Adicionar `key_func` em rotas públicas

---

## Resumo das mudanças

| Tipo | Alvo | Observação |
|---|---|---|
| Git | `AGENTS.md` | commit isolado, sem código |
| Correção 🔴 | `rate_limiter.py:28` | `key_func` global passa a ser `_rate_limit_ip` |
| Renomeação | `_rate_limit_key` → `api_key_or_ip` | deixa de ser privada; docstring diz onde pode ser usada |
| Opt-in | `projetos.py:270` | única rota que autentica por API key |
| Testes | `test_rate_limiter.py` | 2 casos reescritos, 4 no total |
| Limpeza 🟢 | `projetos.py:162` | closure sai de dentro do laço |

Efeito colateral pretendido: as quatro rotas de `/portal` passam a ser limitadas por IP sem que
uma linha delas seja tocada. Se isso **não** acontecer, o `key_func` global não foi trocado de
verdade — verifique antes de dar a tarefa por concluída.

---

## Quando parar e reportar em vez de improvisar

- Precisar tocar arquivo que não está na lista da tarefa
- Descobrir que o plano contradiz o código real
- Um teste existente quebrar por causa da sua mudança
- Duas formas razoáveis de fazer e o plano não decidir qual
- Uma tarefa exigir credencial, serviço externo ou dado que você não tem
- **O atributo do `key_func` do limiter não se chamar `_key_func` nesta versão do slowapi**
  (TAREFA 2, verificação 2) — reporte o nome real em vez de adivinhar

Nesses casos: **pare, escreva o que encontrou em `planos/ESTADO.md`, e não continue.** Um plano
errado descoberto na tarefa 1 custa uma conversa; descoberto no fim custa a entrega inteira.

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
