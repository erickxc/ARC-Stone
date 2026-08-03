const API = '/api'

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Falha ao comunicar com servidor.')
  return data as T
}

export function listCatalogProducts() {
  return request<Product[]>('/estoque/produtos?is_catalogo=true&ativo=true')
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

export async function login(email: string, password: string) {
  const body = new URLSearchParams({ username: email, password })
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST', body, credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Não foi possível entrar.')
  return data
}

export async function getSessionUser() {
  const response = await fetch(`${API}/usuarios/me`, { credentials: 'include' })
  if (!response.ok) throw new Error('Sessão expirada')
  return response.json()
}

export async function logout() {
  await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' })
}
