# Mapa Completo de Funcionalidades – Dilegno Móveis

> Documento gerado em 13/06/2026. Reflete o estado atual de todas as telas, botões, modais e funções do sistema web.

---

## 1. Autenticação (`/` – Login)

| Elemento | Tipo | Descrição |
|---|---|---|
| Campo E-mail | Input | E-mail corporativo do usuário |
| Campo Senha | Input (password) | Senha do usuário |
| Campo Código MFA | Input (condicional) | Exibido quando o usuário tem 2FA ativo |
| Botão **Entrar** | Botão | Autentica via `POST /auth/login`, salva `access_token`, `user_role` e `user_nome` no localStorage |
| Ilustrações decorativas | Imagem | Elementos visuais (`DILEGNO_ILUS`) posicionados como marca d'água |
| Selo central | Imagem | Logo `DILEGNO_SELLO.P.png` exibido sobre o formulário |

**Fluxo pós-login:** Redireciona para `/dashboard`. Rotas protegidas por `PrivateRoute` (verifica `access_token`).

---

## 2. Layout Global (Navbar + Menu)

| Elemento | Tipo | Descrição |
|---|---|---|
| **Logo Dilegno** | Imagem/Link | `DILEGNO_LOGOTIPO-1.P.png` – Clicável, navega para `/dashboard` |
| **Navbar superior (Upbar)** | Barra | Fundo `bg-eucalipto/90` com `backdrop-blur-md`, sticky |
| **Menu Desktop** | Links + Dropdowns | Menus agrupados: Vendas, Galpão, Gestão – cada um com sub-links |
| **Menu Mobile (Hambúrguer)** | Drawer | Abre pela direita, com grupos de navegação e ícones |
| **Indicador Offline/Sync** | Badge | Mostra status de conexão e quantidade de itens pendentes para sincronizar |
| **Avatar do Usuário** | Ícone circular | Exibe inicial do nome do usuário logado |
| **Botão Sair** | Botão | Remove `access_token` do localStorage e redireciona para `/` |

### Rotas disponíveis no menu:

| Rota | Página | Grupo |
|---|---|---|
| `/dashboard` | Dashboard | — |
| `/clientes` | Carteira de Clientes | Vendas |
| `/orcamentos` | Pipeline de Vendas (CRM) | Vendas |
| `/orcamentos/novo` | Construtor de Orçamento | Vendas |
| `/catalogo` | Catálogo de Produtos | Galpão |
| `/estoque` | Controle de Estoque | Galpão |
| `/fornecedores` | Fornecedores | Galpão |
| `/calendario` | Calendário de Entregas | Gestão |
| `/financeiro` | Painel Financeiro | Gestão |
| `/equipe` | Gestão de Equipe | Gestão (Admin) |
| `/logs` | Logs de Auditoria | Gestão |
| `/configuracoes` | Configurações da Conta | — |

---

## 3. Dashboard (`/dashboard`)

### Visão por Role:
- **Admin:** "Painel de Controle ADM" – vê tudo + Equipe Comercial
- **Vendedor:** "Painel do Vendedor" – vê apenas seus dados

### KPIs (Cards clicáveis):

| Card | Dado | Navega para | Condição |
|---|---|---|---|
| Orçamentos (Globais/Meus) | Contagem total | `/orcamentos` | Sempre visível |
| Clientes (na Base/Meus) | Contagem total | `/clientes` | Sempre visível |
| Itens no Galpão | Contagem de produtos | `/estoque` | Sempre visível |
| Fornecedores | Contagem total | `/fornecedores` | Somente Admin |

### Seções do Dashboard:

| Seção | Descrição |
|---|---|
| **Orçamentos por Status (Funil)** | Barras de progresso: Gerando, Planejando, Enviados, Aprovados, Perdidos |
| **Próximos Eventos** | Lista dos 5 próximos eventos (Entrega/Faturamento), com indicador de urgência por cores |
| **Locações Ativas** | Lista de locações entregues com countdown de dias restantes |
| **Produções Ativas** | Produções aprovadas com prazo de faturamento |
| **Visão da Semana** | Grade 7 dias (Seg–Dom) com eventos clicáveis. Navegação por semanas (◀/▶) e botão "Hoje" |
| **Equipe Comercial** | (Admin) Cards de cada vendedor com miniatura do funil individual |

### Botões do Dashboard:

| Botão | Condição | Ação |
|---|---|---|
| **Relatório Mensal** | Admin | Placeholder visual (sem ação implementada) |
| **Setas ◀/▶ da Semana** | Sempre | Navega entre semanas |
| **Botão "Hoje"** | Quando `weekOffset ≠ 0` | Retorna à semana atual |
| **Eventos clicáveis** | Sempre | Navega para `/orcamentos/:id` do respectivo orçamento |

---

## 4. Carteira de Clientes (`/clientes`)

### Visualização:
- Grid de cards (1-3 colunas responsivo)
- Cada card exibe: Avatar (inicial), Nome Fantasia, CPF/CNPJ, Responsável, E-mail, Telefone, Endereço
- Badge "Pendente" para clientes de cadastro rápido

### Botões e Ações:

| Botão/Ação | Descrição |
|---|---|
| **Pesquisar** | Input de busca por nome, CNPJ, email ou responsável |
| **Cadastro Rápido** | Abre modal simplificado (só Nome + Telefone). Funciona offline |
| **Novo Cliente** | Abre modal completo (todos os campos). Requer conexão |
| **Editar** (ícone lápis) | Abre modal de edição com dados pré-preenchidos. Requer conexão |
| **Excluir** (ícone lixeira) | Confirmação + `DELETE /clientes/:id` |
| **Novo Orçamento** (no card) | Navega para `/orcamentos/novo?cliente=:id` |
| **Ver Funil** (no card) | Navega para `/orcamentos?cliente=NomeDoCliente` |

### Modal de Cadastro/Edição:

| Campo | Obrigatório | Modo Quick | Modo Full |
|---|---|---|---|
| Nome Fantasia / Empresa | ✅ | ✅ | ✅ |
| Telefone / WhatsApp | Sim (full) | ✅ | ✅ |
| CPF/CNPJ | Sim | ❌ | ✅ |
| Nome do Responsável | Sim | ❌ | ✅ |
| E-mail Seguro | Sim | ❌ | ✅ |
| Endereço de Entrega | Sim | ❌ | ✅ |
| Checkbox "Mesmo endereço" | — | ❌ | ✅ |
| Endereço de Faturamento | Condicional | ❌ | ✅ (se desmarcado) |

### Suporte Offline:
- Cadastro Rápido funciona offline (salva na fila de sincronização via IndexedDB)
- Listagem exibe cache local quando sem conexão

---

## 5. Pipeline de Vendas – CRM Kanban (`/orcamentos`)

### Visualização:
- **Kanban Board** com 6 colunas arrastáveis (drag & drop)
- **Tabela colapsável** de orçamentos finalizados

### Colunas do Kanban:

| Coluna | Status ID | Cor |
|---|---|---|
| Gerando Orçamento | `Gerando orçamento` | Cinza |
| Planejando | `Planejando` | Dourado |
| Proposta Enviada | `Orçamento gerado` | Terracota |
| Aprovado (Galpão) | `Aprovado` | Verde (moss) |
| Entregue | `Entregue` | Azul |
| Arrastar p/ Finalizar | `FINALIZAR` | Cinza tracejado |

### Cada card exibe:
- Badge de tipo (Venda / Locação / Produção)
- ID do orçamento (#ORC-0001)
- Nome do cliente
- Avatar do vendedor
- Valor total e quantidade de itens

### Botões e Ações:

| Ação | Descrição |
|---|---|
| **Pesquisar** | Filtro por cliente ou ID |
| **Filtro por Vendedor** | Combobox (somente Admin) |
| **Novo Orçamento** | Link para `/orcamentos/novo` |
| **Drag & Drop** | Move card entre colunas, atualiza status via `PUT /orcamentos/:id/status` |
| **Clique no card** | Navega para `/orcamentos/:id` |
| **Expandir/Colapsar Finalizados** | Toggle da tabela de orçamentos encerrados |

### Modal de Finalização:
Acionado ao arrastar card para coluna "Finalizar".

| Opção | Descrição |
|---|---|
| **Perdido / Negado** | Status `Orçamento negado` |
| **Devolvido ao Estoque** | Status `Devolvido` (só Produção/Locação) |
| **Faturado / Vendido** | Status `Faturado` |

### Suporte Offline:
- Listagem via cache IndexedDB
- Drag & Drop bloqueado quando offline

---

## 6. Construtor de Orçamento (`/orcamentos/novo` e `/orcamentos/editar/:id`)

### Layout: Duas colunas (Desktop)
- **Esquerda:** Documento do orçamento (cabeçalho + itens)
- **Direita:** Ferramentas (upload de referência externa + lista de produtos)

### Cabeçalho do Orçamento:

| Campo | Tipo | Descrição |
|---|---|---|
| Cliente | Combobox com busca | Busca por nome, CPF, telefone, e-mail |
| Cadastro Rápido de Cliente | Botão + Modal | Cria cliente com Nome + Telefone (funciona offline) |
| Tipo de Documento | Combobox | Venda / Locação / Produção |
| Vendedor Responsável | Combobox (Admin) | Atribui orçamento a um vendedor |
| Arquiteto (Opcional) | Input texto | Nome do arquiteto do projeto |
| Contato do Arquiteto | Input texto | Telefone ou e-mail |
| Prazo da Locação/Produção | Input numérico + Combobox | Valor + Unidade (dias/meses). Visível só para Locação/Produção |

### Itens da Proposta:
Cada item pode ser **interno** (do Galpão/Catálogo) ou **externo** (upload de foto).

| Campo por item | Tipo |
|---|---|
| Foto | Imagem (automática do produto ou upload) |
| Nome | Texto (editável para externos) |
| Quantidade | Número (limitado pelo estoque para itens do Galpão) |
| Preço Unitário (R$) | Número decimal |
| Local de Instalação | Texto livre |
| Prazo de Entrega | Número + Unidade (dias/meses) |
| Personalização | Texto (visível se produto permite) |
| Fornecedor (externo) | Texto com datalist dos fornecedores cadastrados |
| Descrição (externo) | Texto livre |

### Painel de Ferramentas (Direita):

| Ferramenta | Descrição |
|---|---|
| **Upload de Referência** | Upload de foto (clique ou drag & drop) para criar item externo |
| **Drag & Drop de URL** | Arrasta imagem da web (Google Images, sites) – baixa automaticamente via API |
| **Abas Galpão / Catálogo** | Alterna entre produtos do Galpão (estoque físico) e Catálogo (sob demanda) |
| **Busca de Produto** | Filtro por nome ou ID |
| **Clique no produto** | Adiciona ao orçamento |

### Botões:

| Botão | Ação |
|---|---|
| **Limpar Todos** | Remove todos os itens (com confirmação) |
| **Remover item** (lixeira) | Remove item individual |
| **Emitir Orçamento / Salvar** | `POST /orcamentos/` ou `PUT /orcamentos/:id` |

### Suporte Offline:
- Criação de orçamento funciona offline (salva na fila de sincronização)
- Edição bloqueada offline
- Upload de foto offline converte para base64

---

## 7. Detalhe do Orçamento (`/orcamentos/:id`)

### Layout: 3 colunas (Desktop)
- **Esquerda (2 cols):** Itens da proposta com foto, nome, quantidade, preço, local, personalização, subtotal
- **Direita (1 col):** Cards do Cliente, Vendedor, Arquiteto e Controle de Locação

### Botões do Header:

| Botão | Ação |
|---|---|
| **← Voltar** | Retorna para `/orcamentos` |
| **Combobox de Status** | Muda status do orçamento diretamente |
| **Regerar PDF** | `POST /orcamentos/:id/regenerate-pdf` |
| **Ver PDF** | Abre o PDF em nova aba |
| **Editar** | Navega para `/orcamentos/editar/:id` |
| **Excluir** | Abre modal de confirmação → `DELETE /orcamentos/:id` |
| **Ver Funil do Cliente** | Navega para CRM filtrado pelo nome do cliente |

### Controle de Locação/Produção (condicional):
Exibido quando `tipo_orcamento` é Locação ou Produção e status é Aprovado.

| Elemento | Descrição |
|---|---|
| Data de Início | Data da aprovação |
| Data de Fim | Data de faturamento/devolução |
| **Estender Prazo** | Input + Combobox + botão → `POST /orcamentos/:id/renovar` |

### Histórico e Atividades:
- Timeline visual com avatar, nome do usuário, ação, data/hora e descrição detalhada
- Dados de `GET /orcamentos/:id/historico`

---

## 8. Controle de Estoque (`/estoque`)

### Visualização:
- Grid compacto de cards (3-8 colunas responsivo)
- Cada card exibe: Foto, Nome, Preço de venda, Tipo, Cor, Material, Cômodos, Dimensões, Peso, NCM, Fornecedor, Personalização, Descrição, Observações
- Indicadores: Estoque Físico / Retido / Disponível
- Badge "INATIVO" e ícone de alerta para estoque crítico

### Botões e Ações:

| Botão/Ação | Condição | Descrição |
|---|---|---|
| **Indicador Online/Offline** | Sempre | Badge verde (Conectado) ou terracota (Offline) |
| **Importar Excel** | Admin/Estoquista | Upload de planilha `.xlsx/.xls/.csv` → processamento em lote |
| **Novo Produto** | Admin/Estoquista | Abre modal de cadastro completo |
| **Buscar no galpão** | Sempre | Input de busca textual |
| **Mostrar Inativos** | Checkbox | Alterna visibilidade de produtos desativados |
| **Filtros Avançados** | Toggle | Exibe filtros: Tipo, Cor, Material, Fornecedor, Cômodos |
| **Editar Produto** (hover) | Admin/Estoquista | Abre modal `EditProdutoModal` |
| **Baixa (−)** | Sempre | Abre modal de movimentação tipo SAÍDA |
| **Entrada (+)** | Sempre | Abre modal de movimentação tipo ENTRADA |

### Modal Criar Produto:

| Campo | Obrigatório |
|---|---|
| Foto (upload drag & drop) | Não |
| Nome do Produto | Sim |
| Tipo | Não |
| Fornecedor | Combobox com busca |
| Material Predominante | Não |
| Classificação Fiscal (NCM) | Não |
| Situação (Ativo/Inativo) | Sim |
| Cômodos | Não |
| Dimensões (Comp/Larg/Alt/Diâm cm) | Não |
| Peso (Líquido/Bruto kg) | Não |
| Personalização | Não |
| Observações | Não |
| Preço de Custo (R$) | Sim |
| Preço de Venda (R$) | Sim |
| Estoque Inicial | Sim |
| Estoque Mínimo | Sim |
| Onde exibir (Catálogo/Galpão) | Radio |

### Modal de Movimentação:

| Campo | Descrição |
|---|---|
| Quantidade | Número (mínimo 1) |
| Justificativa | Texto opcional (padrão: "Operação padrão via sistema") |
| Botão Confirmar | `POST /estoque/movimentar/:id` |

### Suporte Offline:
- Listagem via cache IndexedDB
- Movimentações offline salvas na fila de sincronização

---

## 9. Catálogo de Produtos (`/catalogo`)

Estrutura idêntica ao Estoque, porém:
- Exibe apenas produtos com `is_catalogo = true`
- **Não possui** botões de Entrada/Saída de estoque
- Exibe badge "Em Estoque: X" quando tem unidades
- Campo "Estoque Mínimo" desabilitado (sempre 0) ao cadastrar

### Botões exclusivos:

| Botão | Ação |
|---|---|
| **Importar Excel** | Placeholder (`alert`) – em desenvolvimento |
| **Cadastrar Manual** | Modal idêntico ao Estoque, com `is_catalogo = true` |

---

## 10. Fornecedores (`/fornecedores`)

### Visualização:
- Grid de cards (1-3 colunas)
- Avatar (inicial), Nome, CNPJ, E-mail, Telefone, Endereço, Observações, Badge "Pendente"

### Botões e Ações:

| Botão | Ação |
|---|---|
| **Pesquisar** | Filtro por nome, CNPJ ou e-mail |
| **Novo Fornecedor** | Abre modal de cadastro |
| **Editar** (ícone lápis) | Abre modal de edição |
| **Desativar** (ícone lixeira) | Confirmação + `DELETE /fornecedores/:id` |

### Modal de Cadastro/Edição:

| Campo | Obrigatório |
|---|---|
| Nome / Razão Social | Sim |
| CNPJ | Não |
| E-mail para Contato | Não |
| Número para Contato | Não |
| Endereço | Não |
| Observações | Não |

---

## 11. Calendário de Entregas (`/calendario`)

### Visualização:
- Grade de calendário mensal completo (Dom–Sáb)
- Sidebar lateral direita (ao clicar num dia)

### Tipos de evento com cores:

| Tipo | Cor | Ícone |
|---|---|---|
| Entrega | Wood/Dourado | Caixa (Package) |
| Faturamento | Verde (moss) | Cifrão (DollarSign) |
| Retirada | Terracota | Setas (RefreshCw) |

### Botões e Ações:

| Ação | Descrição |
|---|---|
| **Navegar meses** (◀/▶) | Muda o mês exibido |
| **Clicar no dia** | Abre sidebar com detalhes dos eventos |
| **Fechar sidebar** (X) | Fecha o painel lateral |
| **Abrir Orçamento** | Navega para `/orcamentos/:id` do evento |

### Sidebar de Detalhes:
- Exibe: Nome do dia/mês, tipo de evento, cliente, vendedor, endereço
- Para entregas: lista individual de produtos com foto, quantidade, local de instalação, fornecedor
- Para retiradas: resumo dos itens a recolher

---

## 12. Painel Financeiro (`/financeiro`)

> **Módulo em desenvolvimento.** Exibe apenas ícone de construção e mensagem placeholder.

---

## 13. Gestão da Equipe (`/equipe`)

### Acesso: Somente Admin (outros roles veem tela de "Acesso Restrito")

### Visualização:
- Tabela com: Nome/E-mail, Cargo (role badge), Status do Token (Ativo/Desligado), Ações

### Botões e Ações:

| Botão | Ação |
|---|---|
| **Conceder Novo Acesso** | Abre modal de criação de credencial |
| **Revogar Acesso** | `DELETE /usuarios/:id` (com confirmação). Não disponível para Admin ou inativos |

### Modal "Emitir Credencial":

| Campo | Descrição |
|---|---|
| Nome Completo | Texto obrigatório |
| E-mail Corporativo | Email obrigatório |
| Nível de Permissão | Combobox: Vendedor / Estoquista / Administrador Master |
| Senha Provisória | Texto (min 8 chars, 1 maiúscula, 1 número, 1 especial) |

### Roles do sistema:

| Role | Acesso |
|---|---|
| `admin` | Acesso total: Dashboard ADM, Equipe, Fornecedores, todos os orçamentos, Logs completos |
| `vendedor` | Dashboard do Vendedor, CRM (apenas seus orçamentos), Clientes (sua carteira), Catálogo |
| `estoquista` | Estoque (App do Galpão com suporte offline), movimentações |

---

## 14. Logs de Auditoria (`/logs`)

### Visualização:
- Lista cronológica de todas as alterações
- Admin vê histórico completo, vendedores veem apenas seus registros

### Campos de cada log:

| Campo | Descrição |
|---|---|
| Badge de ação | Criação (verde), Edição (dourado), Status (azul), Exclusão (vermelho) |
| Descrição | Texto detalhado da alteração |
| Data/Hora | Timestamp formatado |
| Feito por | Nome do usuário que executou |
| Entidade | Tipo + ID do registro afetado |

### Busca:
- Input de texto filtrando por descrição, ação ou nome de usuário

---

## 15. Configurações da Conta (`/configuracoes`)

### Layout: 2 painéis (cartão de perfil + detalhes)

### Cartão de Perfil:
- Avatar grande (inicial), Nome, E-mail, Badge do role

### Painel "Dados Pessoais":

| Ação | Descrição |
|---|---|
| **Editar** | Habilita edição de Nome e E-mail |
| **Salvar** | `PUT /usuarios/:id` |
| **Cancelar** | Descarta alterações |

### Painel "Segurança (2FA / MFA)":

| Estado | Visualização |
|---|---|
| MFA Desativado | Botão "Habilitar" → gera QR Code via `POST /auth/enable-mfa` |
| QR Code gerado | Exibe QR Code + código secreto manual + input para código de 6 dígitos |
| Botão "Verificar e Ativar" | `POST /auth/verify-mfa?code=XXXXXX` |
| MFA Ativo | Badge "Ativo" em verde |

---

## 16. Funcionalidades Transversais

### Sistema Offline (PWA):
- **IndexedDB** (via `dbAPI`) para cache de: Clientes, Orçamentos, Produtos, Fila de Sincronização
- Operações offline: Cadastro Rápido de clientes, criação de orçamentos, movimentação de estoque
- Indicador visual de status online/offline na Navbar e no Estoque
- Sincronização automática ao reconectar

### Toast Notifications:
- Posição: Top-right
- Estilo: Fundo `#FAF9F6`, texto `#4A3B32`, borda dourada `#D4AF37`
- Tipos: Sucesso, Erro, Loading, Info (com ícone personalizado)

### Componente Combobox:
- Dropdown reutilizável com busca integrada
- Renderização customizada de opções (ex: clientes com tags de CPF/Telefone/Email)
- Modo `disableSearch` para selects simples

### Geração de PDF:
- Automática ao criar orçamento
- Regeneração manual via botão na tela de detalhe
- Download via link no detalhe do orçamento

### Upload de Imagens:
- Upload direto de arquivo (`POST /uploads/`)
- Upload via URL (`POST /uploads/url`) – para drag & drop da web
- Suporte a drag & drop em: Estoque, Catálogo, Construtor de Orçamento
- Conversão base64 para modo offline

---

## 17. Endpoints da API Utilizados

| Método | Endpoint | Tela(s) |
|---|---|---|
| `POST` | `/auth/login` | Login |
| `POST` | `/auth/enable-mfa` | Configurações |
| `POST` | `/auth/verify-mfa` | Configurações |
| `GET` | `/usuarios/me` | Configurações |
| `GET` | `/usuarios/` | Equipe, Dashboard |
| `POST` | `/usuarios/` | Equipe |
| `PUT` | `/usuarios/:id` | Configurações, Equipe |
| `DELETE` | `/usuarios/:id` | Equipe |
| `GET` | `/clientes/` | Clientes, Dashboard, OrcBuilder |
| `POST` | `/clientes/` | Clientes, OrcBuilder |
| `PUT` | `/clientes/:id` | Clientes |
| `DELETE` | `/clientes/:id` | Clientes |
| `GET` | `/orcamentos/` | CRM, Dashboard |
| `POST` | `/orcamentos/` | OrcBuilder |
| `GET` | `/orcamentos/:id` | OrcDetail, OrcBuilder (edição) |
| `PUT` | `/orcamentos/:id` | OrcBuilder (edição) |
| `PUT` | `/orcamentos/:id/status` | CRM, OrcDetail |
| `POST` | `/orcamentos/:id/regenerate-pdf` | OrcDetail |
| `POST` | `/orcamentos/:id/renovar` | OrcDetail |
| `GET` | `/orcamentos/:id/historico` | OrcDetail |
| `DELETE` | `/orcamentos/:id` | OrcDetail |
| `GET` | `/estoque/produtos` | Estoque, Catálogo, Dashboard, OrcBuilder |
| `POST` | `/estoque/produtos` | Estoque, Catálogo |
| `PUT` | `/estoque/produtos/:id` | EditProdutoModal |
| `POST` | `/estoque/movimentar/:id` | Estoque |
| `GET` | `/fornecedores/` | Fornecedores, Estoque, Catálogo, OrcBuilder |
| `POST` | `/fornecedores/` | Fornecedores |
| `PUT` | `/fornecedores/:id` | Fornecedores |
| `DELETE` | `/fornecedores/:id` | Fornecedores |
| `GET` | `/calendario/entregas` | Calendário, Dashboard |
| `GET` | `/logs/` | Logs |
| `POST` | `/uploads/` | Estoque, Catálogo, OrcBuilder |
| `POST` | `/uploads/url` | OrcBuilder (drag & drop da web) |

---

## 18. Histórico de Atualizações Recentes (13/06/2026)

Esta seção documenta em detalhes as alterações recentes de infraestrutura, layout e design aplicadas ao projeto:

### 1. Correção de Ambiente IDE (Python)
- **Problema:** A IDE (ex: VS Code) estava reportando o erro `Cannot find module 'sendgrid.helpers.mail'` (e em outras bibliotecas como `pyotp`) no arquivo `auth.py`. 
- **Causa:** A IDE estava utilizando o interpretador Python global do Windows em vez do interpretador isolado do ambiente virtual do projeto (`backend/venv`).
- **Resolução (Instrução):** Configuração da IDE para apontar para `.\backend\venv\Scripts\python.exe` através da paleta de comandos (`Python: Select Interpreter`), permitindo que a análise estática enxergue corretamente os pacotes locais instalados e o erro desapareça. O código em si estava íntegro e rodando normalmente.

### 2. Padronização e Ajustes de Layout no Dashboard (`/dashboard`)
- **Fix de URLs de Imagens:** As fotos de produtos nos cards "Produções Ativas" e "Locações Ativas" estavam quebrando (mostrando apenas o ícone ou texto alternativo). A causa era que a API retorna caminhos relativos (ex: `/static/uploads/foto.jpg`), e a página principal do frontend estava tentando ler do localhost do Vite (5173). 
  - **Correção:** Adicionada a lógica condicional (`imgSrc = fotoSrc ? ... : null`) nos cards do Dashboard, anexando corretamente a variável de ambiente `VITE_API_URL` ao caminho da foto, garantindo que elas sejam carregadas do servidor backend.
- **Redimensionamento dos Minicards (Largura Fixa):** O layout de grid (que esticava os cards para preencherem o container da tela) foi alterado. 
  - **Correção:** Os minicards agora utilizam uma estrutura `flex flex-wrap gap-4` e possuem largura fixa (`w-48` / 192px), não esticando em telas maiores e assumindo o formato de "pequenos blocos".
- **Ajuste de Preenchimento das Fotos (`object-contain`):**
  - **Correção:** A classe de estilização das imagens nos minicards foi alterada de `object-cover` (que causava cortes nas laterais para preencher o fundo) para `object-contain`. 
  - Adicionado também um preenchimento interno (`p-1`) ao redor da área da imagem para deixá-la visualmente solta do container cinza, exibindo o produto inteiro de forma elegante.
- **Alinhamento dos Painéis Principais:**
  - **Problema:** A caixa branca em volta de "Locações Ativas" não alinhava verticalmente com "Produções Ativas" e "Próximos Eventos".
  - **Correção:** Os espaçamentos (`padding`) e margens foram padronizados. O painel "Locações Ativas" passou de `p-8` e `mb-6` para `p-5` e `mb-4`, além do título passar a utilizar `text-lg font-bold`, ficando idêntico à caixa vizinha.

### 3. Integração do Design System com Stitch MCP
- **Ação:** O PDF fornecido com o case de Branding da Dilegno (`Dilegno-Branding-Casestudy_V.2.pdf`) foi completamente processado.
- **Artefato Criado:** Foi criado o arquivo `design_system_stitch.md` na raiz do projeto contendo todas as diretrizes da marca em Markdown estruturado, pronto para ser lido pela ferramenta Stitch MCP (`upload_design_md` e `create_design_system_from_design_md`).
- **Conteúdo Extraído:**
  - Missão, Visão e Target (Arquitetos e designers).
  - Arquetipos: O Criador e o Cuidador.
  - Tipografia Oficial: Source Sans 3.
  - Paleta de Cores Mapeada (com RGB, CMYK e HEX): Sombra (`#2E2D2C`), Eucalipto (`#B2C2B2`), Lino (`#F5F3E9`), Lienzo (`#EBEBEB`).
  - Lógica de ilustrações (inspirada em blueprints) e descrição formal do Isologo e Tagline ("Vestindo Espaços").
