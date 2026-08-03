## 📄 2. `roadmap_desenvolvimento.md`

```markdown
# Roadmap de Desenvolvimento – Sistema Dilegno Móveis

## Metodologia: Sprints de 2 semanas (Total: ~3 meses para MVP + 1 mês de polimentos)

---

### Sprint 0 – Setup e Infraestrutura (Dias 1–5)
| Atividade | Entregável |
|-----------|-------------|
| Criar VPS, configurar SSH com chave, UFW, fail2ban | Servidor seguro |
| Instalar PostgreSQL, Nginx, Certbot, Python venv | Ambiente pronto |
| Definir domínio e apontar DNS | `sistema.dilegno.com.br` |
| Criar repositório Git (backend e frontend separados) | Código versionado |
| Estabelecer política de branches (main/develop/feature) | Fluxo Git |

---

### Sprint 1 – Backend Base + Autenticação (Dias 6–19)
**Prioridade: Segurança desde o início**

- [ ] Models SQLAlchemy (usuários, roles)
- [ ] Endpoint `/auth/login` (JWT com refresh token em cookie)
- [ ] Endpoint `/auth/refresh`
- [ ] Middleware de verificação de role (admin/vendedor/estoquista)
- [ ] Rate limiting no Nginx para login
- [ ] Testes unitários da autenticação (pytest)

**Entregável**: API funcional com 3 usuários de teste (cada role)

---

### Sprint 2 – Módulo de Estoque (acesso prioritário para galpão)
**Justificativa**: galpão precisa usar o sistema o mais cedo possível.

- [ ] CRUD de produtos (nome, quantidade, preços, fornecedor)
- [ ] Movimentações (entrada/saída) com justificativa
- [ ] Alerta de estoque baixo (endpoint `/estoque/alertas`)
- [ ] Permissões: apenas `estoquista` e `admin` podem modificar estoque
- [ ] Frontend React: lista de produtos, formulário de movimentação, alertas visuais

**Entregável**: Estoquista consegue acessar e atualizar estoque do galpão via browser.

---

### Sprint 3 – Módulo de Clientes e Orçamentos
- [ ] CRUD de clientes (validação CPF/CNPJ opcional)
- [ ] CRUD de orçamentos (itens dinâmicos, cálculo de total)
- [ ] Status do orçamento (pendente, aprovado, recusado)
- [ ] Relação cliente → orçamentos
- [ ] Frontend: listagem, formulário wizard de orçamento, visualização de PDF (básico)

**Entregável**: Vendedor cria orçamentos e associa a clientes.

---

### Sprint 4 – Módulo de Tarefas da Equipe
- [ ] Criar/editar tarefas (título, descrição, responsável, prazo, concluída)
- [ ] Dashboard de tarefas por responsável
- [ ] Notificações por e-mail (SMTP local) para novas tarefas
- [ ] WebSocket opcional para atualização em tempo real (usando `fastapi-websocket`)
- [ ] Frontend: Kanban simplificado (colunas: a fazer, fazendo, concluído)

**Entregável**: Gerente atribui tarefas; equipe visualiza e marca conclusão.

---

### Sprint 5 – Integração e Dashboard
- [ ] Dashboard com KPIs:
  - Total de orçamentos no mês
  - Produtos com estoque crítico
  - Tarefas concluídas vs. atrasadas
  - Clientes novos na semana
- [ ] Relatórios básicos (CSV/Excel) – orçamentos, movimentações de estoque
- [ ] Interface única com login e menu dinâmico por role
- [ ] Testes de segurança: OWASP ZAP, tentativa de força bruta

**Entregável**: Sistema completo para uso interno.

---

### Sprint 6 – Polimentos, Deploy Oficial e Treinamento
- [ ] Otimização de queries (índices no PostgreSQL)
- [ ] Backup automático criptografado (cron + GPG + envio para storage remoto)
- [ ] Documentação de usuário (manual PDF)
- [ ] Treinamento presencial/remoto com equipe (loja + galpão)
- [ ] Deploy final com SSL válido
- [ ] Monitoramento básico (healthcheck endpoint, alerta de queda por e-mail)

**Entregável**: Sistema em produção, usuários treinados.

---

### Cronograma Resumo

| Sprint | Período               | Foco                                    |
|--------|-----------------------|-----------------------------------------|
| 0      | Semana 0              | Infra + Setup                           |
| 1      | Semanas 1–2           | Autenticação + Segurança                |
| 2      | Semanas 3–4           | Estoque (galpão consegue usar)          |
| 3      | Semanas 5–6           | Clientes + Orçamentos                   |
| 4      | Semanas 7–8           | Tarefas + Notificações                  |
| 5      | Semanas 9–10          | Dashboard + Relatórios                  |
| 6      | Semanas 11–12         | Polimentos + Deploy + Treinamento       |

**MVP funcional** (estoque + clientes + orçamentos básicos) estará pronto ao final da **Sprint 3** (semana 6). A partir daí o sistema já é útil; as sprints seguintes agregam valor incremental.

---

### Recomendações Pós-Roadmap

- Adotar **Docker Compose** para facilitar replicação do ambiente (opcional)
- Criar **PWA** (service worker) para acesso offline do galpão
- Integrar com **WhatsApp Business API** para enviar orçamentos
- Implementar **OCR de notas fiscais** para entrada automática no estoque (futuro)
