---
name: security-protocol
description: Protocolo de segurança de 7 etapas para revisar, testar e corrigir um projeto — auditoria OWASP ASVS, revisão adversarial hostil, cadeia de suprimentos, manutenibilidade, plano de QA/abuso, correção dos achados aprovados, e porta final de liberação. Use SEMPRE que o usuário pedir "auditoria de segurança", "revisão de segurança", "protocolo de segurança", "security review", "pentest", "isso está seguro pra produção?", "posso liberar isso?", "passar esse projeto pra outra pessoa", ou antes de um deploy/handoff/demo importante — mesmo que ele não cite o nome da skill. As etapas 1-5 e 7 são somente leitura por padrão (nunca editam código sem confirmação explícita); só a etapa 6 corrige código, e só depois que o usuário aprovar achados específicos.
---

# Protocolo de Segurança — 7 Etapas

Sequência testada em produção (não é teórica — cada prompt abaixo já rodou contra um projeto
real nesta mesma forma e gerou achados corrigíveis). O protocolo intercala **revisão** (várias
lentes diferentes, deliberadamente redundantes) com **correção controlada** — nunca corrige
nada até o usuário decidir o que aprovar.

## Como invocar

O usuário chama via `/security-protocol <etapa>`. Etapas válidas:

| Argumento | O que roda |
|---|---|
| `audit` | Etapa 1 — Auditoria OWASP ASVS |
| `adversarial` | Etapa 2 — Revisão adversarial (precisa da 1 já ter rodado nesta conversa) |
| `supply-chain` / `dependencies` | Etapa 3 — Cadeia de suprimentos |
| `maintainability` | Etapa 4 — Manutenibilidade |
| `qa` | Etapa 5 — Plano de QA/casos de abuso |
| `fix` | Etapa 6 — Corrige achados aprovados (exige lista de IDs) |
| `gate` / `release` | Etapa 7 — Porta final de liberação |
| `all` (ou sem argumento) | Roda 1→2→3→4→5 em sequência, produz os 5 relatórios, **para** e pergunta quais achados corrigir. Nunca executa a 6 automaticamente. |

Se o usuário só disser "faz uma auditoria de segurança" sem falar em `/security-protocol`,
trate como equivalente a `all`.

## Regra inquebrável: leitura vs escrita

- **Etapas 1, 2, 3, 4, 5, 7 são somente leitura.** Nunca edite, crie ou apague arquivo de
  código nessas etapas — mesmo que o achado pareça trivial de corrigir. O valor dessas etapas
  é justamente separar "o que está errado" de "o que eu decidi mudar"; misturar as duas
  destrói a possibilidade do usuário revisar antes de qualquer mudança acontecer.
- **Só a etapa 6 escreve código**, e só depois que o usuário disser explicitamente quais
  achados (por ID) quer corrigir. Se o usuário disser "corrige tudo que puder" sem listar IDs,
  isso É uma aprovação válida — mas triagem primeiro: exclua da lista qualquer achado que
  exija decisão de produto/infraestrutura que você não pode tomar sozinho (ex: "qual deve ser
  o teto de rate limit", "qual container base pinar por digest"), e liste esses separadamente
  como pendentes de decisão humana em vez de inventar uma resposta.
- Ao final de qualquer etapa 1-5, **não pule direto pra etapa 6** só porque achou óbvio o que
  fazer. Pare, mostre os achados, e deixe o usuário decidir o que entra no escopo.

## Antes de começar

Confirme com o usuário (ou infira do contexto da conversa) qual é o alvo: todo o repositório?
Só o backend? Um diff específico? Se não estiver claro e o projeto for grande, pergunte antes
de gastar uma etapa inteira revisando a coisa errada.

Se for revisar um projeto que você já conhece bem por trabalho anterior na mesma conversa,
não redescubra do zero — mas ainda releia os arquivos relevantes antes de listar achados;
memória de conversa não substitui checar a linha de código atual.

---

## Etapa 1 — Auditoria de Segurança (OWASP ASVS)

Atue como revisor sênior de segurança de aplicações. Não modifique o código ainda.

Revise o projeto usando OWASP ASVS e práticas de SDLC seguro. Foque em autenticação,
autorização, IDOR/BOLA, injeções, uploads/downloads, SSRF, XXE, desserialização, exposição
de segredos, variáveis de ambiente, CORS, cookies, sessões, JWT/OAuth, validação de entrada,
codificação de saída, criptografia, logs sensíveis, vazamento de erros, dependências,
configuração, Docker, CI/CD e implantação.

Formato de saída:

1. Resumo executivo
2. Suposições do modelo de ameaça
3. Tabela de achados com ID, severidade (crítico/alto/médio/baixo/informativo), arquivo/função,
   problema, cenário de exploração, correção recomendada e confiança
4. Notas sobre falsos positivos
5. Itens que requerem confirmação humana
6. Não corrija ainda

Como executar: leia o código real, especialmente autenticação, upload, execução de comando
externo e montagem de strings/queries/markup com entrada do usuário. Não invente achados por
nome de arquivo. Use IDs curtos e estáveis, como F1, F2.

## Etapa 2 — Revisão de Segurança Adversarial

Só execute depois da Etapa 1 nesta conversa. Tente provar que a revisão anterior perdeu algo.
Assuma exposição à internet e procure suposições não declaradas, limites de confiança,
entrada alcançando pontos sensíveis, escalonamento de privilégio, IDOR/BOLA, condições de
corrida, jobs/filas/cron/webhooks/processadores inseguros, rotas admin/debug, rate limiting,
auditoria e casos de abuso.

Não repita achados anteriores sem novas evidências. Saída:

1. Problemas recém-descobertos
2. Problemas previamente subestimados
3. Suposições de segurança a verificar manualmente
4. Caminho de ataque de maior risco

Verifique rotas habilitadas por padrão, docs/admin panels, middlewares configurados mas não
conectados e checagens de autorização duplicadas. Continue a numeração dos IDs.

## Etapa 3 — Revisão de Dependência e Cadeia de Suprimentos

Revise dependências, build, scripts de pacote, lockfiles, Dockerfiles, CI/CD, instalação e
código gerado. Verifique dependências desnecessárias/abandonadas/suspeitas, typosquatting,
scripts de instalação amplos, lockfiles ausentes, dependency confusion, segredos de CI,
imagens Docker e Actions não fixadas, SBOM/proveniência, downloads em build, shell inseguro e
reprodutibilidade.

Saída:

1. Resumo de risco da cadeia de suprimentos
2. Tabela de riscos de dependência
3. Riscos de Build/CI
4. Mudanças necessárias antes da liberação
5. Reforço desejável
6. Arquivos exatos para inspeção manual

Cheque de fato `.dockerignore`, `COPY . .`, uso de segredos em `run:`/echo e rode `npm audit`
ou equivalente se disponível.

## Etapa 4 — Revisão de Manutenibilidade e Futuro-Dev

Atue como mantenedor sênior. Revise arquitetura, duplicação, acoplamento, nomes, tamanho de
arquivos/funções, comentários, limites de erro, testes críticos, suposições, configuração,
separação de negócio/UI/transporte e código de segurança sem explicação. Não reescreva por
estilo e não corrija ainda.

Saída:

1. Resumo de manutenibilidade
2. Top 10 riscos de quebra futura
3. Recomendações de refatoração classificadas por valor/risco
4. Arquivos que precisam de comentários/documentação
5. Testes necessários antes de futuras mudanças
6. Não corrija ainda

Compare comentários/docstrings com código real. Onde as Etapas 1/2 acharem bug, verifique se
a causa raiz é padrão duplicado/confuso.

## Etapa 5 — QA e Revisão de Casos de Abuso

Projete testes unitários, integração, regressão de segurança, autorização, validação, entrada
malformada, rate limit/abuso quando relevante, travessia de caminho quando relevante,
contrato de API e fumaça de implantação.

Para cada teste, forneça nome, propósito, arquivos/funções cobertos, resultado esperado,
importância e se bloqueia a liberação. Identifique conjunto mínimo antes da liberação.
Não escreva testes ainda, salvo solicitação.

Todo achado crítico/alto das Etapas 1/2 precisa de teste de regressão nomeado. Só liste testes
de entrada malformada/travessia se houver superfície real.

## Etapa 6 — Correção (só com aprovação explícita)

Pré-condição: usuário deve aprovar IDs específicos ou dizer "corrige tudo que puder". Sem isso,
pare e pergunte antes de tocar em arquivo.

Corrija apenas achados aprovados, preserve comportamento, faça menores mudanças seguras,
adicione testes para correções sensíveis, atualize documentação quando necessário, evite novas
dependências e mantenha changelog por arquivo alterado.

Corrija um achado por vez e valide após cada mudança com a suíte real. Se surgir bug novo,
não expanda escopo sem avisar. Prefira commits separados por achado/tema.

Saída:

1. Resumo das mudanças
2. Arquivos alterados
3. Questões corrigidas
4. Testes adicionados/atualizados
5. Verificação manual
6. Riscos remanescentes

## Etapa 7 — Porta Final de Liberação

Use antes de enviar, fazer demo, publicar ou passar projeto para outra pessoa. Decida entre
`liberar`, `liberar com condições` ou `não liberar`.

Verifique descobertas conhecidas, TODO/FIXME/HACK, segredos/test credentials, debug routes,
erros verbosos, documentação de ambiente, instalação/execução/testes, rollback,
logs/monitoramento, propriedade, dependências, licenças, testes, migração e configuração.

Saída:

1. Problemas bloqueadores
2. Problemas não bloqueadores
3. Verificações manuais necessárias
4. Notas de transferência
5. Tarefas recomendadas ao próximo mantenedor

Veredito deve refletir estado após qualquer Etapa 6 desta conversa. `liberar com condições`
é apropriado quando restam itens dependentes de infraestrutura/produto fora do alcance do
código; não force liberação limpa sem verificação manual.

## Notas gerais

As etapas são deliberadamente redundantes; não pule a 2 após a 1. Mesmo em projeto pequeno,
rode as etapas separadamente. Protocolo vale para qualquer stack, incluindo FastAPI + React.
