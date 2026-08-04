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
  itens: Array<{ quantidade: number; preco_unitario_aplicado: number; nome?: string | null }>
}

export interface QuoteCreateInput {
  cliente_id: number
  tipo_orcamento: 'Venda' | 'Locacao' | 'Producao'
  vendedor_id?: number | null
  condicoes_pagamento_selecionadas?: string | null
  projeto_id?: number | null
  itens: Array<{ quantidade: number; preco_unitario_aplicado: number; produto_id?: number | null; is_externo?: boolean; nome_externo?: string | null; descricao_externa?: string | null; projeto_item_id?: number | null }>
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sessão expirada. Entre novamente para carregar os dados.')
    if (response.status === 403) throw new Error('Seu perfil não tem permissão para esta ação.')
    throw new Error(data.detail || 'Falha ao comunicar com servidor.')
  }
  return data as T
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

export function getOrcamentoConfig() {
  return request<OrcamentoConfig>('/orcamentos/config')
}

export function listPaymentConditions() {
  return request<PaymentCondition[]>('/orcamentos/condicoes-pagamento')
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

export function listProjetos() {
  return request<Projeto[]>('/projetos/')
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

export async function login(email: string, password: string) {
  const body = new URLSearchParams({ username: email, password })
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST', body, credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Não foi possível entrar.')
  return data
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
  return response.json()
}

export async function logout() {
  await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' })
}
