# Auditoria de Funcionalidade

Atualizada em 2026-08-03. Fonte: grafo estrutural do projeto e inspeção de handlers React/rotas FastAPI.

## Ligado ao backend

- Autenticação: login, sessão atual e logout.
- Catálogo: listar e criar produtos por `/estoque/produtos` (primeiro lote reparado).

## Backend pronto, frontend ainda estático ou sem tela

- Clientes: CRUD completo em `/clientes`.
- Fornecedores: CRUD completo em `/fornecedores`.
- Equipe: CRUD e perfil em `/usuarios`.
- Estoque: editar produto, alertas e movimentação em `/estoque`.
- Orçamentos: CRUD, status, detalhe, histórico, anexos, condições, configuração, renovar e regenerar PDF em `/orcamentos`.
- Calendário: leitura de entregas em `/calendario/entregas`.
- Auditoria: listagem em `/logs`.
- Autenticação: MFA, esqueci senha e redefinição em `/auth`.

## Tela/controle sem endpoint correspondente

- Dashboard: relatório mensal e indicadores agregados.
- Pipeline: filtro por vendedor e modo lista dedicado.
- Clientes: importação CSV.
- Estoque: pedidos de compra e entradas em trânsito.
- Calendário: criar/editar/excluir eventos e navegar meses reais.
- Financeiro: títulos, lançamentos, exportação, períodos e fluxo projetado.
- Portal: aprovação pública persistida e solicitação de ajuste.

## Telas ausentes para recursos existentes

- Detalhe do orçamento, histórico e anexos reais.
- Configuração de orçamento e condições de pagamento.
- Logs de auditoria.
- Recuperação/redefinição de senha e MFA.
- Edição/desativação de clientes, fornecedores, produtos e usuários.

## Ordem de reparo

1. Catálogo/estoque — em andamento.
2. Clientes e fornecedores.
3. Orçamentos/pipeline.
4. Equipe e logs.
5. Calendário CRUD (exige endpoints novos).
6. Financeiro e portal (exigem domínio e endpoints novos).
