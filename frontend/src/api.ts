const API = import.meta.env.VITE_API_URL || '/api'

export interface Product {
  id: number
  nome: string
  tipo: string | null
  material: string | null
  quantidade_estoque: number
  preco_venda: number
  estoque_minimo: number
  is_catalogo: boolean
  ativo: boolean
}

export interface Client {
  id: number
  usuario_id: number
  nome_fantasia: string
  cpf_cnpj: string | null
  nome_responsavel: string | null
  email: string | null
  contato: string | null
  endereco_entrega: string | null
  endereco_faturamento: string | null
  status: string | null
  created_at: string
}

export type ClientInput = Omit<Client, 'id' | 'usuario_id' | 'created_at'>

export interface Supplier {
  id: number
  nome_fantasia: string
  cnpj: string | null
  contato: string | null
  email: string | null
  telefone: string | null
  endereco: string | null
  observacoes: string | null
  status: string | null
  ativo: boolean | null
  created_at: string
}

export type SupplierInput = Omit<Supplier, 'id' | 'created_at'>

export interface TeamMember {
  id: number
  nome: string
  email: string
  role: string
  contato: string | null
  ativo: boolean
  mfa_enabled: boolean
}

export interface TeamMemberInput {
  nome: string
  email: string
  password: string
  role: 'admin' | 'vendedor' | 'estoquista'
  contato?: string | null
}

export interface TeamMemberUpdate {
  nome?: string
  email?: string
  contato?: string | null
}

export interface PaymentCondition {
  id: number
  nome: string
  ativo: boolean | null
}

export interface OrcamentoConfig {
  id: number
  organizacao_nome: string | null
  condicao_pagamento: string | null
  prazo_entrega: string | null
  validade_orcamento: string | null
  garantia_mobiliario: string | null
  observacoes_extras: string | null
  empresa1_nome: string | null
  empresa1_cnpj: string | null
  empresa2_nome: string | null
  empresa2_cnpj: string | null
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  orcamento_id: number
  cliente_nome: string
  tipo: string
  status: string
  quantidade?: number | null
  nome_produto?: string | null
}

export interface QuoteItem {
  id?: number
  produto_id?: number | null
  quantidade: number
  preco_unitario_aplicado: number
  local_instalacao?: string | null
  is_externo?: boolean
  nome_externo?: string | null
  descricao_externa?: string | null
  fornecedor_externo?: string | null
  foto_externa_url?: string | null
  personalizacao_aplicada?: string | null
  prazo_entrega_valor?: number | null
  prazo_entrega_unidade?: string | null
  projeto_item_id?: number | null
  nome?: string | null
  foto_url?: string | null
}

export interface Quote {
  id: number
  cliente_id: number
  vendedor_id: number
  tipo_orcamento: string
  status: string
  created_at: string
  data_entrega: string | null
  cliente_nome: string | null
  vendedor_nome: string | null
  valor_total: number | null
  itens: QuoteItem[]
  decisao_cliente?: 'aprovado' | 'recusado' | null
  decisao_cliente_motivo?: string | null
  decisao_cliente_nome?: string | null
  decisao_cliente_em?: string | null
}

export interface QuoteDetail extends Quote {
  cliente_email?: string | null
  anexo_url?: string | null
  condicoes_pagamento_selecionadas?: string | null
  arquiteto_nome?: string | null
  arquiteto_contato?: string | null
  prazo_locacao_valor?: number | null
  prazo_locacao_unidade?: string | null
  data_fim_locacao?: string | null
  projeto_id?: number | null
}

export interface QuoteCreateInput {
  cliente_id: number
  tipo_orcamento: 'Venda' | 'Locacao' | 'Producao'
  vendedor_id?: number | null
  condicoes_pagamento_selecionadas?: string | null
  projeto_id?: number | null
  arquiteto_nome?: string | null
  arquiteto_contato?: string | null
  prazo_locacao_valor?: number | null
  prazo_locacao_unidade?: string | null
  itens: QuoteItem[]
}

export interface PortalItem {
  nome: string
  descricao: string | null
  quantidade: number
  preco_unitario: number
  subtotal: number
  local_instalacao: string | null
  prazo_entrega_valor: number | null
  prazo_entrega_unidade: string | null
  foto_url: string | null
}

export interface PortalDocumento {
  id: number
  nome_original: string
  extensao: string | null
  tamanho: number | null
  created_at: string
}

export interface PortalProposta {
  organizacao_nome?: string | null
  orcamento_id: number
  numero_exibicao: string
  tipo_orcamento: string
  status_publico: string
  cliente_nome: string
  itens: PortalItem[]
  valor_total: number
  condicoes_pagamento: string | null
  documentos: PortalDocumento[]
  tem_pdf_proposta: boolean
  data_entrega: string | null
  arquiteto_nome: string | null
  arquiteto_contato: string | null
  decisao_cliente: 'aprovado' | 'recusado' | null
  decisao_cliente_nome: string | null
  decisao_cliente_motivo: string | null
  decisao_cliente_em: string | null
  criado_em: string
}

export interface PortalDecisao {
  acao: 'aprovar' | 'recusar'
  motivo?: string
  nome: string
}

export interface PortalLink {
  url: string
  expira_em: string
  enviado_para: string
}

export interface OrcamentoAnexo {
  id: number
  orcamento_id: number
  nome_original: string
  url: string
  extensao: string | null
  tamanho: number | null
  created_at: string
  usuario_nome: string | null
  visivel_cliente: boolean
}

export interface ProjetoItem {
  id: number
  projeto_id: number
  nome: string
  quantidade: number
  material: string | null
  comprimento: number | null
  largura: number | null
  altura: number | null
  referencia_externa: string | null
  produto_id: number | null
  produto_nome_sugerido: string | null
  preco_sugerido_centavos: number | null
  observacoes: string | null
}

export interface Projeto {
  id: number
  nome: string
  cliente_id: number | null
  cliente_nome: string | null
  usuario_id: number
  usuario_nome: string | null
  origem: string
  origem_meta: string | null
  origem_ref: string | null
  origem_rev: string | null
  origem_status: 'rascunho' | 'finalizado' | null
  created_at: string
  total_itens: number | null
}

export interface ProjetoDetail extends Projeto {
  itens: ProjetoItem[]
}

export interface AuditLog {
  id: number
  usuario_id: number | null
  vendedor_id: number | null
  acao: string
  detalhes: string
  entidade: string | null
  entidade_id: number | null
  ip: string | null
  created_at: string
  usuario_nome: string | null
}

export interface AuditLogEntry {
  id: number
  acao: string
  detalhes: string
  usuario_nome: string | null
  created_at: string
}

export interface ApiKey {
  id: number
  nome: string
  prefixo: string
  usuario_id: number
  usuario_nome: string | null
  ativo: boolean
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface ApiKeyCreated extends ApiKey {
  chave: string
}

export interface Lancamento {
  id: number
  tipo: 'ENTRADA' | 'SAIDA'
  descricao: string
  categoria: string | null
  valor: number
  status: 'pendente' | 'pago'
  data_vencimento: string
  data_pagamento: string | null
  automatico: boolean
  orcamento_id: number | null
  usuario_id: number
  created_at: string
  vencido: boolean
}

export interface LancamentoInput {
  descricao: string
  categoria?: string | null
  valor: number
  tipo?: 'ENTRADA' | 'SAIDA'
  data_vencimento: string
}

export interface FinanceiroResumo {
  a_receber: number
  recebido_no_periodo: number
  vencidos: number
  margem_media: number | null
  titulos_abertos: number
}

export interface FluxoMensalItem {
  mes: string
  entradas: number
  saidas: number
}

/**
 * Sessão inválida (cookie expirado ou ausente): descarta o marcador local e devolve
 * o usuário ao login. Sem isso a SPA continua "logada" e cada tela cai em dado vazio.
 */
export function encerrarSessao() {
  if (sessionStorage.getItem('arc-session') !== '1') return
  sessionStorage.removeItem('arc-session')
  location.hash = 'login'
  location.reload()
}

let renovacaoEmCurso: Promise<boolean> | null = null

/**
 * Reemite o par de cookies a partir do refresh. Uma renovação por vez: as 4–6 chamadas
 * paralelas do dashboard compartilham a mesma promessa em vez de disparar 4–6 POSTs iguais
 * (e ficar à mercê da ordem em que as respostas gravam o cookie).
 */
function renovarSessao(): Promise<boolean> {
  renovacaoEmCurso ??= fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(response => response.ok)
    .catch(() => false)
    .finally(() => { renovacaoEmCurso = null })
  return renovacaoEmCurso
}

async function request<T>(path: string, init?: RequestInit, jaRenovou = false): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  // 401 por access expirado: renova uma vez e repete. Rotas de /auth/ ficam fora para não virar laço.
  if (response.status === 401 && !jaRenovou && !path.startsWith('/auth/')) {
    if (await renovarSessao()) return request<T>(path, init, true)
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401) { encerrarSessao(); throw new Error('Sessão expirada. Entre novamente para carregar os dados.') }
    if (response.status === 403) throw new Error('Seu perfil não tem permissão para esta ação.')
    throw new Error(data.detail || 'Falha ao comunicar com servidor.')
  }
  return data as T
}

async function portalRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', 'X-Portal-Token': token, ...init?.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401) throw new Error('PORTAL_LINK_INVALIDO')
    throw new Error(data.detail || 'Falha ao carregar o portal.')
  }
  return data as T
}

export function getPortalProposta(token: string) {
  return portalRequest<PortalProposta>('/portal/proposta', token)
}

export function enviarDecisaoPortal(token: string, body: PortalDecisao) {
  return portalRequest<PortalProposta>('/portal/decisao', token, { method: 'POST', body: JSON.stringify(body) })
}

async function baixarPortalArquivo(path: string, token: string, nomeFallback: string) {
  const response = await fetch(`${API}${path}`, { credentials: 'omit', headers: { 'X-Portal-Token': token } })
  if (!response.ok) {
    if (response.status === 401) throw new Error('PORTAL_LINK_INVALIDO')
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Não foi possível baixar o documento.')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1] || nomeFallback
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function baixarDocumentoPortal(token: string, anexoId: number) {
  return baixarPortalArquivo(`/portal/anexos/${anexoId}/download`, token, `documento-${anexoId}`)
}

export function baixarPdfPropostaPortal(token: string) {
  return baixarPortalArquivo('/portal/proposta/pdf', token, 'proposta.pdf')
}

export function gerarPortalLink(orcamentoId: number) {
  return request<PortalLink>(`/orcamentos/${orcamentoId}/portal-link`, { method: 'POST' })
}

export function revogarPortalLink(orcamentoId: number) {
  return request<void>(`/orcamentos/${orcamentoId}/portal-link/revogar`, { method: 'POST' })
}

export function alterarVisibilidadeAnexo(orcamentoId: number, anexoId: number, visivel: boolean) {
  return request<OrcamentoAnexo>(`/orcamentos/${orcamentoId}/anexos/${anexoId}/visibilidade`, {
    method: 'PATCH',
    body: JSON.stringify({ visivel_cliente: visivel }),
  })
}

export function listCatalogProducts() {
  return request<Product[]>('/estoque/produtos?is_catalogo=true&ativo=true')
}

export function listInventoryProducts() {
  return request<Product[]>('/estoque/produtos?ativo=true')
}

export function moveInventory(productId: number, input: { quantidade: number; justificativa: string }) {
  return request<{ mensagem: string; novo_estoque: number }>(`/estoque/movimentar/${productId}`, {
    method: 'POST', body: JSON.stringify(input),
  })
}

export function listCalendarEvents() {
  return request<CalendarEvent[]>('/calendario/entregas')
}

export function listQuotes() {
  return request<Quote[]>('/orcamentos/')
}

export function getQuote(id: number) {
  return request<QuoteDetail>(`/orcamentos/${id}`)
}

export function listQuoteAttachments(id: number) {
  return request<OrcamentoAnexo[]>(`/orcamentos/${id}/anexos`)
}

export function getQuoteHistory(id: number) {
  return request<AuditLogEntry[]>(`/orcamentos/${id}/historico`)
}

export function createQuote(input: QuoteCreateInput) {
  return request<Quote>('/orcamentos/', { method: 'POST', body: JSON.stringify(input) })
}

export function updateQuote(id: number, input: QuoteCreateInput) {
  return request<Quote>(`/orcamentos/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function regenerateQuotePdf(id: number) {
  return request<{ status: string; anexo_url: string }>(`/orcamentos/${id}/regenerate-pdf`, { method: 'POST' })
}

export function updateQuoteStatus(id: number, status: string, cnpjFaturamento?: string) {
  const params = new URLSearchParams({ novo_status: status })
  if (cnpjFaturamento) params.set('cnpj_faturamento', cnpjFaturamento)
  return request<Quote>(`/orcamentos/${id}/status?${params.toString()}`, { method: 'PUT' })
}

export function deleteQuote(id: number) {
  return request<void>(`/orcamentos/${id}`, { method: 'DELETE' })
}

/** Estende `data_fim_locacao`. Só vale para Locacao/Producao já aprovada (a rota recusa o resto). */
export function renovarLocacao(id: number, prazoValor: number, prazoUnidade: 'dias' | 'meses') {
  return request<QuoteDetail>(`/orcamentos/${id}/renovar`, {
    method: 'POST',
    body: JSON.stringify({ prazo_valor: prazoValor, prazo_unidade: prazoUnidade }),
  })
}

export function getOrcamentoConfig() {
  return request<OrcamentoConfig>('/orcamentos/config')
}

/** Restaura os textos padrão do orçamento e apaga os CNPJs de faturamento. Exige admin. */
export function resetOrcamentoConfig() {
  return request<OrcamentoConfig>('/orcamentos/config/reset', { method: 'POST' })
}

export function listPaymentConditions() {
  return request<PaymentCondition[]>('/orcamentos/condicoes-pagamento')
}

export function createPaymentCondition(nome: string) {
  return request<PaymentCondition>('/orcamentos/condicoes-pagamento', { method: 'POST', body: JSON.stringify({ nome }) })
}

export function updatePaymentCondition(id: number, input: { nome?: string; ativo?: boolean }) {
  return request<PaymentCondition>(`/orcamentos/condicoes-pagamento/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deletePaymentCondition(id: number) {
  return request<void>(`/orcamentos/condicoes-pagamento/${id}`, { method: 'DELETE' })
}

export function createCatalogProduct(input: { nome: string; tipo: string; material?: string; preco_venda: number }) {
  return request<Product>('/estoque/produtos', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      preco_custo: input.preco_venda,
      quantidade_estoque: 0,
      estoque_minimo: 5,
      is_catalogo: true,
      ativo: true,
    }),
  })
}

export function updateProduct(id: number, input: { nome?: string; tipo?: string | null; material?: string | null; preco_venda?: number; estoque_minimo?: number; ativo?: boolean }) {
  return request<Product>(`/estoque/produtos/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function listClients() {
  return request<Client[]>('/clientes/')
}

export function getClient(id: number) {
  return request<Client>(`/clientes/${id}`)
}

export function createClient(input: ClientInput) {
  return request<Client>('/clientes/', { method: 'POST', body: JSON.stringify(input) })
}

export function updateClient(id: number, input: ClientInput) {
  return request<Client>(`/clientes/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function deleteClient(id: number) {
  return request<void>(`/clientes/${id}`, { method: 'DELETE' })
}

export function listSuppliers() {
  return request<Supplier[]>('/fornecedores/')
}

export function createSupplier(input: SupplierInput) {
  return request<Supplier>('/fornecedores/', { method: 'POST', body: JSON.stringify(input) })
}

export function updateSupplier(id: number, input: SupplierInput) {
  return request<Supplier>(`/fornecedores/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function deleteSupplier(id: number) {
  return request<void>(`/fornecedores/${id}`, { method: 'DELETE' })
}

export function listProjetos(filtros?: { origem?: string; origem_ref?: string }) {
  const params = new URLSearchParams()
  if (filtros?.origem) params.set('origem', filtros.origem)
  if (filtros?.origem_ref) params.set('origem_ref', filtros.origem_ref)
  const query = params.toString()
  return request<Projeto[]>(`/projetos/${query ? `?${query}` : ''}`)
}

export function getProjeto(id: number) {
  return request<ProjetoDetail>(`/projetos/${id}`)
}

export function deleteProjeto(id: number) {
  return request<void>(`/projetos/${id}`, { method: 'DELETE' })
}

export function updateProjetoItem(projetoId: number, itemId: number, input: Partial<Pick<ProjetoItem, 'nome' | 'quantidade' | 'material' | 'produto_id' | 'preco_sugerido_centavos' | 'observacoes'>>) {
  return request<ProjetoItem>(`/projetos/${projetoId}/itens/${itemId}`, { method: 'PUT', body: JSON.stringify(input) })
}

export async function importarProjetoCsv(file: File, nome: string, clienteId?: number) {
  const form = new FormData()
  form.append('file', file)
  form.append('nome', nome)
  if (clienteId) form.append('cliente_id', String(clienteId))
  // Não usar request<T>() aqui: ele fixa Content-Type: application/json, o que quebraria o boundary do multipart.
  const response = await fetch(`${API}/projetos/importar`, { method: 'POST', credentials: 'include', body: form })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Falha ao importar projeto.')
  return data as ProjetoDetail
}

/** Extensões e limite que `POST /uploads/` aceita — espelhados aqui para recusar antes de subir. */
export const UPLOAD_EXTENSOES = ['.jpg', '.jpeg', '.png', '.webp', '.jfif']
export const UPLOAD_TAMANHO_MAXIMO = 10 * 1024 * 1024

export async function uploadArquivo(file: File) {
  const form = new FormData()
  form.append('file', file)
  // Sem request<T>(): ele fixa Content-Type JSON e quebraria o boundary do multipart.
  const response = await fetch(`${API}/uploads/`, { method: 'POST', credentials: 'include', body: form })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Falha ao enviar o arquivo.')
  return data as { filename: string; url: string }
}

export function updateOrcamentoConfig(input: Partial<Omit<OrcamentoConfig, 'id'>>) {
  return request<OrcamentoConfig>('/orcamentos/config', { method: 'PUT', body: JSON.stringify(input) })
}

export function listLogs() {
  return request<AuditLog[]>('/logs/')
}

export function listApiKeys() {
  return request<ApiKey[]>('/integracoes/api-keys')
}

export function createApiKey(nome: string) {
  return request<ApiKeyCreated>('/integracoes/api-keys', { method: 'POST', body: JSON.stringify({ nome }) })
}

export function revokeApiKey(id: number) {
  return request<void>(`/integracoes/api-keys/${id}`, { method: 'DELETE' })
}

export function getFinanceiroResumo(periodo: 'Mês' | 'Trimestre') {
  return request<FinanceiroResumo>(`/financeiro/resumo?${new URLSearchParams({ periodo })}`)
}

export function listLancamentos(filtros?: { tipo?: 'ENTRADA' | 'SAIDA'; status?: 'pendente' | 'pago' }) {
  const params = new URLSearchParams()
  if (filtros?.tipo) params.set('tipo', filtros.tipo)
  if (filtros?.status) params.set('lancamento_status', filtros.status)
  const query = params.toString()
  return request<Lancamento[]>(`/financeiro/lancamentos${query ? `?${query}` : ''}`)
}

export function createLancamento(input: LancamentoInput) {
  return request<Lancamento>('/financeiro/lancamentos', { method: 'POST', body: JSON.stringify(input) })
}

export function pagarLancamento(id: number) {
  return request<Lancamento>(`/financeiro/lancamentos/${id}/pagar`, { method: 'PATCH' })
}

export function getFluxoMensal() {
  return request<FluxoMensalItem[]>('/financeiro/fluxo-mensal')
}

export async function login(email: string, password: string) {
  const body = new URLSearchParams({ username: email, password })
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST', body, credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Não foi possível entrar.')
  return data
}

export async function forgotPassword(email: string) {
  const response = await fetch(`${API}/auth/forgot-password`, {
    method: 'POST', body: JSON.stringify({ email }), credentials: 'include', headers: { 'Content-Type': 'application/json' },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Falha ao solicitar recuperação de senha.')
  return data as { message: string }
}

export async function resetPassword(token: string, newPassword: string) {
  const response = await fetch(`${API}/auth/reset-password`, {
    method: 'POST', body: JSON.stringify({ token, new_password: newPassword }), credentials: 'include', headers: { 'Content-Type': 'application/json' },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Falha ao redefinir senha.')
  return data as { message: string }
}

export async function mfaLogin(mfaToken: string, code: string) {
  const response = await fetch(`${API}/auth/mfa-login`, {
    method: 'POST', body: JSON.stringify({ mfa_token: mfaToken, code }), credentials: 'include', headers: { 'Content-Type': 'application/json' },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Código inválido.')
  return data
}

export function listTeam() {
  return request<TeamMember[]>('/usuarios/')
}

export function createTeamMember(input: TeamMemberInput) {
  return request<TeamMember>('/usuarios/', { method: 'POST', body: JSON.stringify(input) })
}

export function updateTeamMember(id: number, input: TeamMemberUpdate) {
  return request<TeamMember>(`/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function deactivateTeamMember(id: number) {
  return request<{ status: string }>(`/usuarios/${id}`, { method: 'DELETE' })
}

export async function getSessionUser() {
  const response = await fetch(`${API}/usuarios/me`, { credentials: 'include' })
  if (!response.ok) throw new Error('Sessão expirada')
  return response.json() as Promise<TeamMember>
}

export function enableMfa() {
  return request<{ secret: string; qr_code_url: string }>('/auth/enable-mfa', { method: 'POST' })
}

export function verifyMfa(code: string) {
  return request<{ status: string }>(`/auth/verify-mfa?${new URLSearchParams({ code })}`, { method: 'POST' })
}

export function disableMfa(password: string) {
  return request<{ status: string }>('/auth/disable-mfa', { method: 'POST', body: JSON.stringify({ password }) })
}

export async function logout() {
  await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' })
}
