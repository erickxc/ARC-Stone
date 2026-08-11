import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { alterarVisibilidadeAnexo, baixarDocumentoPortal, baixarPdfPropostaPortal, converterEmVenda, createApiKey, createCatalogProduct, createClient, createEquipamento, createLancamento, createMateriaPrima, createPerda, createQuote, createServico, createSupplier, createTeamMember, deactivateTeamMember, deleteClient, deleteEquipamento, deleteMateriaPrima, deleteProjeto, deleteQuote, deleteServico, deleteSupplier, disableMfa, enableMfa, encerrarSessao, enviarDecisaoPortal, forgotPassword, gerarPortalLink, getClient, getFinanceiroResumo, getFluxoMensal, getOrcamentoConfig, getPortalProposta, getProjeto, getQuote, getQuoteHistory, getSessionUser, importarProjetoCsv, listApiKeys, listCalendarEvents, listCatalogProducts, listClients, listEquipamentos, listInventoryProducts, listLancamentos, listLogs, listMateriaPrima, listPaymentConditions, listPerdas, listProjetos, listQuoteAttachments, listQuotes, listServicos, listSuppliers, listTeam, listVendas, login, logout, mfaLogin, moveInventory, pagarLancamento, regenerateQuotePdf, resetOrcamentoConfig, resetPassword, revogarPortalLink, revokeApiKey, updateEquipamento, updateOrcamentoConfig, updateProduct, updateQuote, updateQuoteStatus, updateTeamMember, uploadArquivo, UPLOAD_EXTENSOES, UPLOAD_TAMANHO_MAXIMO, verifyMfa, catalogoCondicoesPagamento, catalogoTiposPagamento, catalogoFormasPagamento, catalogoLocais, catalogoMotivosPerda, listServicoComponentes, consultarCep, updateClient, createServicoComponente, updateServicoComponente, deleteServicoComponente, catalogoEtapasProducao, listOrdensProducao, moverOrdemProducao, getOrdemProducao, atualizarOrdemProducao } from './api'
import type { ApiKey, ApiKeyCreated, AuditLog, AuditLogEntry, CalendarEvent, Client, ClientInput, Equipamento, EquipamentoInput, FinanceiroResumo, FluxoMensalItem, Lancamento, MateriaPrima, MateriaPrimaInput, OrcamentoAnexo, OrcamentoConfig, PaymentCondition, PerdaAvaria, PerdaAvariaInput, PortalLink, PortalProposta, Product, Projeto, ProjetoDetail, Quote, QuoteDetail as QuoteData, QuoteItem, Servico, ServicoInput, Supplier, SupplierInput, TeamMember, TeamMemberInput, Venda, TipoOrcamento, Modalidade, UnidadeMedida, TipoPagamento, FormaPagamento, Local, ItemCatalogo, AcoesCatalogo, ServicoComponente, QuoteCreateInput, TipoPessoa, PreferenciaContato, EtapaProducao, OrdemProducao } from './api'
import { money } from './data'
import type { Status } from './data'

type Route = 'dashboard' | 'clients' | 'pipeline' | 'builder' | 'producao' | 'quotesList' | 'salesHistory' | 'projects' | 'catalog' | 'servicesCatalog' | 'inventory' | 'suppliers' | 'losses' | 'equipment' | 'schedule' | 'finance' | 'team' | 'orcamentoConfig' | 'integrations' | 'logs' | 'profile' | 'orcamento'
const routes: Route[] = ['dashboard', 'clients', 'pipeline', 'builder', 'producao', 'quotesList', 'salesHistory', 'projects', 'catalog', 'servicesCatalog', 'inventory', 'suppliers', 'losses', 'equipment', 'schedule', 'finance', 'team', 'orcamentoConfig', 'integrations', 'logs', 'profile']

type IconName = Exclude<Route, 'orcamento'> | 'menu' | 'close'
const iconPaths: Record<IconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  clients: <><circle cx="12" cy="8" r="3.25"/><path d="M5.5 21v-2.2a6.5 6.5 0 0 1 13 0V21"/></>,
  pipeline: <><path d="M4 5h5v14H4zM15 5h5v9h-5z"/><path d="M9 9h6M12 6v6"/></>,
  builder: <><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></>,
  projects: <><path d="M3 6.5h6l2 2h10v10.5H3z"/><path d="M3 6.5V5h5l2 1.5"/></>,
  catalog: <><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></>,
  inventory: <><path d="M3 7h18v13H3zM7 7V4h10v3"/><path d="M8 12h8"/></>,
  suppliers: <><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
  schedule: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  finance: <><path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/></>,
  team: <><circle cx="9" cy="8" r="3"/><circle cx="18" cy="9" r="2.5"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M15 15a5 5 0 0 1 6 4.9V21"/></>,
  integrations: <><circle cx="7" cy="12" r="3.2"/><circle cx="17" cy="12" r="3.2"/><path d="M10.2 12h3.6"/></>,
  logs: <><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/></>,
  quotesList: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></>,
  salesHistory: <><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></>,
  servicesCatalog: <><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.97 7.97 0 0 0 0-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 3h-4l-.3 2a8 8 0 0 0-1.7 1l-2.4-1-2 3.5L6.6 11a8 8 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1L11 21h4l.3-2a8 8 0 0 0 1.7-1l2.4 1 2-3.5Z"/></>,
  losses: <><path d="M12 2 2 21h20L12 2Z"/><path d="M12 9v5M12 17h.01"/></>,
  equipment: <><rect x="3" y="10" width="14" height="7" rx="1"/><path d="M17 12h2l2 2v3h-4M7 17v3M11 17v3"/></>,
  profile: <><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></>,
  orcamentoConfig: <><path d="M4 5h16M4 12h16M4 19h9"/><circle cx="9" cy="5" r="2"/><circle cx="15" cy="12" r="2"/></>,
  producao: <><path d="M3 17h18M6 17V9l4-3 4 3v8"/><path d="M14 12h5v5"/><circle cx="7" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
}

function Icon({ name }: { name: IconName }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>
}

type Rota = { nome: Route; id?: number }

function lerHash(): Rota {
  const bruto = location.hash.slice(1)
  const [nome, param] = bruto.split('/')
  const comId = param && /^\d+$/.test(param)
  if (nome === 'orcamento' && comId) return { nome: 'orcamento', id: Number(param) }
  if (comId && routes.includes(nome as Route)) return { nome: nome as Route, id: Number(param) }
  return { nome: routes.includes(bruto as Route) ? (bruto as Route) : 'dashboard' }
}

/** Lockup da co-marca: a marca do produto manda, o nome do escritorio entra subordinado. */
function Logo({ compact = false, escritorio }: { compact?: boolean; escritorio?: string | null }) {
  const nome = escritorio?.trim()
  return <div className="logo" aria-label="ARC"><svg className="logo-mark" viewBox="0 0 40 40" aria-hidden="true"><path fill="#D9633C" d="M2 2h36v13.2C25.4 15.2 15.2 25.4 15.2 38H2V2Z"/><path fill="#F8F6F0" d="M15.2 38C15.2 25.4 25.4 15.2 38 15.2v8.2A14.6 14.6 0 0 0 23.4 38h-8.2Z"/><path fill="#2E2C29" d="M23.4 38A14.6 14.6 0 0 1 38 23.4V38H23.4Z"/><circle cx="11" cy="11" r="3.2" fill="#E2A44C"/></svg>{!compact && <strong>ARC</strong>}{!compact && nome && <em className="logo-cobranca"><i>•</i>{nome}</em>}</div>
}

function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone || String(children).toLowerCase()}`}>{children}</span>
}

function Button({ children, variant = 'primary', onClick, type = 'button', disabled = false, loading = false, title }: { children: ReactNode; variant?: string; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; loading?: boolean; title?: string }) {
  return <button className={`button ${variant}${loading ? ' loading' : ''}`} onClick={onClick} type={type} disabled={disabled || loading} aria-busy={loading || undefined} title={title}>{children}</button>
}

/**
 * Confirmação por pressão contínua, para ação destrutiva que não deve depender de `confirm()`.
 * Clique curto não faz nada: a ação só dispara quando a barra interna termina de encher, e
 * soltar antes zera o progresso. O teclado segura com Espaço/Enter, senão a ação ficaria
 * inalcançável sem ponteiro.
 */
function HoldButton({ children, onConfirm, duracaoMs = 1500, variant = 'danger', disabled = false, rotuloSegurando = 'Segure para confirmar…', compacto = false, title }: { children: ReactNode; onConfirm: () => void; duracaoMs?: number; variant?: string; disabled?: boolean; rotuloSegurando?: string; compacto?: boolean; title?: string }) {
  const [progresso, setProgresso] = useState(0)
  const segurando = useRef(false)
  const quadro = useRef<number | null>(null)
  const disparou = useRef(false)

  const parar = useCallback(() => {
    segurando.current = false
    if (quadro.current !== null) cancelAnimationFrame(quadro.current)
    quadro.current = null
    setProgresso(0)
  }, [])

  // Sair da tela no meio da pressão deixaria um requestAnimationFrame vivo mexendo em estado morto.
  useEffect(() => parar, [parar])

  function iniciar() {
    if (disabled || segurando.current) return
    segurando.current = true
    disparou.current = false
    const inicio = performance.now()
    const passo = (agora: number) => {
      if (!segurando.current) return
      const fracao = Math.min(1, (agora - inicio) / duracaoMs)
      setProgresso(fracao)
      if (fracao >= 1) {
        // Guarda contra disparo duplo: o quadro final pode chegar junto do pointerup.
        if (!disparou.current) { disparou.current = true; parar(); onConfirm() }
        return
      }
      quadro.current = requestAnimationFrame(passo)
    }
    quadro.current = requestAnimationFrame(passo)
  }

  const ativo = progresso > 0
  return <button type="button" disabled={disabled} title={title}
    className={`button ${variant} hold-button${compacto ? ' compacto' : ''}${ativo ? ' segurando' : ''}`}
    onPointerDown={iniciar} onPointerUp={parar} onPointerLeave={parar} onPointerCancel={parar}
    onKeyDown={event => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); iniciar() } }}
    onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') parar() }}
    onContextMenu={event => event.preventDefault()}>
    <i className="hold-trilha" style={{ transform: `scaleX(${progresso})` }} aria-hidden="true" />
    <span>{ativo ? rotuloSegurando : children}</span>
  </button>
}

/** Estado vazio do design system: marca, título, descrição e uma ação de saída. */
function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="empty-state"><Logo compact /><h2>{title}</h2>{description && <p>{description}</p>}{action}</div>
}

/** Esqueleto de carregamento: ocupa o lugar do conteúdo em vez de trocar a tela por texto. */
function Skeleton({ rows = 4, label = 'Carregando' }: { rows?: number; label?: string }) {
  return <div className="skeleton" role="status" aria-label={label}>{Array.from({ length: rows }, (_, i) => <i key={i} />)}</div>
}

/** Liga/desliga do design system, para ação booleana de efeito real (não para filtro). */
function Toggle({ checked, onChange, label, disabled = false, ariaLabel }: { checked: boolean; onChange: (valor: boolean) => void; label?: string; disabled?: boolean; ariaLabel?: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={ariaLabel} disabled={disabled}
    className={`toggle${checked ? ' on' : ''}`} onClick={() => onChange(!checked)}><i />{label && <span>{label}</span>}</button>
}

export type ComboOption = { value: string; label: string; meta?: string }

/**
 * Combobox do design system: rótulo acima, busca dentro do campo, meta à direita em mono
 * e criação inline opcional. Substitui o select nativo, cuja lista o SO desenha fora do padrão.
 * Publica `name` como input oculto para continuar funcionando com FormData.
 */
function Combobox({ options, value, onChange, placeholder = 'Selecionar…', searchPlaceholder = 'Buscar…', name, ariaLabel, disabled = false, compact = false, onCreate, createLabel = 'Criar' }: {
  options: ComboOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  name?: string
  ariaLabel?: string
  disabled?: boolean
  compact?: boolean
  onCreate?: (termo: string, criado?: Client) => void
  createLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [termo, setTermo] = useState('')
  const [ativo, setAtivo] = useState(0)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickError, setQuickError] = useState('')
  const [quickCreated, setQuickCreated] = useState<Client | null>(null)
  const idLista = useId()
  const raiz = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const gatilho = useRef<HTMLButtonElement>(null)

  const filtradas = options.filter(option => `${option.label} ${option.meta || ''}`.toLowerCase().includes(termo.trim().toLowerCase()))
  const podeCriar = Boolean(onCreate && termo.trim() && !options.some(option => option.label.toLowerCase() === termo.trim().toLowerCase()))
  const selecionada = options.find(option => option.value === value) || (quickCreated && String(quickCreated.id) === value ? { value, label: quickCreated.nome_fantasia } : undefined)
  const mostrarMeta = !['Cliente', 'Produto', 'Serviço'].includes(ariaLabel || '')

  useEffect(() => {
    if (!open) return
    campo.current?.focus()
    const foraDoCampo = (event: PointerEvent) => { if (!raiz.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', foraDoCampo)
    return () => document.removeEventListener('pointerdown', foraDoCampo)
  }, [open])

  function abrir() {
    if (disabled) return
    setTermo(''); setAtivo(0); setOpen(true)
  }

  function fechar(devolverFoco = true) {
    setOpen(false)
    if (devolverFoco) gatilho.current?.focus()
  }

  function escolher(option: ComboOption) {
    onChange(option.value)
    fechar()
  }

  async function salvarClienteRapido(input: ClientInput) {
    setQuickSaving(true); setQuickError('')
    try { const criado = await createClient(input); setQuickCreated(criado); onChange(String(criado.id)); onCreate?.('', criado); setQuickOpen(false) }
    catch (err) { setQuickError(err instanceof Error ? err.message : 'Falha ao salvar cliente.') }
    finally { setQuickSaving(false) }
  }

  function aoDigitar(event: ReactKeyboardEvent<HTMLInputElement>) {
    // Sem resultado a faixa é vazia: o índice precisa parar em 0, senão o Enter escolhe undefined.
    const ultimo = Math.max(0, filtradas.length - (podeCriar ? 0 : 1))
    if (event.key === 'ArrowDown') { event.preventDefault(); setAtivo(indice => Math.min(indice + 1, ultimo)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setAtivo(indice => Math.max(indice - 1, 0)) }
    else if (event.key === 'Enter') {
      event.preventDefault()
      const escolhida = filtradas[ativo]
      if (escolhida) escolher(escolhida)
      else if (podeCriar) { onCreate?.(termo.trim()); fechar() }
    }
    else if (event.key === 'Escape') { event.preventDefault(); fechar() }
    else if (event.key === 'Tab') setOpen(false)
  }

  // O cartão do kanban abre o orçamento no clique e no Enter; o campo não pode disparar isso.
  return <div className={`combobox${open ? ' open' : ''}${compact ? ' compact' : ''}`} ref={raiz} data-combobox
    onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    {name && <input type="hidden" name={name} value={value} />}
    {open
      ? <input ref={campo} className="combobox-busca" value={termo} placeholder={searchPlaceholder} aria-label={ariaLabel || searchPlaceholder}
          role="combobox" aria-expanded aria-controls={idLista} aria-autocomplete="list"
          onChange={event => { setTermo(event.target.value); setAtivo(0) }} onKeyDown={aoDigitar} />
      : <button ref={gatilho} type="button" className="combobox-gatilho" disabled={disabled} aria-label={ariaLabel}
          aria-expanded={false} aria-haspopup="listbox" onClick={abrir}
          onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); abrir() } }}>
          <span className={selecionada ? '' : 'combobox-vazio'}>{selecionada?.label || placeholder}</span>
          {mostrarMeta && selecionada?.meta && <em className="combobox-meta">{selecionada.meta}</em>}
        </button>}
    {ariaLabel === 'Cliente' && <button type="button" className="combobox-quick-create" onClick={() => { setQuickError(''); setQuickOpen(true) }} aria-label="Cadastrar novo cliente">+</button>}
    {open && <div className="combobox-pop" id={idLista} role="listbox" aria-label={ariaLabel}>
      {filtradas.map((option, indice) => <button key={option.value} type="button" role="option" aria-selected={option.value === value}
        className={indice === ativo ? 'ativo' : ''} onPointerEnter={() => setAtivo(indice)} onClick={() => escolher(option)}>
        <span>{option.label}</span>{mostrarMeta && option.meta && <em className="combobox-meta">{option.meta}</em>}
      </button>)}
      {podeCriar && <button type="button" className={`combobox-criar${ativo >= filtradas.length ? ' ativo' : ''}`}
        onPointerEnter={() => setAtivo(filtradas.length)} onClick={() => { onCreate?.(termo.trim()); fechar() }}>
        + {createLabel} “{termo.trim()}”
      </button>}
      {!filtradas.length && !podeCriar && <p className="combobox-nada">Nada encontrado.</p>}
    </div>}
    {quickOpen && <Drawer title="Novo cliente" close={() => setQuickOpen(false)}><ClienteFormulario modo="criacao" salvando={quickSaving} onSubmit={salvarClienteRapido} />{quickError && <p className="form-error" role="alert">{quickError}</p>}</Drawer>}
  </div>
}

type SidebarProps = { route: Route; go: (r: Route) => void; collapsed: boolean; setCollapsed: (v: boolean) => void; mobileOpen: boolean; closeMobile: () => void; escritorio?: string | null; tema: 'light' | 'dark'; alternarTema: () => void }

type NavGroup = { label: string; items: [Route, string, string, IconName][] }

const navGroups: NavGroup[] = [
  { label: 'Orçamentos', items: [
    ['quotesList', 'Listagem de orçamentos', '', 'quotesList'],
    ['projects', 'Projetos', '', 'projects'],
  ] },
  { label: 'Vendas', items: [
    ['pipeline', 'Pipeline de vendas', '18', 'pipeline'],
    ['salesHistory', 'Histórico de vendas', '', 'salesHistory'],
  ] },
  { label: 'Galpão', items: [
    ['catalog', 'Catálogo de produtos', '', 'catalog'],
    ['servicesCatalog', 'Catálogo de serviços', '', 'servicesCatalog'],
    ['suppliers', 'Fornecedores', '', 'suppliers'],
    ['losses', 'Perdas e Avarias', '', 'losses'],
    ['equipment', 'Equipamentos', '', 'equipment'],
    ['inventory', 'Controle de estoque', '7', 'inventory'],
    ['producao', 'Esteira de produção', '', 'producao'],
  ] },
  { label: 'Gestão', items: [
    ['schedule', 'Calendário de entregas', '', 'schedule'],
    ['clients', 'Carteira de clientes', '', 'clients'],
    ['finance', 'Painel financeiro', '', 'finance'],
    ['team', 'Equipe', '', 'team'],
  ] },
]

/** Grupos ancorados no rodapé da sidebar — não rolam junto com a navegação principal. */
const navGroupsFixos: NavGroup[] = [
  { label: 'Configurações', items: [
    ['orcamentoConfig', 'Configurações do orçamento', '', 'orcamentoConfig'],
    ['integrations', 'Integrações', '', 'integrations'],
    ['logs', 'Logs de auditoria', '', 'logs'],
  ] },
  { label: 'Meu Perfil', items: [
    ['profile', 'Meu Perfil', '', 'profile'],
  ] },
]

function SidebarGroup({ group, route, collapsed, onNavigate }: { group: NavGroup; route: Route; collapsed: boolean; onNavigate: (r: Route) => void }) {
  const ativo = group.items.some(([key]) => key === route)
  const [manualOpen, setManualOpen] = useState<boolean | null>(() => {
    const salvo = localStorage.getItem(`arc-menu-grupo-${group.label}`)
    return salvo === null ? null : salvo === '1'
  })
  const aberto = manualOpen ?? ativo
  const alternar = () => {
    const proximo = !aberto
    localStorage.setItem(`arc-menu-grupo-${group.label}`, proximo ? '1' : '0')
    setManualOpen(proximo)
  }
  if (collapsed) return <>{group.items.map(([key, label, , itemIcon]) => <button key={key} className={route === key ? 'active' : ''} onClick={() => onNavigate(key)} title={label}><span><Icon name={itemIcon}/></span></button>)}</>
  return <div className={`nav-group ${aberto ? 'open' : ''}`}>
    <button type="button" className="nav-group-head" onClick={alternar} aria-expanded={aberto}>
      <span className="nav-label">{group.label}</span>
      <svg className="nav-chevron" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
    </button>
    {aberto && group.items.map(([key, label, count, itemIcon]) => <button key={key} className={route === key ? 'active' : ''} onClick={() => onNavigate(key)} title={label}><span><Icon name={itemIcon}/></span>{label}<em>{count}</em></button>)}
  </div>
}

function Sidebar(props: SidebarProps) {
  const { route, go, collapsed, setCollapsed, mobileOpen, closeMobile, escritorio, tema, alternarTema } = props
  const navigate = (next: Route) => { go(next); closeMobile() }
  return <><button className={`sidebar-scrim ${mobileOpen ? 'show' : ''}`} onClick={closeMobile} aria-label="Fechar menu lateral"/><aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
    <div className="side-head"><Logo compact={collapsed} escritorio={escritorio} /><button className="mobile-close" onClick={closeMobile} aria-label="Fechar menu"><Icon name="close"/></button><button className="collapse" onClick={alternarTema} aria-label={tema === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>{tema === 'dark' ? '☀' : '☾'}</button><button className="collapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>«</button></div>
    <Button onClick={() => navigate('builder')} title="Novo orçamento"><Icon name="builder"/>{!collapsed && ' Novo orçamento'}</Button>
    <button className={`nav-top ${route === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')} title="Dashboard"><span><Icon name="dashboard"/></span>{!collapsed && 'Dashboard'}</button>
    <nav>
      {navGroups.map(group => <SidebarGroup key={group.label} group={group} route={route} collapsed={collapsed} onNavigate={navigate} />)}
    </nav>
    <nav className="nav-fixo">
      {navGroupsFixos.map(group => <SidebarGroup key={group.label} group={group} route={route} collapsed={collapsed} onNavigate={navigate} />)}
    </nav>
    <button className="user-card" onClick={async () => { await logout(); location.hash = 'login'; location.reload() }}><span>C</span>{!collapsed && <><b>Cissa<small>ADMIN</small></b><i>⌄</i></>}</button>
  </aside></>
}

function AppShell({ route, go, children }: { route: Route; go: (r: Route) => void; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tema, setTema] = useState<'light' | 'dark'>(() =>
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
  const alternarTema = () => {
    const novo = tema === 'dark' ? 'light' : 'dark'
    setTema(novo)
    localStorage.setItem('arc-tema', novo)
    if (novo === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
  }
  const [escritorio, setEscritorio] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    getOrcamentoConfig().then(config => { if (vivo) setEscritorio(config.organizacao_nome?.trim() || null) }).catch(() => undefined)
    return () => { vivo = false }
  }, [])
  useEffect(() => { document.title = escritorio ? `ARC • ${escritorio}` : 'ARC ERP' }, [escritorio])
  return <div className={`app ${collapsed ? 'rail' : ''}`}><Sidebar tema={tema} alternarTema={alternarTema} escritorio={escritorio} route={route} go={go} collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} closeMobile={()=>setMobileOpen(false)} /><div className="app-body"><header className="mobile-topbar"><button onClick={()=>setMobileOpen(true)} aria-label="Abrir menu"><Icon name="menu"/></button><Logo escritorio={escritorio}/><button className="mobile-avatar" aria-label="Abrir perfil" onClick={()=>go('profile')}>C</button></header><main className="content">{children}</main></div></div>
}

function PageHead({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return <header className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div>{actions && <div className="actions">{actions}</div>}</header>
}

function Kpi({ label, value, note, dark }: { label: string; value: string; note: string; dark?: boolean }) {
  return <article className={`card kpi ${dark ? 'dark' : ''}`}><p className="mono">{label}</p><strong>{value}</strong><small>{note}</small></article>
}

const statusValues: [Status, number, number][] = [['Gerando', 14, 22], ['Planejando', 26, 41], ['Enviado', 43, 68], ['Ajuste', 8, 30], ['Aprovado', 34, 53], ['Perdido', 11, 17]]
const tipoOrcamentoOptions: ComboOption[] = [
  { value: 'Obra', label: 'Obra', meta: 'produtos e serviços' },
  { value: 'Projeto', label: 'Projeto', meta: 'produtos e serviços' },
  { value: 'Peça', label: 'Peça', meta: 'só produtos' },
  { value: 'Externo', label: 'Externo', meta: 'peça de terceiro' },
]
const prazoOptions: ComboOption[] = [{ value: '', label: 'Sem prazo' }, { value: 'dias', label: 'dias' }, { value: 'meses', label: 'meses' }]
const perfilOptions: ComboOption[] = [{ value: 'vendedor', label: 'Vendedor' }, { value: 'estoquista', label: 'Estoquista' }, { value: 'admin', label: 'Admin' }]
const statusOptions: ComboOption[] = statusValues.map(([status]) => ({ value: status, label: status }))


const backendStatusByColumn: Record<Status, string> = { Gerando: 'Gerando orçamento', Planejando: 'Planejando', Enviado: 'Orçamento gerado', Ajuste: 'Ajuste solicitado', Aprovado: 'Aprovado', Perdido: 'Orçamento negado' }
const columnByBackendStatus: Record<string, Status> = { 'Gerando orçamento': 'Gerando', 'Planejando': 'Planejando', 'Orçamento gerado': 'Enviado', 'Ajuste solicitado': 'Ajuste', 'Aprovado': 'Aprovado', 'Orçamento negado': 'Perdido', 'Entregue': 'Aprovado', 'Faturado': 'Aprovado', 'Devolvido': 'Perdido' }
function DailyGrossProfitChart({ vendas, lancamentos, loading }: { vendas: Venda[]; lancamentos: Lancamento[]; loading: boolean }) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1)
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const primeiroDiaGrafico = new Date(ontem); primeiroDiaGrafico.setDate(ontem.getDate() - 9)
  const inicioGrafico = primeiroDiaGrafico < inicioMes ? inicioMes : primeiroDiaGrafico
  const dias = Array.from({ length: Math.max(1, Math.floor((ontem.getTime() - inicioGrafico.getTime()) / 86400000) + 1) }, (_, index) => { const dia = new Date(inicioGrafico); dia.setDate(inicioGrafico.getDate() + index); return dia })
  const inicioMedia = new Date(hoje); inicioMedia.setDate(hoje.getDate() - 29)
  const mesmoDia = (data: string | null, dia: Date) => { if (!data) return false; const d = new Date(data); return d.getFullYear() === dia.getFullYear() && d.getMonth() === dia.getMonth() && d.getDate() === dia.getDate() }
  const receita = (dia: Date) => vendas.filter(v => mesmoDia(v.data_venda, dia)).reduce((t, v) => t + v.valor_total, 0) / 100 + lancamentos.filter(l => l.tipo === 'ENTRADA' && mesmoDia(l.data_pagamento || l.data_vencimento, dia)).reduce((t, l) => t + l.valor, 0) / 100
  const despesas = lancamentos.filter(l => l.tipo === 'SAIDA' && new Date(l.data_pagamento || l.data_vencimento) >= inicioMedia).reduce((t, l) => t + l.valor, 0) / 100
  const media = despesas / 30
  const pontos = dias.map(dia => ({ dia, receita: receita(dia), lucro: receita(dia) - media }))
  const escala = Math.max(1, ...pontos.map(p => Math.max(Math.abs(p.receita), Math.abs(p.lucro), media)))
  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })
  return <article className="card profit-card"><div className="card-title"><div><p className="eyebrow">FINANCEIRO · PROJEÇÃO DIÁRIA</p><h2>Lucro bruto diário</h2></div><span className="mono">MÉDIA DE DESPESAS · 30 DIAS</span></div><div className="profit-summary"><strong>{loading ? '...' : moeda.format(pontos[6].lucro)}</strong><span>estimativa de hoje</span><em>{loading ? '...' : `${moeda.format(media)} / dia em despesas médias`}</em></div><div className="profit-chart" aria-label="Gráfico de lucro bruto diário dos últimos sete dias">{pontos.map(p => <div className="profit-day" key={p.dia.toISOString()}><div className="profit-bars"><i style={{ height: `${Math.max(3, Math.round(Math.abs(p.receita) / escala * 100))}%` }} title={`Receitas: ${moeda.format(p.receita)}`} /><b className={p.lucro < 0 ? 'negative' : ''} style={{ height: `${Math.max(3, Math.round(Math.abs(p.lucro) / escala * 100))}%` }} title={`Lucro: ${moeda.format(p.lucro)}`} /></div><span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(p.dia).replace('.', '')}</span><small>{p.dia.getDate()}</small></div>)}</div><footer className="profit-legend"><span><i className="revenue-key" />Receitas</span><span><i className="profit-key" />Lucro projetado</span><span><i className="expense-key" />Despesa média: {moeda.format(media)}/dia</span></footer></article>
}

function DashboardWithOperations() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userName, setUserName] = useState('')
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  useEffect(() => { let mounted = true; Promise.all([listQuotes(), listInventoryProducts(), listCalendarEvents(), getSessionUser()]).then(([q, p, e, u]) => { if (!mounted) return; setQuotes(q); setProducts(p); setEvents(e); setUserName(String(u.nome || '').split(' ')[0]) }).catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar o painel.') }).finally(() => { if (mounted) setLoading(false) }); return () => { mounted = false } }, [])
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const proximos = events.filter(e => new Date(e.start) >= hoje).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()).slice(0, 5)
  const entregas = proximos.filter(e => e.tipo.toLowerCase().includes('entrega'))
  const instalacoes = proximos.filter(e => e.tipo.toLowerCase().includes('instal'))
  const criticos = products.filter(p => p.quantidade_estoque <= p.estoque_minimo)
  const producao = quotes.filter(q => ['Planejando', 'OrÃ§amento gerado', 'Ajuste solicitado'].includes(q.status))
  const aprovados = quotes.filter(q => ['Aprovado', 'Entregue', 'Faturado'].includes(q.status))
  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })
  const curto = (v: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(v)).replace('.', '')
  const label = (s: string) => ({ 'Planejando': 'Em produção', 'OrÃ§amento gerado': 'Aguardando cliente', 'Ajuste solicitado': 'Ajuste pendente' }[s] || s)
  return <><PageHead eyebrow="OPERAÇÃO · MARMORARIA" title={userName ? `Bom dia, ${userName}.` : 'Bom dia.'} subtitle="Acompanhe o que precisa sair da bancada, do galpão e da obra hoje." actions={<><Button variant="secondary" onClick={() => { location.hash = 'schedule'; location.reload() }}>Ver agenda</Button><Button onClick={() => { location.hash = 'builder'; location.reload() }}>Novo orçamento</Button></>} />{error && <p className="form-error" role="alert">{error}</p>}<section className="kpi-grid dashboard-kpis"><Kpi label="EM PRODUÇÃO" value={loading ? '...' : String(producao.length)} note={`${moeda.format(producao.reduce((t, q) => t + (q.valor_total || 0), 0) / 100)} em pedidos`} /><Kpi label="ENTREGAS / 7 DIAS" value={loading ? '...' : String(entregas.length)} note={`${instalacoes.length} instalação${instalacoes.length === 1 ? '' : 'ões'} programada${instalacoes.length === 1 ? '' : 's'}`} /><Kpi label="ESTOQUE CRÍTICO" value={loading ? '...' : String(criticos.length)} note={criticos.length ? 'reposição necessária' : 'tudo dentro do mínimo'} /><Kpi dark label="PEDIDOS APROVADOS" value={loading ? '...' : String(aprovados.length)} note="prontos para o próximo passo" /></section><section className="dashboard-grid marmoraria-dashboard"><article className="card span-two production-card"><div className="card-title"><div><p className="eyebrow">CHÃO DE FÁBRICA</p><h2>Pedidos que pedem atenção</h2></div><button className="text-action" onClick={() => { location.hash = 'pipeline'; location.reload() }}>Abrir produção →</button></div>{producao.slice(0, 5).map(q => <div className="production-row" key={q.id}><span className="production-dot" /><div><b>{q.cliente_nome || 'Cliente sem nome'}</b><small>{q.itens?.[0]?.nome || q.tipo_orcamento} · {q.itens?.length || 0} item(ns)</small></div><Badge tone="info">{label(q.status)}</Badge><strong>{moeda.format((q.valor_total || 0) / 100)}</strong></div>)}{!producao.length && <p className="empty-state">Nenhum pedido em produção no momento.</p>}</article><article className="card attention-card"><div className="card-title"><h2>Próximos compromissos</h2><span className="mono">7 DIAS</span></div>{proximos.length ? <ul className="events">{proximos.map(e => <li key={e.id}><i className={e.tipo.toLowerCase().includes('entrega') ? 'success' : 'warning'} /><span><b>{e.tipo}</b><small>{e.cliente_nome || e.title}</small></span><em>{curto(e.start)}</em></li>)}</ul> : <p className="empty-state">Agenda livre nos próximos dias.</p>}</article><article className="card stock-card"><div className="card-title"><div><p className="eyebrow">GALPÃO</p><h2>Estoque para repor</h2></div><button className="text-action" onClick={() => { location.hash = 'inventory'; location.reload() }}>Ver estoque →</button></div>{criticos.slice(0, 4).map(p => <div className="stock-row" key={p.id}><span className="material-chip">{(p.material || p.tipo || 'MP').slice(0, 2).toUpperCase()}</span><div><b>{p.nome}</b><small>{p.material || 'Matéria-prima'}</small></div><strong>{p.quantidade_estoque} <small>un.</small></strong></div>)}{!criticos.length && <p className="empty-state">Nenhum item abaixo do mínimo.</p>}</article><article className="card calendar"><div className="card-title"><div><p className="eyebrow">CAPACIDADE DA SEMANA</p><h2>Entregas e instalações</h2></div><span className="mono">{entregas.length + instalacoes.length} AGENDA(S)</span></div><div className="week marmoraria-week">{Array.from({ length: 7 }, (_, i) => { const d = new Date(hoje); d.setDate(hoje.getDate() + i); const day = events.filter(e => new Date(e.start).toDateString() === d.toDateString()); return <div className={i === 0 ? 'today' : ''} key={d.toISOString()}><span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d).replace('.', '').toUpperCase()} {d.getDate()}</span>{day.map(e => <b className={e.tipo.toLowerCase().includes('entrega') ? 'sage' : 'gold'} key={e.id}>{e.tipo} · {e.cliente_nome || e.title}</b>)}</div> })}</div></article></section></>
}

function Dashboard() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { let mounted = true; Promise.all([listVendas(), listLancamentos()]).then(([v, l]) => { if (!mounted) return; setVendas(v); setLancamentos(l) }).finally(() => { if (mounted) setLoading(false) }); return () => { mounted = false } }, [])
  return <><DashboardWithOperations /><DailyGrossProfitChart vendas={vendas} lancamentos={lancamentos} loading={loading} /></>
}

type KanbanQuote = { id: string; backendId?: number; project: string; client: string; status: Status; value: number; date: string; owner: string; vendedor: string }

function quoteToCard(quote: Quote): KanbanQuote {
  const owner = (quote.vendedor_nome || 'ARC').split(' ').map(part => part[0]).slice(0, 2).join('')
  const dateValue = quote.data_entrega || quote.created_at
  const date = dateValue ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(dateValue)) : 'sem data'
  return { id: `ORC-${String(quote.id).padStart(4, '0')}`, backendId: quote.id, project: quote.cliente_nome || quote.tipo_orcamento, client: quote.cliente_nome || 'Cliente sem nome', status: columnByBackendStatus[quote.status] || 'Gerando', value: quote.valor_total || 0, date, owner, vendedor: quote.vendedor_nome || '' }
}

type CnpjOption = { cnpj: string; nome: string | null }

function useQuoteStatusTransition(
  cnpjOptions: CnpjOption[],
  onUpdated: (quote: Quote) => void,
  onFeedback: (message: string) => void,
  onError: (message: string) => void,
) {
  const [approveCard, setApproveCard] = useState<KanbanQuote | null>(null)
  const [approveCnpj, setApproveCnpj] = useState('')

  async function applyStatus(card: KanbanQuote, status: Status, cnpj?: string) {
    if (!card.backendId) {
      onError('Dados locais não podem alterar status antes da sincronização.')
      return false
    }
    try {
      const updated = await updateQuoteStatus(card.backendId, backendStatusByColumn[status], cnpj)
      onUpdated(updated)
      onFeedback(`${card.id} movido para ${status}.`)
      return true
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha ao atualizar status.')
      return false
    }
  }

  async function moveQuote(card: KanbanQuote, status: Status) {
    if (status === 'Aprovado' && cnpjOptions.length) {
      setApproveCnpj(cnpjOptions[0].cnpj)
      setApproveCard(card)
      return 'pending' as const
    }
    return applyStatus(card, status)
  }

  async function confirmApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!approveCard) return
    await applyStatus(approveCard, 'Aprovado', approveCnpj)
    setApproveCard(null)
  }

  const approvalModal = approveCard && <Modal title={`Aprovar ${approveCard.id}`} close={() => setApproveCard(null)}><form className="modal-form" onSubmit={confirmApproval}>
    <label>CNPJ de faturamento<Combobox ariaLabel="CNPJ de faturamento" searchPlaceholder="Buscar CNPJ…" options={cnpjOptions.map(option => ({ value: option.cnpj, label: option.nome || option.cnpj, meta: option.cnpj }))} value={approveCnpj} onChange={setApproveCnpj} /></label>
    <footer><Button variant="secondary" onClick={() => setApproveCard(null)}>Cancelar</Button><Button type="submit">Aprovar orçamento</Button></footer>
  </form></Modal>

  return { moveQuote, approvalModal, approveCard, approveCnpj, setApproveCard, setApproveCnpj, confirmApproval }
}

function Pipeline() {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'Lista'|'Kanban'>('Kanban')
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [quoteError, setQuoteError] = useState('')
  const [loading, setLoading] = useState(true)
  const [remoteQuotes, setRemoteQuotes] = useState<Quote[] | null>(null)
  const [quoteClients, setQuoteClients] = useState<Client[]>([])
  const [saving, setSaving] = useState(false)
  const [orcamentoConfig, setOrcamentoConfig] = useState<OrcamentoConfig | null>(null)
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null)
  const [vendedor, setVendedor] = useState('')
  const [novoCliente, setNovoCliente] = useState('')
  const [novoTipo, setNovoTipo] = useState('Obra')
  const abrirNovo = () => { setNovoCliente(''); setNovoTipo('Obra'); setQuoteError(''); setOpen(true) }

  useEffect(() => {
    let mounted = true
    listQuotes().then(data => { if (mounted) setRemoteQuotes(data) }).catch(err => { if (mounted) setQuoteError(err instanceof Error ? err.message : 'Kanban offline; exibindo dados locais.') }).finally(() => { if (mounted) setLoading(false) })
    listClients().then(data => { if (mounted) setQuoteClients(data) }).catch(() => undefined)
    getOrcamentoConfig().then(data => { if (mounted) setOrcamentoConfig(data) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  const cnpjOptions = [
    { cnpj: orcamentoConfig?.empresa1_cnpj, nome: orcamentoConfig?.empresa1_nome },
    { cnpj: orcamentoConfig?.empresa2_cnpj, nome: orcamentoConfig?.empresa2_nome },
  ].filter((o): o is { cnpj: string; nome: string | null } => !!o.cnpj)

  const cards: KanbanQuote[] = (remoteQuotes || []).map(quoteToCard)
  const vendedores = [...new Set(cards.map(card => card.vendedor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const filtered = cards
    .filter(q => `${q.project} ${q.client} ${q.id}`.toLowerCase().includes(query.toLowerCase()))
    .filter(q => !vendedor || q.vendedor === vendedor)
  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setQuoteError('')
    const form = new FormData(event.currentTarget); const clienteId = Number(form.get('cliente_id') || 0)
    try {
      if (!clienteId) throw new Error('Selecione um cliente para criar o orçamento.')
      const created = await createQuote({ cliente_id: clienteId, tipo_orcamento: String(form.get('tipo_orcamento') || 'Obra') as TipoOrcamento, modalidade: 'orcamento_formal', itens: [] })
      setRemoteQuotes(current => [...(current || []), created]); setOpen(false); setFeedback('Orçamento criado no backend.')
    } catch (err) { setQuoteError(err instanceof Error ? err.message : 'Falha ao criar orçamento.') } finally { setSaving(false) }
  }
  const { moveQuote, approveCard, approveCnpj, setApproveCard, setApproveCnpj, confirmApproval } = useQuoteStatusTransition(
    cnpjOptions,
    updated => setRemoteQuotes(current => (current || []).map(item => item.id === updated.id ? { ...item, ...updated } : item)),
    setFeedback,
    setQuoteError,
  )
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<Status | null>(null)
  const dragRef = useRef<{ card: KanbanQuote; pointerId: number; startX: number; startY: number; active: boolean; origin: Status; target: Status | null } | null>(null)
  /** O navegador emite `click` no fim do arrasto; sem isso soltar o cartão abriria o detalhe. */
  const arrastouRef = useRef(false)

  function statusAtPoint(x: number, y: number) {
    const column = document.elementFromPoint(x, y)?.closest<HTMLElement>('.kanban-col')
    const className = column?.className.split(' ').find(name => name !== 'kanban-col')
    return className ? ({ gerando: 'Gerando', planejando: 'Planejando', enviado: 'Enviado', ajuste: 'Ajuste', aprovado: 'Aprovado', perdido: 'Perdido' } as Record<string, Status>)[className] || null : null
  }

  function beginDrag(event: ReactPointerEvent<HTMLElement>, card: KanbanQuote) {
    arrastouRef.current = false
    if (!card.backendId || (event.target as HTMLElement).closest('button,select,[data-combobox]')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { card, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false, origin: card.status, target: null }
  }

  function updateDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 8) {
      drag.active = true
      arrastouRef.current = true
      setDraggingId(drag.card.id)
    }
    if (drag.active) {
      drag.target = statusAtPoint(event.clientX, event.clientY)
      setDropTarget(drag.target)
    }
  }

  function finishDrag(event: ReactPointerEvent<HTMLElement>, cancelled = false) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
    setDraggingId(null)
    setDropTarget(null)
    // O clique fantasma chega antes de qualquer timer; zerar aqui libera o Enter seguinte.
    if (drag.active) setTimeout(() => { arrastouRef.current = false }, 0)
    if (cancelled || !drag.active || !drag.target || drag.target === drag.origin) return
    const target = drag.target
    if (target !== 'Aprovado') setRemoteQuotes(current => (current || []).map(item => item.id === drag.card.backendId ? { ...item, status: backendStatusByColumn[target] } : item))
    void moveQuote(drag.card, target).then(result => {
      if (result === false && target !== 'Aprovado') setRemoteQuotes(current => (current || []).map(item => item.id === drag.card.backendId ? { ...item, status: backendStatusByColumn[drag.origin] } : item))
    })
  }
  const openQuote = (card: KanbanQuote) => { if (arrastouRef.current) return; if (card.backendId) { window.history.pushState(null, '', `#orcamento/${card.backendId}`); window.dispatchEvent(new Event('hashchange')) } }
  const kanban = <div className="kanban">{statusValues.map(([status]) => { const columnCards = filtered.filter(q => q.status === status); return <section className={`kanban-col ${status.toLowerCase()} ${dropTarget === status ? 'drop-target' : ''}`} key={status}><header><h2><i />{status}</h2><Badge>{columnCards.length}</Badge><p className="mono">{money(columnCards.reduce((total, card) => total + card.value, 0))}</p></header>{columnCards.map(card => <article className={`quote-card ${draggingId === card.id ? 'dragging' : ''}`} key={card.id} role="button" tabIndex={0} onClick={() => openQuote(card)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openQuote(card) } }} onPointerDown={event => beginDrag(event, card)} onPointerMove={updateDrag} onPointerUp={event => finishDrag(event)} onPointerCancel={event => finishDrag(event, true)}><div><span className="mono">{card.id}</span><b>{money(card.value)}</b></div><h3>{card.project}</h3><p>{card.client}</p><footer><span>{card.owner}</span><em>{card.date}</em>{card.backendId && <button className="text-action" onClick={event => { event.stopPropagation(); setSelectedQuoteId(card.backendId!) }}>Portal</button>}</footer>{card.backendId && <Combobox compact ariaLabel={`Status de ${card.id}`} options={statusOptions} value={card.status} onChange={valor => void moveQuote(card, valor as Status)} />}</article>)}{status === 'Gerando' && <button className="add-card" onClick={abrirNovo}>+ Adicionar</button>}</section>})}</div>
  return <><PageHead eyebrow="VENDAS · PIPELINE" title={view === 'Kanban' ? 'Kanban dos orçamentos' : 'Lista de orçamentos'} subtitle={loading ? 'sincronizando…' : `${cards.length} orçamento${cards.length === 1 ? '' : 's'} · sincronizado`} actions={<><input className="search" placeholder="Buscar projeto ou cliente…" value={query} onChange={event => setQuery(event.target.value)} /><Combobox ariaLabel="Filtrar por vendedor" placeholder="Todos os vendedores" searchPlaceholder="Buscar vendedor…" options={[{ value: '', label: 'Todos os vendedores' }, ...vendedores.map(nome => ({ value: nome, label: nome }))]} value={vendedor} onChange={setVendedor} /><div className="segmented"><button className={view === 'Lista' ? 'active' : ''} onClick={() => setView('Lista')}>Lista</button><button className={view === 'Kanban' ? 'active' : ''} onClick={() => setView('Kanban')}>Kanban</button></div><Button onClick={abrirNovo}>+ Orçamento</Button></>} />{quoteError && <p className="form-error" role="alert">{quoteError}</p>}
    {view === 'Kanban' ? kanban : <article className="card list-card"><DataTable headers={['ORÇAMENTO', 'PROJETO', 'CLIENTE', 'STATUS', '#VALOR']} rows={filtered.map(q => [<span className="mono">{q.id}</span>, <b>{q.project}</b>, q.client, <Badge>{q.status}</Badge>, money(q.value)])}/></article>}{open && <Modal title="Novo orçamento" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitQuote}><label>Cliente<Combobox name="cliente_id" ariaLabel="Cliente" placeholder="Selecione um cliente…" searchPlaceholder="Buscar cliente…" options={quoteClients.map(client => ({ value: String(client.id), label: client.nome_fantasia, meta: client.cpf_cnpj || undefined }))} value={novoCliente} onChange={setNovoCliente} /></label><label>Tipo de orçamento<Combobox name="tipo_orcamento" ariaLabel="Tipo de orçamento" options={tipoOrcamentoOptions} value={novoTipo} onChange={setNovoTipo} /></label>{quoteError && <p className="form-error" role="alert">{quoteError}</p>}<footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={saving}>{saving ? 'Salvando…' : 'Criar orçamento'}</Button></footer></form></Modal>}{approveCard && <Modal title={`Aprovar ${approveCard.id}`} close={() => setApproveCard(null)}><form className="modal-form" onSubmit={confirmApproval}><label>CNPJ de faturamento<Combobox ariaLabel="CNPJ de faturamento" searchPlaceholder="Buscar CNPJ…" options={cnpjOptions.map(option => ({ value: option.cnpj, label: option.nome || option.cnpj, meta: option.cnpj }))} value={approveCnpj} onChange={setApproveCnpj} /></label><footer><Button variant="secondary" onClick={() => setApproveCard(null)}>Cancelar</Button><Button type="submit">Aprovar orçamento</Button></footer></form></Modal>}{selectedQuoteId && <QuotePortalModal quoteId={selectedQuoteId} close={() => setSelectedQuoteId(null)} />}{feedback && <Feedback message={feedback} close={() => setFeedback('')}/>}</>
}

/**
 * O PUT do orçamento é substituição total: o que não voltar no payload é apagado. Por isso o item
 * do construtor carrega todo campo que o backend guarda, mesmo os que esta tela não edita.
 */
const MODALIDADES: { value: Modalidade; label: string }[] = [
  { value: 'orcamento_formal', label: 'Orçamento' },
  { value: 'venda_direta', label: 'Venda direta' },
]

const UNIDADE_ROTULO: Record<UnidadeMedida, string> = { m2: 'm²', linear: 'm', un: 'un.' }
const UNIDADE_PRECO_ROTULO: Record<UnidadeMedida, string> = { m2: 'R$/m²', linear: 'R$/m', un: 'R$/un.' }
const UNIDADE_OPTIONS: ComboOption[] = [
  { value: 'm2', label: 'Metro quadrado (m²)', meta: 'bancada, pedra' },
  { value: 'linear', label: 'Metro linear', meta: 'saia, rodabase' },
  { value: 'un', label: 'Unidade', meta: 'cuba, peça avulsa' },
]

const TIPO_ITEM_ROTULO = { produto: 'peça', servico: 'serviço', externo: 'externo' } as const

/** O que cada tipo de orçamento aceita como item. */
const TIPO_PERMITE: Record<TipoOrcamento, { produto: boolean; servico: boolean; projeto: boolean }> = {
  Obra: { produto: true, servico: true, projeto: true },
  Projeto: { produto: true, servico: true, projeto: true },
  'Peça': { produto: true, servico: false, projeto: false },
  Externo: { produto: false, servico: false, projeto: false },
}
const GATING_MOTIVO: Record<TipoOrcamento, string> = {
  Obra: '', Projeto: '',
  'Peça': 'Orçamento de Peça aceita produto do catálogo e item livre.',
  Externo: 'Orçamento Externo só aceita item livre de terceiro.',
}

function tipoDoItem(item: BuilderItem): 'produto' | 'servico' | 'externo' {
  if (item.isExternal) return 'externo'
  return item.servicoId ? 'servico' : 'produto'
}

/** Referência do item no catálogo (CAT-/SRV-/LIVRE). Não confundir com
 *  `codigo_item`, o sequencial da linha dentro do orçamento, gerado no backend. */
function referenciaCatalogo(item: BuilderItem): string {
  if (item.isExternal) return 'LIVRE'
  if (item.servicoId) return `SRV-${String(item.servicoId).padStart(4, '0')}`
  return `CAT-${String(item.productId).padStart(4, '0')}`
}

/** Aceita vírgula: o vendedor brasileiro digita "1,20" e type=number rejeita em parte dos navegadores. */
function leDecimal(valor: string): number | null {
  const limpo = valor.replace(',', '.').trim()
  if (!limpo) return null
  const numero = Number(limpo)
  return Number.isFinite(numero) && numero >= 0 ? numero : null
}

/** Status em que o orcamento ja virou compromisso: editar alteraria venda faturada. */
const STATUS_FECHADOS = ['Aprovado', 'Entregue', 'Devolvido', 'Faturado']

type BuilderItem = {
  key: string; productId: number | null; servicoId: number | null; servicoComponenteId: number | null
  name: string; quantity: number; unitPrice: number
  isExternal: boolean; projetoItemId: number | null
  localId: number | null; localInstalacao: string | null
  unidadeMedida: UnidadeMedida; comprimento: number | null; largura: number | null
  acrescimo: number; desconto: number
  descricaoExterna: string | null; fornecedorExterno: string | null
  fotoExternaUrl: string | null; personalizacao: string | null
  prazoValor: number | null; prazoUnidade: string | null
}
const itemVazio = {
  servicoId: null, servicoComponenteId: null, localId: null, localInstalacao: null,
  unidadeMedida: 'un' as UnidadeMedida, comprimento: null, largura: null, acrescimo: 0, desconto: 0,
  descricaoExterna: null, fornecedorExterno: null, fotoExternaUrl: null, personalizacao: null,
  prazoValor: null, prazoUnidade: null,
}

/** Area em m², so quando as duas medidas existem. O backend recalcula ao salvar — aqui e previa. */
function areaDoItem(item: BuilderItem): number | null {
  if (item.comprimento === null || item.largura === null) return null
  return Number((item.comprimento * item.largura).toFixed(2))
}

/**
 * Total da linha, em centavos. Espelha schemas.calcular_total_linha no backend: o que o
 * preco unitario significa depende da unidade da peca.
 * E previa — o valor de verdade vem do servidor depois de salvar.
 */
function totalDoItem(item: BuilderItem): number {
  const area = areaDoItem(item)
  let base: number
  if (item.unidadeMedida === 'm2') base = Math.round((area ?? 0) * item.unitPrice)
  else if (item.unidadeMedida === 'linear') base = Math.round((item.comprimento ?? 0) * item.unitPrice)
  else base = item.quantity * item.unitPrice
  return base + (item.acrescimo || 0) - (item.desconto || 0)
}

/** Traduz o item que a API devolve para o formato do construtor, sem perder campo nenhum. */
function itemDaApi(item: QuoteItem, indice: number): BuilderItem {
  return {
    key: `api-${item.id ?? indice}`,
    productId: item.produto_id ?? null,
    servicoId: item.servico_id ?? null,
    servicoComponenteId: item.servico_componente_id ?? null,
    name: item.nome || item.nome_externo || 'Item',
    quantity: item.quantidade,
    unitPrice: item.preco_unitario_aplicado,
    isExternal: Boolean(item.is_externo),
    projetoItemId: item.projeto_item_id ?? null,
    localId: item.local_id ?? null,
    unidadeMedida: item.unidade_medida ?? 'un',
    comprimento: item.comprimento_m ?? null,
    largura: item.largura_m ?? null,
    acrescimo: item.acrescimo_centavos ?? 0,
    desconto: item.desconto_centavos ?? 0,
    localInstalacao: item.local_instalacao ?? null,
    descricaoExterna: item.descricao_externa ?? null,
    fornecedorExterno: item.fornecedor_externo ?? null,
    fotoExternaUrl: item.foto_externa_url ?? null,
    personalizacao: item.personalizacao_aplicada ?? null,
    prazoValor: item.prazo_entrega_valor ?? null,
    prazoUnidade: item.prazo_entrega_unidade ?? null,
  }
}
type ValidationRow = { projetoItemId: number; nome: string; quantidade: number; material: string | null; matchedProductId: number | null; unitPrice: number; included: boolean }

/**
 * Mesmas condições que `POST /orcamentos/{id}/portal-link` exige no backend. Devolver o motivo
 * em texto evita o que o usuário viu: botão morto sem explicação, ou 400 depois do clique.
 */
function motivoSemPortal(quote: QuoteData): string | null {
  if (!['Orçamento gerado', 'Ajuste solicitado'].includes(quote.status)) {
    return `Disponível quando o orçamento estiver em Enviado ou Ajuste — hoje está em "${quote.status}".`
  }
  if (!quote.cliente_email?.trim()) return 'O cliente não tem e-mail cadastrado; o link é enviado por e-mail.'
  return null
}

function quoteDownloadUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/api/')) return url
  return `/api${url.startsWith('/') ? url : `/${url}`}`
}

function QuoteDetail({ quoteId }: { quoteId: number }) {
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [attachments, setAttachments] = useState<OrcamentoAnexo[]>([])
  const [history, setHistory] = useState<AuditLogEntry[]>([])
  const [orcamentoConfig, setOrcamentoConfig] = useState<OrcamentoConfig | null>(null)
  const [link, setLink] = useState<PortalLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [vendaConvertida, setVendaConvertida] = useState<Venda | null>(null)
  // Fluxo formal: o pagamento só é escolhido aqui, depois da aprovação do cliente.
  const [pagamentoVenda, setPagamentoVenda] = useState<SelecaoPagamento>({ tipoId: '', formaId: '', condicaoId: '' })

  useEffect(() => {
    let mounted = true
    Promise.all([getQuote(quoteId), listQuoteAttachments(quoteId), getQuoteHistory(quoteId)])
      .then(([quoteData, attachmentData, historyData]) => {
        if (!mounted) return
        setQuote(quoteData)
        setAttachments(attachmentData)
        setHistory(historyData)
      })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar o orçamento.') })
      .finally(() => { if (mounted) setLoading(false) })
    getOrcamentoConfig().then(data => { if (mounted) setOrcamentoConfig(data) }).catch(() => undefined)
    return () => { mounted = false }
  }, [quoteId])

  const cnpjOptions = [
    { cnpj: orcamentoConfig?.empresa1_cnpj, nome: orcamentoConfig?.empresa1_nome },
    { cnpj: orcamentoConfig?.empresa2_cnpj, nome: orcamentoConfig?.empresa2_nome },
  ].filter((option): option is CnpjOption => !!option.cnpj)

  const { moveQuote, approvalModal } = useQuoteStatusTransition(
    cnpjOptions,
    updated => setQuote(current => current ? { ...current, ...updated } : current),
    setFeedback,
    setError,
  )

  async function refreshQuote() {
    const updated = await getQuote(quoteId)
    setQuote(updated)
  }

  async function regeneratePdf() {
    setBusy(true); setError('')
    try { await regenerateQuotePdf(quoteId); await refreshQuote(); setFeedback('PDF do orçamento regenerado.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao gerar PDF.') }
    finally { setBusy(false) }
  }

  async function sendPortalLink() {
    setBusy(true); setError('')
    try { setLink(await gerarPortalLink(quoteId)); setFeedback('Link do portal gerado e enviado.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao enviar link.') }
    finally { setBusy(false) }
  }

  async function revokePortalLink() {
    if (!confirm('Revogar o link atual? O cliente perderá o acesso imediatamente.')) return
    setBusy(true); setError('')
    try { await revogarPortalLink(quoteId); setLink(null); setFeedback('Link do portal revogado.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao revogar link.') }
    finally { setBusy(false) }
  }

  async function toggleAttachment(attachment: OrcamentoAnexo) {
    setBusy(true); setError('')
    try {
      const updated = await alterarVisibilidadeAnexo(quoteId, attachment.id, !attachment.visivel_cliente)
      setAttachments(current => current.map(item => item.id === updated.id ? updated : item))
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao alterar visibilidade.') }
    finally { setBusy(false) }
  }

  async function copyLink() {
    if (!link) return
    try { await navigator.clipboard?.writeText(link.url); setFeedback('Link copiado.') }
    catch { setError('Não foi possível copiar o link.') }
  }


  async function converterVenda() {
    setBusy(true); setError('')
    try {
      if (pagamentoVenda.tipoId === '') throw new Error('Escolha o tipo de pagamento para converter em venda.')
      setVendaConvertida(await converterEmVenda(quoteId, {
        tipo_pagamento_id: Number(pagamentoVenda.tipoId),
        forma_pagamento_id: pagamentoVenda.formaId === '' ? null : Number(pagamentoVenda.formaId),
        condicao_pagamento_id: pagamentoVenda.condicaoId === '' ? null : Number(pagamentoVenda.condicaoId),
      }))
      setFeedback('Orçamento convertido em venda.')
    }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao converter em venda.') }
    finally { setBusy(false) }
  }

  // Sem `finally`: em caso de sucesso a tela é trocada, e destravar o botão antes disso
  // deixaria a exclusão clicável de novo sobre um orçamento que já não existe.
  async function excluirOrcamento() {
    setBusy(true); setError('')
    try { await deleteQuote(quoteId); location.hash = 'pipeline' }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao excluir o orçamento.'); setBusy(false) }
  }

  if (loading) return <article className="card" style={{ padding: 20 }}><Skeleton rows={5} label="Carregando orçamento" /></article>
  if (!quote) return <article className="card empty-state"><p>{error || 'Orçamento não encontrado.'}</p><Button variant="secondary" onClick={() => { location.hash = 'pipeline' }}>Voltar ao pipeline</Button></article>

  const quoteCard = quoteToCard(quote)
  const total = quote.valor_total ?? quote.itens.reduce((sum, item) => sum + item.quantidade * item.preco_unitario_aplicado, 0)
  const sortedHistory = [...history].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return <>
    <PageHead eyebrow={`${quoteCard.id} · ${quote.tipo_orcamento.toUpperCase()}`} title={quote.cliente_nome || 'Orçamento'} actions={<>
      <Combobox ariaLabel="Status do orçamento" options={statusOptions} value={quoteCard.status} onChange={valor => void moveQuote(quoteCard, valor as Status)} />
      <Button variant="secondary" onClick={() => { location.hash = `builder/${quoteId}` }}>Editar</Button>
      <Button variant="secondary" onClick={() => void regeneratePdf()} loading={busy}>Gerar PDF</Button>
    </>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="quote-detail-grid">
      <div className="quote-detail-main">
        <article className="card"><div className="card-title"><h2>Itens do orçamento</h2><span className="mono">{quoteCard.id}</span></div><div className="table-wrap"><table><thead><tr><th>DESCRIÇÃO</th><th>QTD</th><th>UNITÁRIO</th><th>TOTAL</th></tr></thead><tbody>{quote.itens.map((item, index) => <tr key={`${item.nome || 'item'}-${index}`}><td><b>{item.nome || 'Item'}</b></td><td>{item.quantidade}</td><td>{money(item.preco_unitario_aplicado)}</td><td>{money(item.quantidade * item.preco_unitario_aplicado)}</td></tr>)}</tbody></table></div></article>
        <article className="card"><div className="card-title"><h2>Histórico</h2><span className="mono">{history.length} REGISTROS</span></div><div className="timeline">{sortedHistory.length ? sortedHistory.map(entry => <div key={entry.id}><i /><div><b>{entry.acao}</b><p>{entry.detalhes}</p><small>{entry.usuario_nome || 'Cliente / sistema'} · {portalDate(entry.created_at)}</small></div></div>) : <p className="empty-state">Nenhum evento registrado.</p>}</div></article>
      </div>
      <aside className="quote-detail-aside">
        <article className="card total-card"><p className="mono">VALOR TOTAL</p><strong>{money(total)}</strong><dl><div><dt>Cliente</dt><dd>{quote.cliente_nome || 'Não informado'}</dd></div><div><dt>Vendedor</dt><dd>{quote.vendedor_nome || 'Não informado'}</dd></div><div><dt>Tipo</dt><dd>{quote.tipo_orcamento}</dd></div><div><dt>Criado em</dt><dd>{portalDate(quote.created_at)}</dd></div><div><dt>Status</dt><dd><Badge>{quote.status}</Badge></dd></div></dl>
          {quote.status === 'Aprovado' && (vendaConvertida
            ? <p className="subtitle" role="status">Convertido em venda VDA-{String(vendaConvertida.id).padStart(4, '0')}.</p>
            : <div className="conversao-venda">
                <p className="mono">PAGAMENTO DA VENDA</p>
                <CascataPagamento valor={pagamentoVenda} onChange={setPagamentoVenda} disabled={busy}/>
                <Button onClick={() => void converterVenda()} loading={busy} disabled={pagamentoVenda.tipoId === ''}>Converter em venda</Button>
              </div>)}
        </article>
        <article className="card documents"><div className="card-title"><h2>Anexos</h2><span className="mono">{attachments.length}</span></div>{attachments.length ? attachments.map(attachment => <div className="quote-attachment" key={attachment.id}><a href={quoteDownloadUrl(attachment.url)} download>{attachment.nome_original}</a><small>{portalBytes(attachment.tamanho)} · {attachment.visivel_cliente ? 'Visível ao cliente' : 'Interno'}</small><Toggle checked={attachment.visivel_cliente} disabled={busy} label="Visível ao cliente" onChange={() => void toggleAttachment(attachment)}/></div>) : <p className="empty-state">Nenhum anexo cadastrado.</p>}{quote.anexo_url && <a className="text-action" href={quoteDownloadUrl(quote.anexo_url)} download>Baixar PDF da proposta</a>}</article>
        {quote.decisao_cliente && <article className="card decision quote-decision"><p className="mono">DECISÃO DO CLIENTE</p><strong>{quote.decisao_cliente === 'aprovado' ? 'Aprovou a proposta' : 'Pediu ajuste'}</strong><span>{quote.decisao_cliente_nome || 'Nome não informado'} · {portalDate(quote.decisao_cliente_em || null)}</span>{quote.decisao_cliente === 'recusado' && <p><b>Motivo:</b> {quote.decisao_cliente_motivo || 'Não informado'}</p>}</article>}
        <article className="card portal-detail-card"><p className="mono">PORTAL DO CLIENTE</p><p>Gerar um link novo invalida o anterior.</p>{link ? <><input readOnly value={link.url} aria-label="URL completa do portal"/><button className="text-action" onClick={() => void copyLink()}>Copiar URL</button><small>Enviado para {link.enviado_para} · expira em {portalDate(link.expira_em)}</small><Button variant="secondary" onClick={() => void revokePortalLink()} loading={busy}>Revogar link</Button></> : <><Button onClick={() => void sendPortalLink()} disabled={Boolean(motivoSemPortal(quote))} loading={busy}>Enviar link ao cliente</Button>{motivoSemPortal(quote) && <small className="portal-bloqueio">{motivoSemPortal(quote)}</small>}</>}</article>
        <article className="card portal-detail-card zona-risco"><p className="mono">ZONA DE RISCO</p>
          <p>Excluir apaga os itens e os anexos deste orçamento. Lançamentos financeiros já gerados ficam no histórico, mas perdem o vínculo. Não há como desfazer.</p>
          <HoldButton onConfirm={() => void excluirOrcamento()} disabled={busy} rotuloSegurando="Segure para excluir…">Excluir orçamento</HoldButton>
        </article>
      </aside>
    </div>
    {approvalModal}
    {feedback && <Feedback message={feedback} close={() => setFeedback('')}/>} 
  </>
}

function ClientDetail({ clientId }: { clientId: number }) {
  const [client, setClient] = useState<Client | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    Promise.all([getClient(clientId), listQuotes()])
      .then(([clientData, quotesData]) => {
        if (!mounted) return
        setClient(clientData)
        setQuotes(quotesData.filter(quote => quote.cliente_id === clientId))
      })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar o cliente.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [clientId])

  if (loading) return <article className="card" style={{ padding: 20 }}><Skeleton rows={5} label="Carregando cliente" /></article>
  if (!client) return <article className="card empty-state"><p>{error || 'Cliente não encontrado.'}</p><Button variant="secondary" onClick={() => { location.hash = 'clients' }}>Voltar à carteira</Button></article>

  const totalOrcado = quotes.reduce((sum, quote) => sum + (quote.valor_total ?? 0), 0)

  return <>
    <PageHead eyebrow="VENDAS · CLIENTE" title={client.nome_fantasia} subtitle={client.cpf_cnpj || 'Sem CPF/CNPJ cadastrado'} actions={<Button variant="secondary" onClick={() => { location.hash = 'clients' }}>Voltar à carteira</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="quote-detail-grid">
      <div className="quote-detail-main">
        <article className="card list-card">
          <div className="card-title"><h2>Orçamentos</h2><Badge>{quotes.length} resultados</Badge></div>
          {quotes.length ? <DataTable headers={['ORÇAMENTO', 'TIPO', 'STATUS', '#VALOR']} rows={quotes.map(quote => [
            <button className="text-action" onClick={() => { location.hash = `orcamento/${quote.id}` }}>ORC-{String(quote.id).padStart(4, '0')}</button>,
            quote.tipo_orcamento,
            <Badge>{quote.status}</Badge>,
            money(quote.valor_total || 0),
          ])} /> : <EmptyState title="Nenhum orçamento" description="Este cliente ainda não tem orçamento registrado." />}
        </article>
      </div>
      <aside className="quote-detail-aside">
        <article className="card total-card">
          <p className="mono">TOTAL ORÇADO</p><strong>{money(totalOrcado)}</strong>
          <dl>
            <div><dt>Responsável</dt><dd>{client.nome_responsavel || 'Não informado'}</dd></div>
            <div><dt>E-mail</dt><dd>{client.email || 'Não informado'}</dd></div>
            <div><dt>Telefone</dt><dd>{client.contato || 'Não informado'}</dd></div>
            <div><dt>Endereço de entrega</dt><dd>{client.endereco_entrega || 'Não informado'}</dd></div>
            <div><dt>Endereço de faturamento</dt><dd>{client.endereco_faturamento || 'Não informado'}</dd></div>
            <div><dt>Status</dt><dd><Badge tone={client.status === 'ativo' ? 'success' : 'warning'}>{client.status || 'indefinido'}</Badge></dd></div>
            <div><dt>Cliente desde</dt><dd>{portalDate(client.created_at)}</dd></div>
            {client.data_nascimento && <div><dt>Nascimento</dt><dd>{portalDate(client.data_nascimento)}</dd></div>}
            {client.preferencia_contato && <div><dt>Prefere contato por</dt><dd>{PREFERENCIA_CONTATO_ROTULO[client.preferencia_contato] || client.preferencia_contato}</dd></div>}
            {client.indicado_por && <div><dt>Indicado por</dt><dd>{client.indicado_por}</dd></div>}
            {client.origem_contato && <div><dt>Como conheceu</dt><dd>{ORIGEM_CONTATO_OPTIONS.find(o => o.value === client.origem_contato)?.label || client.origem_contato}</dd></div>}
            {client.profissional_tipo && <div><dt>Profissional</dt><dd>{client.profissional_tipo}</dd></div>}
            {client.carteira && <div><dt>Carteira</dt><dd>Cliente recorrente</dd></div>}
            {/* Autoria: o backend grava e devolve; aqui é só leitura. */}
            {client.criado_por_nome && <div><dt>Criado por</dt><dd>{client.criado_por_nome}</dd></div>}
            {client.editado_por_nome && <div><dt>Editado por</dt><dd>{client.editado_por_nome}{client.editado_em ? ` · ${portalDate(client.editado_em)}` : ''}</dd></div>}
          </dl>
        </article>
      </aside>
    </div>
  </>
}

function QuotePortalModal({ quoteId, close }: { quoteId: number; close: () => void }) {
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [attachments, setAttachments] = useState<OrcamentoAnexo[]>([])
  const [link, setLink] = useState<PortalLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getQuote(quoteId), listQuoteAttachments(quoteId)])
      .then(([quoteData, attachmentData]) => { setQuote(quoteData); setAttachments(attachmentData) })
      .catch(err => setError(err instanceof Error ? err.message : 'Falha ao carregar o orçamento.'))
      .finally(() => setLoading(false))
  }, [quoteId])

  async function sendPortalLink() {
    setBusy(true); setError('')
    try { setLink(await gerarPortalLink(quoteId)) } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao enviar link.') } finally { setBusy(false) }
  }

  async function revokePortalLink() {
    if (!confirm('Revogar o link atual? O cliente perderá o acesso imediatamente.')) return
    setBusy(true); setError('')
    try { await revogarPortalLink(quoteId); setLink(null) } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao revogar link.') } finally { setBusy(false) }
  }

  async function toggleAttachment(attachment: OrcamentoAnexo) {
    setBusy(true); setError('')
    try {
      const updated = await alterarVisibilidadeAnexo(quoteId, attachment.id, !attachment.visivel_cliente)
      setAttachments(current => current.map(item => item.id === updated.id ? updated : item))
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao alterar visibilidade.') } finally { setBusy(false) }
  }

  return <Modal title={`Portal · ORC-${String(quoteId).padStart(4, '0')}`} close={close}><div className="modal-form portal-erp-detail">
    {loading ? <Skeleton rows={4} label="Carregando dados do orçamento" /> : quote && <>
      <p>Envie um link seguro para <strong>{quote.cliente_email || 'cliente sem e-mail'}</strong>. Reenviar invalida o link anterior.</p>
      {motivoSemPortal(quote) && <p className="portal-bloqueio" role="status">{motivoSemPortal(quote)}</p>}
      <div className="portal-link-actions"><Button onClick={sendPortalLink} disabled={Boolean(motivoSemPortal(quote))} loading={busy}>Enviar ao cliente</Button>{link && <Button variant="secondary" onClick={revokePortalLink} loading={busy}>Revogar link</Button>}</div>
      {link && <div className="portal-link-result"><input readOnly value={link.url} aria-label="Link do portal"/><button className="text-action" onClick={() => void navigator.clipboard?.writeText(link.url)}>Copiar</button><small>Expira em {portalDate(link.expira_em)} · enviado para {link.enviado_para}</small></div>}
      {quote.decisao_cliente && <article className="portal-decision"><p className="mono">DECISÃO DO CLIENTE</p><strong>{quote.decisao_cliente === 'aprovado' ? 'Aprovou a proposta' : 'Pediu ajuste'}</strong><span>{quote.decisao_cliente_nome || 'Nome não informado'} · {portalDate(quote.decisao_cliente_em || null)}</span>{quote.decisao_cliente === 'recusado' && <p><b>Motivo:</b> {quote.decisao_cliente_motivo}</p>}</article>}
      <div className="portal-attachments"><p className="mono">DOCUMENTOS · VISIBILIDADE EXTERNA</p><small>Ligar publica o arquivo fora da empresa.</small>{attachments.length ? attachments.map(attachment => <div className="portal-anexo" key={attachment.id}><span>{attachment.nome_original}</span><b>{attachment.visivel_cliente ? 'Visível ao cliente' : 'Interno'}</b><Toggle checked={attachment.visivel_cliente} disabled={busy} ariaLabel={`Publicar ${attachment.nome_original} para o cliente`} onChange={() => void toggleAttachment(attachment)}/></div>) : <p>Nenhum anexo cadastrado.</p>}</div>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div></Modal>
}

/**
 * Escolha dos componentes de um servico composto.
 *
 * Obrigatorios vem marcados e travados — o vendedor precisa ver o que esta comprando, e
 * esconde-los daria a impressao de que nao fazem parte. Cada componente marcado gera uma
 * LINHA propria no orcamento (o backend, o PDF e o portal sao planos).
 */
type EscolhaComponente = { incluso: boolean; comprimento: number | null; largura: number | null; quantidade: number }

/** Sequencial de chaves de item — estavel e sem depender do relogio durante o render. */
let sequenciaItem = 0

function ModalItemServico({ servico, locais, onCancelar, onConfirmar }: {
  servico: Servico
  locais: Local[]
  onCancelar: () => void
  onConfirmar: (linhas: BuilderItem[]) => void
}) {
  const [componentes, setComponentes] = useState<ServicoComponente[]>(servico.componentes ?? [])
  const [carregando, setCarregando] = useState(!servico.componentes)
  const [erro, setErro] = useState('')
  const [localId, setLocalId] = useState<number | ''>('')
  const [escolhas, setEscolhas] = useState<Record<number, EscolhaComponente>>({})

  useEffect(() => {
    if (servico.componentes) return
    let vivo = true
    listServicoComponentes(servico.id)
      .then(dados => { if (vivo) setComponentes(dados) })
      .catch(err => { if (vivo) setErro(err instanceof Error ? err.message : 'Falha ao carregar componentes.') })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [servico.id, servico.componentes])

  const ativos = componentes.filter(componente => componente.ativo)

  /** Obrigatório já nasce incluso; o estado só guarda o que o usuário mexeu. */
  const escolhaDe = (componente: ServicoComponente): EscolhaComponente =>
    escolhas[componente.id] ?? { incluso: componente.obrigatorio, comprimento: null, largura: null, quantidade: 1 }

  function ajusta(componente: ServicoComponente, patch: Partial<EscolhaComponente>) {
    setEscolhas(atual => ({ ...atual, [componente.id]: { ...escolhaDe(componente), ...patch } }))
  }

  function subtotal(componente: ServicoComponente): number {
    const escolha = escolhaDe(componente)
    if (!escolha.incluso) return 0
    const preco = componente.preco_unitario ?? 0
    if (componente.unidade_medida === 'm2') return Math.round((escolha.comprimento ?? 0) * (escolha.largura ?? 0) * preco)
    if (componente.unidade_medida === 'linear') return Math.round((escolha.comprimento ?? 0) * preco)
    return escolha.quantidade * preco
  }

  const inclusos = ativos.filter(componente => escolhaDe(componente).incluso)
  const totalServico = inclusos.reduce((soma, componente) => soma + subtotal(componente), 0)
  const semMedida = inclusos.filter(componente => {
    const escolha = escolhaDe(componente)
    if (componente.unidade_medida === 'm2') return !escolha.comprimento || !escolha.largura
    if (componente.unidade_medida === 'linear') return !escolha.comprimento
    return false
  })

  function confirmar() {
    const agora = ++sequenciaItem
    // Servico sem componentes cadastrados degrada para uma linha simples.
    if (!ativos.length) {
      onConfirmar([{
        ...itemVazio,
        key: `servico-${servico.id}-${agora}`, productId: null, servicoId: servico.id, servicoComponenteId: null,
        name: servico.nome, quantity: 1, unitPrice: servico.preco_padrao,
        isExternal: false, projetoItemId: null,
        localId: localId === '' ? null : Number(localId),
        prazoValor: servico.tempo_medio_valor, prazoUnidade: servico.tempo_medio_unidade,
      }])
      return
    }
    onConfirmar(inclusos.map((componente, indice) => {
      const escolha = escolhaDe(componente)
      return {
        ...itemVazio,
        key: `servico-${servico.id}-${componente.id}-${agora}-${indice}`,
        productId: null, servicoId: servico.id, servicoComponenteId: componente.id,
        name: `${servico.nome} · ${componente.nome}`,
        quantity: escolha.quantidade || 1,
        // Preco congela na adicao: mexer no catalogo depois nao altera orcamento existente.
        unitPrice: componente.preco_unitario ?? 0,
        isExternal: false, projetoItemId: null,
        localId: localId === '' ? null : Number(localId),
        unidadeMedida: componente.unidade_medida,
        comprimento: escolha.comprimento, largura: escolha.largura,
        prazoValor: servico.tempo_medio_valor, prazoUnidade: servico.tempo_medio_unidade,
      }
    }))
  }

  return <Modal title={`Adicionar ${servico.nome}`} close={onCancelar}><div className="modal-form">
    {erro && <p className="form-error" role="alert">{erro}</p>}
    <label>Local<Combobox ariaLabel="Local de instalação" placeholder="Selecione um local…" options={locais.map(local => ({ value: String(local.id), label: local.nome }))} value={localId === '' ? '' : String(localId)} onChange={valor => setLocalId(valor ? Number(valor) : '')} /></label>
    {carregando ? <Skeleton rows={3} label="Carregando componentes" /> : !ativos.length
      ? <p className="subtitle">Este serviço não tem componentes cadastrados — entra como uma linha única de {money(servico.preco_padrao)}.</p>
      : <div className="componentes-servico">
          {ativos.map(componente => {
            const escolha = escolhaDe(componente)
            return <div className="componente-linha" key={componente.id}>
              <label className="componente-check">
                <input type="checkbox" checked={escolha.incluso} disabled={componente.obrigatorio} onChange={() => ajusta(componente, { incluso: !escolha.incluso })} />
                <b>{componente.nome}</b>
                {componente.obrigatorio && <Badge>Obrigatório</Badge>}
              </label>
              {escolha.incluso && <span className="componente-medidas">
                {componente.unidade_medida !== 'un' && <input type="text" inputMode="decimal" placeholder="Comp. (m)" aria-label={`Comprimento de ${componente.nome}`} value={escolha.comprimento ?? ''} onChange={e => ajusta(componente, { comprimento: leDecimal(e.target.value) })} />}
                {componente.unidade_medida === 'm2' && <input type="text" inputMode="decimal" placeholder="Larg. (m)" aria-label={`Largura de ${componente.nome}`} value={escolha.largura ?? ''} onChange={e => ajusta(componente, { largura: leDecimal(e.target.value) })} />}
                {componente.unidade_medida === 'un' && <input type="number" min="1" step="1" aria-label={`Quantidade de ${componente.nome}`} value={escolha.quantidade} onChange={e => ajusta(componente, { quantidade: Math.max(1, Number(e.target.value) || 1) })} />}
                <em>{money(subtotal(componente))}</em>
              </span>}
            </div>
          })}
          <p className="componentes-total"><span>Total do serviço</span><strong>{money(totalServico)}</strong></p>
        </div>}
    <footer>
      <Button variant="secondary" onClick={onCancelar}>Cancelar</Button>
      <Button onClick={confirmar} disabled={carregando || (ativos.length > 0 && (!inclusos.length || semMedida.length > 0))}>Adicionar ao orçamento</Button>
      {semMedida.length > 0 && <small className="form-error">Informe a medida de: {semMedida.map(c => c.nome).join(', ')}.</small>}
    </footer>
  </div></Modal>
}

type SelecaoPagamento = { tipoId: number | ''; formaId: number | ''; condicaoId: number | '' }

/**
 * Cascata Tipo → Forma → Condição. A Forma só é renderizada quando o tipo escolhido
 * exige (hoje, Cartão) — um campo permanentemente desabilitado em 80% dos casos é ruído.
 * Trocar o tipo limpa forma e condição, senão o payload sai com combinação inválida.
 */
function CascataPagamento({ valor, onChange, disabled }: { valor: SelecaoPagamento; onChange: (proximo: SelecaoPagamento) => void; disabled?: boolean }) {
  const [tipos, setTipos] = useState<TipoPagamento[]>([])
  const [formas, setFormas] = useState<FormaPagamento[]>([])
  const [condicoes, setCondicoes] = useState<PaymentCondition[]>([])

  useEffect(() => {
    let ativo = true
    catalogoTiposPagamento.listar(true).then(dados => { if (ativo) setTipos(dados) }).catch(() => undefined)
    catalogoCondicoesPagamento.listar(true).then(dados => { if (ativo) setCondicoes(dados) }).catch(() => undefined)
    return () => { ativo = false }
  }, [])

  const tipoSelecionado = tipos.find(tipo => tipo.id === Number(valor.tipoId))

  const tipoExigeForma = tipoSelecionado?.exige_forma ?? false
  const tipoIdSelecionado = tipoSelecionado?.id
  useEffect(() => {
    let ativo = true
    if (!tipoExigeForma || tipoIdSelecionado === undefined) {
      Promise.resolve().then(() => { if (ativo) setFormas([]) })
      return () => { ativo = false }
    }
    catalogoFormasPagamento.listar(tipoIdSelecionado, true).then(dados => { if (ativo) setFormas(dados) }).catch(() => undefined)
    return () => { ativo = false }
  }, [tipoIdSelecionado, tipoExigeForma])

  if (!tipos.length) return <p className="empty-state">Nenhum tipo de pagamento ativo. Configure em Configurações do orçamento.</p>

  return <div className="cascata-pagamento">
    <label>Tipo de pagamento<Combobox ariaLabel="Tipo de pagamento" placeholder="Selecione…" options={tipos.map(tipo => ({ value: String(tipo.id), label: tipo.nome }))} value={valor.tipoId === '' ? '' : String(valor.tipoId)} disabled={disabled}
      onChange={novo => onChange({ tipoId: novo ? Number(novo) : '', formaId: '', condicaoId: '' })}/></label>
    {tipoSelecionado?.exige_forma && <label>Forma<Combobox ariaLabel="Forma de pagamento" placeholder="Crédito ou débito…" options={formas.map(forma => ({ value: String(forma.id), label: forma.nome }))} value={valor.formaId === '' ? '' : String(valor.formaId)} disabled={disabled}
      onChange={novo => onChange({ ...valor, formaId: novo ? Number(novo) : '', condicaoId: '' })}/></label>}
    <label>Condição<Combobox ariaLabel="Condição de pagamento" placeholder="À vista, parcelado…" options={condicoes.map(condicao => ({ value: String(condicao.id), label: condicao.nome }))} value={valor.condicaoId === '' ? '' : String(valor.condicaoId)} disabled={disabled}
      onChange={novo => onChange({ ...valor, condicaoId: novo ? Number(novo) : '' })}/></label>
  </div>
}

function Builder({ quoteId: quoteIdRota }: { quoteId?: number } = {}) {
  const [clientsList, setClientsList] = useState<Client[]>([])
  const [productsList, setProductsList] = useState<Product[]>([])
  const [selectedClient, setSelectedClient] = useState<number | ''>('')
  const [quoteType, setQuoteType] = useState<TipoOrcamento>('Obra')
  // Default no caminho reversivel: escolher venda direta por engano aprova e fatura uma
  // proposta que o cliente nunca viu.
  const [modalidade, setModalidade] = useState<Modalidade>('orcamento_formal')
  const [payment, setPayment] = useState('')
  const [locais, setLocais] = useState<Local[]>([])
  const [servicosList, setServicosList] = useState<Servico[]>([])
  // Cascata do checkout (so aparece em venda direta): Tipo -> Forma (se exige) -> Condicao.
  const [tiposPagamento, setTiposPagamento] = useState<TipoPagamento[]>([])
  const [tipoPagamentoId, setTipoPagamentoId] = useState<number | ''>('')
  const [formaPagamentoId, setFormaPagamentoId] = useState<number | ''>('')
  const [condicaoPagamentoId, setCondicaoPagamentoId] = useState<number | ''>('')
  const [descontoGlobal, setDescontoGlobal] = useState(0)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [servicoModal, setServicoModal] = useState<Servico | null>(null)
  const [items, setItems] = useState<BuilderItem[]>([])
  const [quoteId, setQuoteId] = useState<number | null>(null)
  const [itemModal, setItemModal] = useState<'catalog'|'free'|'project'|'project-validate'|'servico'|null>(null)
  const [novoProduto, setNovoProduto] = useState('')
  // Editando: enquanto o orçamento não carregar, salvar criaria um DUPLICADO em vez de atualizar.
  const [carregouParaEditar, setCarregouParaEditar] = useState(false)
  const [itemAberto, setItemAberto] = useState<string | null>(null)
  const [subindoFoto, setSubindoFoto] = useState<string | null>(null)
  const [arrastandoEm, setArrastandoEm] = useState<string | null>(null)
  const [preservado, setPreservado] = useState<{ arquiteto_nome: string | null; arquiteto_contato: string | null; projeto_id: number | null }>({ arquiteto_nome: null, arquiteto_contato: null, projeto_id: null })
  // Orcamento ja convertido em venda nao pode ser editado: alteraria preco de venda
  // faturada, com estoque baixado e titulo financeiro criado, sem estorno.
  const [somenteLeitura, setSomenteLeitura] = useState(false)
  const [projetosList, setProjetosList] = useState<Projeto[]>([])
  const [projectDraft, setProjectDraft] = useState<ProjetoDetail | null>(null)
  const [validationRows, setValidationRows] = useState<ValidationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let mounted = true
    Promise.all([listClients(), listCatalogProducts()]).then(([clientData, productData]) => {
      if (!mounted) return
      setClientsList(clientData); setProductsList(productData)
      // Orçamento novo começa vazio (o estado vazio guia a próxima ação); editando, quem manda é o backend.
      if (!quoteIdRota && clientData[0]) setSelectedClient(clientData[0].id)
    }).catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar dados do orçamento.') }).finally(() => { if (mounted) setLoading(false) })
    if (quoteIdRota) {
      getQuote(quoteIdRota).then(quote => {
        if (!mounted) return
        setQuoteId(quote.id)
        setSelectedClient(quote.cliente_id)
        setQuoteType(quote.tipo_orcamento || 'Obra')
        setModalidade(quote.modalidade || 'orcamento_formal')
        setDescontoGlobal(quote.desconto_global_centavos ?? 0)
        if (quote.condicoes_pagamento_selecionadas) setPayment(quote.condicoes_pagamento_selecionadas)
        setItems(quote.itens.map(itemDaApi))
        setPreservado({
          arquiteto_nome: quote.arquiteto_nome ?? null, arquiteto_contato: quote.arquiteto_contato ?? null,
          projeto_id: quote.projeto_id ?? null,
        })
        setSomenteLeitura(STATUS_FECHADOS.includes(quote.status))
        setCarregouParaEditar(true)
      }).catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar o orçamento para edição.') })
    }
    listPaymentConditions(true).then(data => {
      // Editando, a condição vem do orçamento: o primeiro da lista não pode atropelar o que veio do banco.
      if (mounted && !quoteIdRota && data[0]) setPayment(data[0].nome)
    }).catch(() => undefined)
    catalogoLocais.listar(true).then(data => { if (mounted) setLocais(data) }).catch(() => undefined)
    catalogoTiposPagamento.listar(true).then(data => { if (mounted) setTiposPagamento(data) }).catch(() => undefined)
    listServicos(true).then(data => { if (mounted) setServicosList(data) }).catch(() => undefined)
    listProjetos().then(data => { if (mounted) setProjetosList(data) }).catch(() => undefined)
    return () => { mounted = false }
  }, [quoteIdRota])

  const selectedClientName = clientsList.find(client => client.id === selectedClient)?.nome_fantasia || 'Cliente não selecionado'
  const atualizaItem = (key: string, patch: Partial<BuilderItem>) =>
    setItems(atual => atual.map(item => item.key === key ? { ...item, ...patch } : item))

  /** Recusa antes de subir o que a rota recusaria depois (extensao e 10 MB). */
  async function anexaFoto(key: string, file: File | null | undefined) {
    if (!file) return
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!UPLOAD_EXTENSOES.includes(ext)) { setError(`Foto precisa ser ${UPLOAD_EXTENSOES.join(', ')} \u2014 recebido "${ext || 'sem extensao'}".`); return }
    if (file.size > UPLOAD_TAMANHO_MAXIMO) { setError(`Foto tem ${(file.size / 1024 / 1024).toFixed(1)} MB; o limite e 10 MB.`); return }
    setSubindoFoto(key); setError('')
    try { const { url } = await uploadArquivo(file); atualizaItem(key, { fotoExternaUrl: url }) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao enviar a foto.') }
    finally { setSubindoFoto(null) }
  }

  const payload = (): QuoteCreateInput => ({
    cliente_id: Number(selectedClient), tipo_orcamento: quoteType, modalidade,
    condicoes_pagamento_selecionadas: payment,
    desconto_global_centavos: descontoGlobal,
    projeto_id: projectDraft?.id ?? preservado.projeto_id ?? null,
    // Reenviados intactos: esta tela não os edita, e o PUT zeraria o que faltasse.
    arquiteto_nome: preservado.arquiteto_nome, arquiteto_contato: preservado.arquiteto_contato,
    // Venda direta fecha a venda no mesmo request; no formal o pagamento so e coletado
    // na conversao, depois da aprovacao do cliente no portal.
    pagamento: modalidade === 'venda_direta' && tipoPagamentoId !== ''
      ? {
          tipo_pagamento_id: Number(tipoPagamentoId),
          forma_pagamento_id: formaPagamentoId === '' ? null : Number(formaPagamentoId),
          condicao_pagamento_id: condicaoPagamentoId === '' ? null : Number(condicaoPagamentoId),
        }
      : null,
    itens: items.map(item => ({
      quantidade: item.quantity,
      preco_unitario_aplicado: item.unitPrice,
      unidade_medida: item.unidadeMedida,
      local_id: item.localId,
      local_instalacao: item.localInstalacao,
      comprimento_m: item.comprimento,
      largura_m: item.largura,
      acrescimo_centavos: item.acrescimo,
      desconto_centavos: item.desconto,
      prazo_entrega_valor: item.prazoValor,
      prazo_entrega_unidade: item.prazoUnidade,
      projeto_item_id: item.projetoItemId,
      // codigo_item e area_m2 nao vao no payload: o backend calcula e ignora o que vier.
      ...(item.isExternal
        ? { is_externo: true, nome_externo: item.name, descricao_externa: item.descricaoExterna,
            fornecedor_externo: item.fornecedorExterno, foto_externa_url: item.fotoExternaUrl,
            personalizacao_aplicada: item.personalizacao }
        : item.servicoId
          ? { servico_id: item.servicoId, servico_componente_id: item.servicoComponenteId }
          : { produto_id: item.productId }),
    })),
  })
  const sortedProjects = [...projetosList].sort((a, b) => {
    const aMatch = selectedClient && a.cliente_id === selectedClient ? 0 : 1
    const bMatch = selectedClient && b.cliente_id === selectedClient ? 0 : 1
    return aMatch - bMatch
  })

  async function openProject(projetoId: number) {
    setError('')
    try {
      const detail = await getProjeto(projetoId)
      setProjectDraft(detail)
      setValidationRows(detail.itens.map(item => ({
        projetoItemId: item.id, nome: item.nome, quantidade: item.quantidade, material: item.material,
        matchedProductId: item.produto_id,
        unitPrice: item.preco_sugerido_centavos ?? (item.produto_id ? (productsList.find(p => p.id === item.produto_id)?.preco_venda ?? 0) : 0),
        included: true,
      })))
      setItemModal('project-validate')
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar projeto.') }
  }

  function updateValidationRow(index: number, patch: Partial<ValidationRow>) {
    setValidationRows(current => current.map((row, i) => i === index ? { ...row, ...patch } : row))
  }

  function confirmProjectSelection() {
    const additions: BuilderItem[] = validationRows.filter(row => row.included).map(row => {
      const produto = row.matchedProductId ? productsList.find(p => p.id === row.matchedProductId) : undefined
      return {
        ...itemVazio,
        key: `project-${row.projetoItemId}-${Date.now()}`,
        productId: row.matchedProductId,
        name: produto?.nome || row.nome,
        quantity: row.quantidade,
            unitPrice: row.unitPrice,
        isExternal: !row.matchedProductId,
        projetoItemId: row.projetoItemId,
      }
    })
    setItems(current => [...current, ...additions])
    setItemModal(null)
    setFeedback(`${additions.length} item(ns) importado(s) do projeto "${projectDraft?.nome}".`)
  }

  async function saveQuote(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); setSaving(true); setError('')
    try {
      if (quoteIdRota && !carregouParaEditar) throw new Error('O orçamento ainda não carregou; recarregue a página antes de salvar.')
      if (somenteLeitura) throw new Error('Este orçamento já virou venda e não pode mais ser editado.')
      if (!selectedClient) throw new Error('Selecione um cliente antes de salvar.')
      if (!items.length) throw new Error('Adicione pelo menos um item ao orçamento.')
      const semMedida = items.filter(item =>
        (item.unidadeMedida === 'm2' && (!item.comprimento || !item.largura)) ||
        (item.unidadeMedida === 'linear' && !item.comprimento))
      if (semMedida.length) throw new Error(`${semMedida.length} item(ns) sem medida: ${semMedida.map(i => i.name).join(', ')}.`)
      if (modalidade === 'venda_direta') {
        if (tipoPagamentoId === '') throw new Error('Escolha o tipo de pagamento para fechar a venda.')
        const tipo = tiposPagamento.find(t => t.id === Number(tipoPagamentoId))
        if (tipo?.exige_forma && formaPagamentoId === '') throw new Error(`Pagamento em ${tipo.nome} exige informar a forma.`)
      }
      const saved = quoteId ? await updateQuote(quoteId, payload()) : await createQuote(payload())
      setQuoteId(saved.id); setFeedback(`Orçamento ORC-${String(saved.id).padStart(4, '0')} salvo no backend.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar orçamento.') } finally { setSaving(false) }
  }

  async function regeneratePdf() {
    if (!quoteId) { setError('Salve o orçamento antes de gerar o PDF.'); return }
    try { const result = await regenerateQuotePdf(quoteId); setFeedback(result.status) } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao gerar PDF.') }
  }

  const permite = TIPO_PERMITE[quoteType]
  // Trocar o tipo nunca apaga item: marca os incompatíveis e deixa o usuário decidir.
  const incompativeis = items.filter(item => {
    const tipo = tipoDoItem(item)
    if (tipo === 'servico') return !permite.servico
    if (tipo === 'produto') return !permite.produto
    return false
  })

  function trocarModalidade(proxima: Modalidade) {
    if (proxima === modalidade) return
    // Só confirma quando há pagamento preenchido para perder — confirmação incondicional
    // treina o usuário a clicar OK sem ler.
    const temPagamento = tipoPagamentoId !== '' || formaPagamentoId !== '' || condicaoPagamentoId !== ''
    if (modalidade === 'venda_direta' && temPagamento && !window.confirm('Trocar para Orçamento descarta o pagamento já escolhido. Continuar?')) return
    if (proxima === 'orcamento_formal') { setTipoPagamentoId(''); setFormaPagamentoId(''); setCondicaoPagamentoId('') }
    setModalidade(proxima)
  }

  // `indeterminate` nao existe como atributo JSX: so via ref.
  const marcarTodos = useCallback((el: HTMLInputElement | null) => {
    if (el) el.indeterminate = selecionados.size > 0 && selecionados.size < items.length
  }, [selecionados.size, items.length])

  function alternaTodos() {
    setSelecionados(atual => atual.size === items.length ? new Set() : new Set(items.map(i => i.key)))
  }

  function alternaSelecao(key: string) {
    setSelecionados(atual => {
      const proximo = new Set(atual)
      if (proximo.has(key)) proximo.delete(key)
      else proximo.add(key)
      return proximo
    })
  }

  function removerItem(item: BuilderItem) {
    setItemAberto(atual => atual === item.key ? null : atual)
    setSelecionados(atual => { const proximo = new Set(atual); proximo.delete(item.key); return proximo })
    setItems(current => current.filter(currentItem => currentItem.key !== item.key))
    setFeedback(`"${item.name}" removido do orçamento.`)
  }

  function removerSelecionados() {
    setItems(current => current.filter(item => !selecionados.has(item.key)))
    setFeedback(`${selecionados.size} item(ns) removido(s).`)
    setSelecionados(new Set())
  }

  function removerIncompativeis() {
    const chaves = new Set(incompativeis.map(item => item.key))
    setItems(current => current.filter(item => !chaves.has(item.key)))
    setFeedback(`${chaves.size} item(ns) incompatíveis removidos.`)
  }

  /** Injeta o local histórico quando ele foi desativado no catálogo — sem isso o Combobox
   *  renderiza o placeholder e o dado se perde no próximo save. */
  function opcoesLocal(item: BuilderItem): ComboOption[] {
    const opcoes: ComboOption[] = locais.map(local => ({ value: String(local.id), label: local.nome }))
    if (item.localId !== null && !locais.some(local => local.id === item.localId)) {
      opcoes.unshift({ value: String(item.localId), label: item.localInstalacao || `Local #${item.localId}`, meta: 'inativo' })
    }
    return opcoes
  }

  const totalItens = items.reduce((soma, item) => soma + totalDoItem(item), 0)
  const totalOrcamento = totalItens - descontoGlobal

  function addCatalogItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const product = productsList.find(item => item.id === Number(form.get('produto_id'))); if (!product) return
    setItems(current => [...current, { key: `product-${product.id}-${Date.now()}`, productId: product.id, name: product.nome, quantity: Number(form.get('quantidade') || 1), unitPrice: product.preco_venda, isExternal: false, projetoItemId: null, ...itemVazio }]); setItemModal(null)
  }

  function addFreeItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setItems(current => [...current, { key: `free-${Date.now()}`, productId: null, name: String(form.get('nome') || 'Item livre'), quantity: Number(form.get('quantidade') || 1), unitPrice: Math.round(Number(form.get('preco') || 0) * 100), isExternal: true, projetoItemId: null, ...itemVazio }]); setItemModal(null)
  }

  return <><PageHead eyebrow={quoteIdRota ? `ORC-${String(quoteIdRota).padStart(4, '0')} · EDIÇÃO` : quoteId ? `ORC-${String(quoteId).padStart(4, '0')} · RASCUNHO` : 'NOVO ORÇAMENTO · RASCUNHO'} title={`${selectedClientName} — orçamento`} actions={<><Badge>Gerando</Badge><Button variant="secondary" onClick={() => saveQuote()} loading={saving} disabled={Boolean(quoteIdRota) && !carregouParaEditar} title={quoteIdRota && !carregouParaEditar ? 'Aguardando o orçamento carregar.' : undefined}>{saving ? 'Salvando…' : quoteIdRota ? 'Salvar alterações' : 'Salvar rascunho'}</Button><Button onClick={regeneratePdf}>Gerar PDF e enviar</Button></>} />{error && <p className="form-error" role="alert">{error}</p>}{loading ? <article className="card" style={{ padding: 20 }}><Skeleton rows={4} label="Carregando clientes e catálogo" /></article> : <form onSubmit={saveQuote}><div className="builder"><div><article className="card fields">
              <label>Cliente<Combobox ariaLabel="Cliente" placeholder="Selecione um cliente…" searchPlaceholder="Buscar cliente…" options={clientsList.map(client => ({ value: String(client.id), label: client.nome_fantasia, meta: client.cpf_cnpj || undefined }))} value={selectedClient === '' ? '' : String(selectedClient)} onChange={valor => setSelectedClient(valor ? Number(valor) : '')} /></label>
              <div className="campo-modalidade">
                <span className="item-detalhe-rotulo">Modalidade</span>
                <div className="segmented" role="group" aria-label="Modalidade da venda">
                  {MODALIDADES.map(opcao => <button key={opcao.value} type="button" className={modalidade === opcao.value ? 'active' : ''} onClick={() => trocarModalidade(opcao.value)}>{opcao.label}</button>)}
                </div>
                <small>{modalidade === 'venda_direta' ? 'Cliente presente — o pagamento é registrado agora e a venda fecha ao finalizar.' : 'Proposta para decisão posterior — o pagamento é coletado na conversão em venda.'}</small>
              </div>
              <label>Tipo de orçamento<Combobox ariaLabel="Tipo de orçamento" options={tipoOrcamentoOptions} value={quoteType} onChange={valor => setQuoteType(valor as TipoOrcamento)} /></label>
            </article><article className="card items">
              {selecionados.size > 0
                ? <div className="barra-selecao"><b>{selecionados.size} {selecionados.size === 1 ? 'item selecionado' : 'itens selecionados'}</b><span><button type="button" className="text-action" onClick={() => setSelecionados(new Set())}>Limpar seleção</button> <HoldButton onConfirm={removerSelecionados} compacto>Remover selecionados</HoldButton></span></div>
                : <div className="card-title"><h2>Itens <small>· {items.length}</small></h2></div>}
              {/* Barra de adicionar em faixa própria, colada na tabela: no card-title os 4
                  botões espremiam o título e ficavam pequenos demais para o alvo de toque. */}
              {selecionados.size === 0 && <div className="acoes-item">
                {[
                  { id: 'catalog' as const, icone: 'catalog' as IconName, rotulo: 'Do catálogo', ok: permite.produto, motivo: GATING_MOTIVO[quoteType] },
                  { id: 'servico' as const, icone: 'servicesCatalog' as IconName, rotulo: 'Serviço', ok: permite.servico, motivo: 'Serviços só entram em orçamentos de Obra ou Projeto.' },
                  { id: 'free' as const, icone: 'builder' as IconName, rotulo: 'Item livre', ok: true, motivo: '' },
                  { id: 'project' as const, icone: 'projects' as IconName, rotulo: 'De um projeto', ok: permite.projeto, motivo: 'Importar projeto só em orçamentos de Obra ou Projeto.' },
                ].map(acao => <button key={acao.id} type="button" className="acao-item" disabled={!acao.ok}
                  title={acao.ok ? undefined : acao.motivo}
                  onClick={() => { if (acao.id === 'catalog') setNovoProduto(''); setItemModal(acao.id) }}>
                  <Icon name={acao.icone} /><span>{acao.rotulo}</span>
                </button>)}
              </div>}
              {incompativeis.length > 0 && <p className="form-error" role="status">{incompativeis.length} item(ns) não pertencem ao tipo “{quoteType}”. <button type="button" className="text-action" onClick={removerIncompativeis}>Remover os {incompativeis.length} incompatíveis</button></p>}
              <div className="table-wrap itens-tabela"><table><thead><tr>
                <th><input type="checkbox" aria-label="Selecionar todos os itens" ref={marcarTodos} checked={items.length > 0 && selecionados.size === items.length} onChange={alternaTodos} /></th>
                <th>CÓD.</th><th>LOCAL</th><th className="num">QTD</th><th>DESCRIÇÃO</th><th>TIPO</th>
                <th className="num">COMP. (m)</th><th className="num">LARG. (m)</th><th className="num">M²</th>
                <th className="num">ACRÉSC.</th><th className="num">DESC.</th><th className="num">TOTAL</th><th/>
              </tr></thead><tbody>{items.map((item, indice) => { const aberto = itemAberto === item.key; return <Fragment key={item.key}>
               <tr className={aberto ? 'editing' : ''}>
                <td><input type="checkbox" aria-label={`Selecionar ${item.name}`} checked={selecionados.has(item.key)} onChange={() => alternaSelecao(item.key)} /></td>
                <td className="mono">{String(indice + 1).padStart(2, '0')}</td>
                <td><Combobox compact ariaLabel={`Local de ${item.name}`} placeholder="—" options={opcoesLocal(item)} value={item.localId === null ? '' : String(item.localId)} onChange={valor => atualizaItem(item.key, { localId: valor ? Number(valor) : null })} /></td>
                <td className="num"><input className="celula-num" type="number" min="1" step="1" aria-label={`Quantidade de ${item.name}`} value={item.quantity} onChange={e => atualizaItem(item.key, { quantity: Math.max(1, Number(e.target.value) || 1) })} /></td>
                <td><button type="button" className="item-abrir" aria-expanded={aberto} onClick={() => setItemAberto(atual => atual === item.key ? null : item.key)}>
                  <b>{item.name}</b><small>{referenciaCatalogo(item)}</small>
                </button></td>
                <td><Badge>{TIPO_ITEM_ROTULO[tipoDoItem(item)]}</Badge></td>
                {/* Comp./Larg. só existem quando a peça é medida: cuba e item avulso vão por unidade. */}
                <td className="num">{item.unidadeMedida === 'un' ? <i className="celula-na" title="Item vendido por unidade">—</i>
                  : <input className="celula-num" type="text" inputMode="decimal" aria-label={`Comprimento de ${item.name}`} value={item.comprimento ?? ''} placeholder="0,00" onChange={e => atualizaItem(item.key, { comprimento: leDecimal(e.target.value) })} />}</td>
                <td className="num">{item.unidadeMedida !== 'm2' ? <i className="celula-na" title="Não medido em m²">—</i>
                  : <input className="celula-num" type="text" inputMode="decimal" aria-label={`Largura de ${item.name}`} value={item.largura ?? ''} placeholder="0,00" onChange={e => atualizaItem(item.key, { largura: leDecimal(e.target.value) })} />}</td>
                <td className="num">{item.unidadeMedida === 'm2' ? (areaDoItem(item) !== null ? areaDoItem(item)!.toFixed(2) : <i className="celula-na">—</i>) : <i className="celula-na">—</i>}</td>
                <td className="num"><input className="celula-num" type="text" inputMode="decimal" aria-label={`Acréscimo de ${item.name}`} value={(item.acrescimo / 100).toFixed(2)} onChange={e => atualizaItem(item.key, { acrescimo: Math.round((leDecimal(e.target.value) ?? 0) * 100) })} /></td>
                <td className="num"><input className="celula-num" type="text" inputMode="decimal" aria-label={`Desconto de ${item.name}`} value={(item.desconto / 100).toFixed(2)} onChange={e => atualizaItem(item.key, { desconto: Math.round((leDecimal(e.target.value) ?? 0) * 100) })} /></td>
                <td className="num"><b>{money(totalDoItem(item))}</b></td>
                <td><button type="button" className="item-remover" aria-label={`Remover ${item.name}`} onClick={() => removerItem(item)}>−</button></td>
              </tr>
              {aberto && <tr className="linha-detalhe"><td colSpan={13}><div className="item-detalhe">
                <label>Unidade de medida<Combobox ariaLabel="Unidade de medida" options={UNIDADE_OPTIONS} value={item.unidadeMedida} onChange={valor => atualizaItem(item.key, { unidadeMedida: valor as UnidadeMedida })}/></label>
                <label>Preço unitário ({UNIDADE_PRECO_ROTULO[item.unidadeMedida]})<input type="number" min="0" step="0.01" value={(item.unitPrice / 100).toFixed(2)} onChange={event => atualizaItem(item.key, { unitPrice: Math.round(Number(event.target.value || 0) * 100) })}/></label>
                <label>Prazo de entrega<input type="number" min="0" step="1" value={item.prazoValor ?? ''} placeholder="0" onChange={event => atualizaItem(item.key, { prazoValor: event.target.value ? Number(event.target.value) : null })}/></label>
                <label>Unidade do prazo<Combobox ariaLabel="Unidade do prazo" placeholder="Sem prazo" options={prazoOptions} value={item.prazoUnidade || ''} onChange={valor => atualizaItem(item.key, { prazoUnidade: valor || null })}/></label>
                {item.isExternal && <>
                  <label>Fornecedor<input value={item.fornecedorExterno || ''} placeholder="Atelie Luz" onChange={event => atualizaItem(item.key, { fornecedorExterno: event.target.value || null })}/></label>
                  <label>Personalização<input value={item.personalizacao || ''} placeholder="Cabo textil 2 m" onChange={event => atualizaItem(item.key, { personalizacao: event.target.value || null })}/></label>
                  <label className="item-detalhe-largo">Descrição<input value={item.descricaoExterna || ''} placeholder="Cupula de linho cru" onChange={event => atualizaItem(item.key, { descricaoExterna: event.target.value || null })}/></label>
                  <div className="item-detalhe-largo">
                    <span className="item-detalhe-rotulo">Foto do item</span>
                    <div className={`dropzone${arrastandoEm === item.key ? ' sobre' : ''}`}
                      onDragOver={event => { event.preventDefault(); setArrastandoEm(item.key) }}
                      onDragLeave={() => setArrastandoEm(null)}
                      onDrop={event => { event.preventDefault(); setArrastandoEm(null); void anexaFoto(item.key, event.dataTransfer.files?.[0]) }}>
                      {item.fotoExternaUrl
                        ? <><img src={quoteDownloadUrl(item.fotoExternaUrl)} alt={`Foto de ${item.name}`}/><button type="button" className="text-action" onClick={() => atualizaItem(item.key, { fotoExternaUrl: null })}>Remover foto</button></>
                        : <p>{subindoFoto === item.key ? 'Enviando…' : 'Arraste a foto aqui'}</p>}
                      <label className="dropzone-escolher">{item.fotoExternaUrl ? 'Trocar arquivo' : 'Escolher arquivo'}
                        <input type="file" accept={UPLOAD_EXTENSOES.join(',')} onChange={event => { void anexaFoto(item.key, event.target.files?.[0]); event.target.value = '' }}/>
                      </label>
                    </div>
                  </div>
                </>}
              </div></td></tr>}
            </Fragment> })}
            {!items.length && <tr className="linha-vazia"><td colSpan={13}>
              <EmptyState title="Nenhum item no orçamento" description="Puxe do catálogo, crie um item livre ou importe de um projeto." action={<Button variant="secondary" onClick={() => { setNovoProduto(''); setItemModal('catalog') }}>Do catálogo</Button>} />
            </td></tr>}
            </tbody></table></div></article>
            {/* Pagamento fecha o fluxo: e a ultima decisao, depois de saber o total. So aparece
                na venda direta — no orcamento formal ele e coletado na conversao em venda. */}
            {modalidade === 'venda_direta' && <article className="card fields checkout">
              <div className="card-title"><h2>Pagamento</h2></div>
              <CascataPagamento
                valor={{ tipoId: tipoPagamentoId, formaId: formaPagamentoId, condicaoId: condicaoPagamentoId }}
                onChange={proximo => { setTipoPagamentoId(proximo.tipoId); setFormaPagamentoId(proximo.formaId); setCondicaoPagamentoId(proximo.condicaoId) }}
                disabled={somenteLeitura} />
              <label>Desconto de fechamento (R$)<input type="number" min="0" step="0.01" value={(descontoGlobal / 100).toFixed(2)} onChange={event => setDescontoGlobal(Math.round(Number(event.target.value || 0) * 100))} /></label>
              <p className="checkout-total"><span>{items.length} {items.length === 1 ? 'item' : 'itens'}</span><strong>{money(totalOrcamento)}</strong></p>
            </article>}
          </div><aside><article className="card total-card"><p className="mono">TOTAL DA PROPOSTA</p><strong>{money(totalOrcamento)}</strong><dl><dt>Itens</dt><dd>{items.length}</dd><dt>Cliente</dt><dd>{selectedClientName}</dd><dt>Tipo</dt><dd>{quoteType}</dd>{descontoGlobal > 0 && <><dt>Desconto</dt><dd>−{money(descontoGlobal)}</dd></>}</dl></article><article className="card attachments"><p className="mono">ANEXOS</p><span>PDF gerado automaticamente ao salvar</span></article></aside></div></form>}{itemModal === 'catalog' && <Modal title="Adicionar do catálogo" close={() => setItemModal(null)}><form className="modal-form" onSubmit={addCatalogItem}><label>Produto<Combobox name="produto_id" ariaLabel="Produto" placeholder="Selecione um produto…" searchPlaceholder="Buscar produto…" options={productsList.map(product => ({ value: String(product.id), label: product.nome, meta: product.material || undefined }))} value={novoProduto} onChange={setNovoProduto} /></label><label>Quantidade<input name="quantidade" type="number" min="1" step="1" defaultValue="1" required/></label><footer><Button variant="secondary" onClick={() => setItemModal(null)}>Cancelar</Button><Button type="submit">Adicionar item</Button></footer></form></Modal>}{itemModal === 'servico' && <Modal title="Adicionar serviço" close={() => setItemModal(null)}><div className="modal-form">
      <label>Serviço<Combobox ariaLabel="Serviço" placeholder="Selecione um serviço…" searchPlaceholder="Buscar serviço…" options={servicosList.map(servico => ({ value: String(servico.id), label: servico.nome, meta: money(servico.preco_padrao) }))} value="" onChange={valor => { const escolhido = servicosList.find(s => s.id === Number(valor)); if (escolhido) { setServicoModal(escolhido); setItemModal(null) } }} /></label>
      {!servicosList.length && <p className="empty-state">Nenhum serviço ativo no catálogo.</p>}
      <footer><Button variant="secondary" onClick={() => setItemModal(null)}>Cancelar</Button></footer>
    </div></Modal>}
    {servicoModal && <ModalItemServico servico={servicoModal} locais={locais} onCancelar={() => setServicoModal(null)}
      onConfirmar={linhas => { setItems(atual => [...atual, ...linhas]); setServicoModal(null) }} />}
    {itemModal === 'free' && <Modal title="Adicionar item livre" close={() => setItemModal(null)}><form className="modal-form" onSubmit={addFreeItem}><label>Descrição<input name="nome" required autoFocus placeholder="Bancada especial…"/></label><label>Quantidade<input name="quantidade" type="number" min="1" step="1" defaultValue="1" required/></label><label>Preço unitário<input name="preco" type="number" min="0" step="0.01" required placeholder="0,00"/></label><footer><Button variant="secondary" onClick={() => setItemModal(null)}>Cancelar</Button><Button type="submit">Adicionar item</Button></footer></form></Modal>}
    {itemModal === 'project' && <Modal title="Importar de um projeto" close={() => setItemModal(null)}>
      <div className="modal-form" style={{ gridTemplateColumns: '1fr' }}>
        {projetosList.length ? <DataTable headers={['PROJETO', 'ORIGEM', 'CLIENTE', '#ITENS', '']} rows={sortedProjects.map(p => [
          <b>{p.nome}</b>,
          projetoOrigemLabel[p.origem] || p.origem,
          p.cliente_nome || 'Sem cliente',
          String(p.total_itens ?? 0),
          <Button type="button" variant="secondary" onClick={() => openProject(p.id)}>Selecionar</Button>,
        ])}/> : <p className="empty-state">Nenhum projeto importado ainda. Vá em "Projetos" para importar um CSV do SketchUp.</p>}
      </div>
    </Modal>}
    {itemModal === 'project-validate' && projectDraft && <Modal title={`Validar itens · ${projectDraft.nome}`} close={() => setItemModal(null)}>
      <div className="modal-form" style={{ gridTemplateColumns: '1fr' }}>
        <p className="subtitle">Confira cada item antes de adicionar ao orçamento — nada é incluído automaticamente.</p>
        <DataTable headers={['ITEM', '#QTD', 'PRODUTO DO CATÁLOGO', '#PREÇO UNIT.', 'INCLUIR']} rows={validationRows.map((row, index) => [
          <div><b>{row.nome}</b>{row.material && <small>{row.material}</small>}</div>,
          <input type="number" min="1" step="1" value={row.quantidade} onChange={e => updateValidationRow(index, { quantidade: Number(e.target.value) || 1 })}/>,
          <Combobox ariaLabel={`Produto do catálogo para ${row.nome}`} placeholder="— manter como item externo —" searchPlaceholder="Buscar produto…"
            options={[{ value: '', label: '— manter como item externo —' }, ...productsList.map(p => ({ value: String(p.id), label: p.nome, meta: p.material || undefined }))]}
            value={row.matchedProductId === null ? '' : String(row.matchedProductId)}
            onChange={valor => { const id = valor ? Number(valor) : null; const produto = productsList.find(p => p.id === id); updateValidationRow(index, { matchedProductId: id, unitPrice: produto ? produto.preco_venda : row.unitPrice }) }} />,
          <input type="number" min="0" step="0.01" value={(row.unitPrice / 100).toFixed(2)} onChange={e => updateValidationRow(index, { unitPrice: Math.round(Number(e.target.value || 0) * 100) })}/>,
          <input type="checkbox" checked={row.included} onChange={e => updateValidationRow(index, { included: e.target.checked })} aria-label={`Incluir ${row.nome}`}/>,
        ])}/>
        <footer><Button variant="secondary" onClick={() => setItemModal(null)}>Cancelar</Button><Button onClick={confirmProjectSelection} disabled={!validationRows.some(row => row.included)}>Confirmar seleção</Button></footer>
      </div>
    </Modal>}
    {feedback && <Feedback message={feedback} close={() => setFeedback('')}/>}</>
}

const projetoOrigemLabel: Record<string, string> = { sketchup: 'SketchUp', manual_csv: 'CSV manual', stone: 'Med-Stone' }

function Projects() {
  const [items, setItems] = useState<Projeto[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [importCliente, setImportCliente] = useState('')
  const [detail, setDetail] = useState<ProjetoDetail | null>(null)
  const [clientsList, setClientsList] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let mounted = true
    listProjetos().then(data => { if (mounted) setItems(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar projetos.') })
      .finally(() => { if (mounted) setLoading(false) })
    listClients().then(data => { if (mounted) setClientsList(data) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  const filtered = items.filter(item => `${item.nome} ${item.origem} ${projetoOrigemLabel[item.origem] || ''} ${item.cliente_nome || ''}`.toLowerCase().includes(query.toLowerCase()))

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    const fileInput = event.currentTarget.elements.namedItem('file') as HTMLInputElement
    const file = fileInput?.files?.[0]
    try {
      if (!file) throw new Error('Selecione um arquivo CSV para importar.')
      const nome = String(form.get('nome') || '')
      const clienteId = Number(form.get('cliente_id') || 0) || undefined
      const created = await importarProjetoCsv(file, nome, clienteId)
      setItems(current => [created, ...current]); setOpen(false)
      setFeedback(`Projeto "${created.nome}" importado com ${created.itens.length} item(ns).`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao importar projeto.') }
    finally { setSaving(false) }
  }

  async function openDetail(projetoId: number) {
    setError('')
    try { setDetail(await getProjeto(projetoId)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar detalhe do projeto.') }
  }

  async function removeProjeto(item: Projeto) {
    if (!confirm(`Excluir o projeto "${item.nome}"? Esta ação não pode ser desfeita.`)) return
    try { await deleteProjeto(item.id); setItems(current => current.filter(current_item => current_item.id !== item.id)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao excluir projeto.') }
  }

  return <><PageHead eyebrow="VENDAS · PROJETOS" title="Projetos" subtitle={`${items.length} projeto(s) importado(s) de softwares de arquitetura`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar projeto, origem ou cliente..."/><Button onClick={() => { setImportCliente(''); setOpen(true) }}>+ Importar CSV</Button></>}/>
    {error && <p className="form-error" role="alert">{error}</p>}
    <article className="card list-card">
      <div className="card-title"><h2>Projetos importados</h2><Badge>{filtered.length} resultados</Badge></div>
      {loading ? <Skeleton rows={5} label="Carregando projetos" /> : filtered.length ? <DataTable headers={['PROJETO', 'ORIGEM', 'CLIENTE', '#ITENS', '#IMPORTADO EM', 'AÇÕES']} rows={filtered.map(item => [
        <b>{item.nome}</b>,
        <span><Badge tone="neutral">{projetoOrigemLabel[item.origem] || item.origem}</Badge>{item.origem_status === 'rascunho' && <Badge tone="warning">Rascunho · pode mudar</Badge>}</span>,
        item.cliente_nome || 'Sem cliente definido',
        String(item.total_itens ?? 0),
        new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(item.created_at)),
        <span className="row-actions"><button className="text-action" onClick={() => openDetail(item.id)}>Ver itens</button> <button className="text-action" onClick={() => removeProjeto(item)}>Excluir</button></span>,
      ])}/> : <EmptyState title="Nenhum projeto importado" description="Traga a lista de itens do SketchUp num arquivo CSV para começar." action={<Button onClick={() => { setImportCliente(''); setOpen(true) }}>+ Importar CSV</Button>} />}
    </article>
    {open && <Modal title="Importar projeto (CSV)" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitImport}>
      <label>Nome do projeto<input name="nome" autoFocus required placeholder="Apto 302 - Torre B"/></label>
      <label>Cliente (opcional)<Combobox name="cliente_id" ariaLabel="Cliente" placeholder="Sem cliente definido" searchPlaceholder="Buscar cliente…" options={[{ value: '', label: 'Sem cliente definido' }, ...clientsList.map(client => ({ value: String(client.id), label: client.nome_fantasia }))]} value={importCliente} onChange={setImportCliente} /></label>
      <label>Arquivo CSV<input name="file" type="file" accept=".csv,.txt" required/></label>
      <small>Exporte a lista de componentes pelo "Generate Report" do SketchUp (colunas nome/quantidade/material/dimensões) e envie aqui.</small>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={saving}>{saving ? 'Importando…' : 'Importar'}</Button></footer>
    </form></Modal>}
    {detail && <Modal title={`Projeto · ${detail.nome}`} close={() => setDetail(null)}>
      <div className="modal-form" style={{ gridTemplateColumns: '1fr' }}>
        <p><Badge tone="neutral">{projetoOrigemLabel[detail.origem] || detail.origem}</Badge>{detail.origem_status === 'rascunho' && <Badge tone="warning">Rascunho · confirme antes de orçar</Badge>}</p>
        {detail.origem_rev && <p className="mono">REVISÃO DA ORIGEM · {detail.origem_rev}</p>}
      </div>
      <DataTable headers={['ITEM', '#QTD', 'MATERIAL', 'PRODUTO SUGERIDO']} rows={detail.itens.map(item => [
        <b>{item.nome}</b>, item.quantidade, item.material || '—', item.produto_nome_sugerido || <span className="danger-text">Sem correspondência</span>,
      ])}/>
    </Modal>}
    {feedback && <Feedback message={feedback} close={() => setFeedback('')}/>}
  </>
}

// Cabeçalho prefixado com '#' marca coluna numérica: à direita e em mono tabular, como no design system.
function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) { const num = headers.map(h => h.startsWith('#')); return <div className="table-wrap"><table><thead><tr>{headers.map((h,j)=><th key={h} className={num[j] ? 'num' : undefined}>{h.replace(/^#/,'')}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j} className={num[j] ? 'num' : undefined}>{cell}</td>)}</tr>)}</tbody></table><footer>Exibindo {rows.length} {rows.length === 1 ? 'registro' : 'registros'}</footer></div> }

/** Painel sobreposto: Esc fecha, foco entra no painel e Tab circula dentro dele. */
function usePainelSobreposto(close: () => void) {
  const painel = useRef<HTMLElement>(null)
  // `close` muda de identidade a cada render do pai; sem o ref o efeito reexecutaria e
  // roubaria o foco de volta pro primeiro campo a cada tecla digitada.
  const fechar = useRef(close)
  // Guardado no render (antes de qualquer efeito mover o foco) para devolver o foco ao gatilho.
  const gatilho = useRef(document.activeElement as HTMLElement | null)
  useEffect(() => { fechar.current = close }, [close])
  useEffect(() => {
    const anterior = gatilho.current
    const focaveis = () => [...(painel.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') || [])]
    focaveis()[0]?.focus()
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); fechar.current(); return }
      if (event.key !== 'Tab') return
      const alvos = focaveis()
      if (!alvos.length) return
      const primeiro = alvos[0], ultimo = alvos[alvos.length - 1]
      if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primeiro.focus() }
      else if (event.shiftKey && document.activeElement === primeiro) { event.preventDefault(); ultimo.focus() }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => { document.removeEventListener('keydown', aoTeclar); anterior?.focus() }
  }, [])
  return painel
}

/** Gaveta lateral do design system: formulário longo entra pela direita, sem cobrir a tela toda. */
function Drawer({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const painel = usePainelSobreposto(close)
  return <div className="modal-backdrop drawer-backdrop" role="presentation" onMouseDown={close}>
    <section className="drawer" ref={painel as React.RefObject<HTMLElement>} role="dialog" aria-modal="true" aria-labelledby="drawer-title" onMouseDown={event => event.stopPropagation()}>
      <header><h2 id="drawer-title">{title}</h2><button aria-label="Fechar" onClick={close}>×</button></header>
      {children}
    </section>
  </div>
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const painel = usePainelSobreposto(close)
  return <div className="modal-backdrop" role="presentation" onMouseDown={close}><section className="modal" ref={painel as React.RefObject<HTMLElement>} role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={e=>e.stopPropagation()}><header><h2 id="modal-title">{title}</h2><button aria-label="Fechar" onClick={close}>×</button></header>{children}</section></div>
}

function Feedback({ message, close }: { message: string; close: () => void }) {
  return <div className="toast" role="status" aria-live="polite"><i />{message}<button aria-label="Fechar aviso" onClick={close}>×</button></div>
}

/** Origem do contato de quem NÃO veio por indicação — orienta onde investir. */
const ORIGEM_CONTATO_OPTIONS: ComboOption[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'google', label: 'Google / busca' },
  { value: 'obra_vizinha', label: 'Obra vizinha' },
  { value: 'loja', label: 'Passou na loja' },
  { value: 'feira', label: 'Feira ou evento' },
  { value: 'outro', label: 'Outro' },
]
const PREFERENCIA_CONTATO_OPTIONS: ComboOption[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'ligacao', label: 'Ligação' },
  { value: 'email', label: 'E-mail' },
]
const PREFERENCIA_CONTATO_ROTULO: Record<string, string> = {
  whatsapp: 'WhatsApp', ligacao: 'Ligação', email: 'E-mail',
}

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

function clienteVazio(): ClientInput {
  return {
    tipo_pessoa: 'fisica', nome: null, sobrenome: null, razao_social: null, cpf_cnpj: null,
    nome_responsavel: null, email: null, contato: null, telefone_secundario: null,
    cep: null, numero: null, complemento: null, bairro: null, cidade: null, estado: null,
    endereco_entrega: null, endereco_faturamento: null,
    carteira: false, indicado_por: null, profissional_tipo: null,
    data_nascimento: null, origem_contato: null, preferencia_contato: null, status: 'ativo',
  }
}

/** Aceita CPF (11) e CNPJ (14) validando digito verificador. */
function documentoValido(valor: string, tipo: TipoPessoa): boolean {
  const d = valor.replace(/\D/g, '')
  if (!d) return true // vazio nao bloqueia: cadastro provisorio e cliente estrangeiro existem
  if (tipo === 'fisica') {
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
    const digito = (ate: number) => {
      let soma = 0
      for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i)
      const resto = (soma * 10) % 11
      return resto === 10 ? 0 : resto
    }
    return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
  }
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const digito = (ate: number) => {
    const pesos = ate === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * pesos[i]
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return digito(12) === Number(d[12]) && digito(13) === Number(d[13])
}

/**
 * Formulario de cliente PF/PJ.
 *
 * Em criacao mostra so o essencial (5 campos): numa venda de balcao, 20 campos em coluna
 * unica destroem o cadastro rapido. O resto abre sob demanda e sempre aparece na edicao.
 */
function ClienteFormulario({ inicial, modo, salvando, onSubmit }: {
  inicial?: Client | null
  modo: 'criacao' | 'edicao'
  salvando: boolean
  onSubmit: (input: ClientInput) => void
}) {
  const [dados, setDados] = useState<ClientInput>(() => {
    if (!inicial) return clienteVazio()
    // Campos derivados/gerados pelo backend ficam de fora do formulário.
    return {
      tipo_pessoa: inicial.tipo_pessoa, nome: inicial.nome, sobrenome: inicial.sobrenome,
      razao_social: inicial.razao_social, cpf_cnpj: inicial.cpf_cnpj,
      nome_responsavel: inicial.nome_responsavel, email: inicial.email,
      contato: inicial.contato, telefone_secundario: inicial.telefone_secundario,
      cep: inicial.cep, numero: inicial.numero, complemento: inicial.complemento,
      bairro: inicial.bairro, cidade: inicial.cidade, estado: inicial.estado,
      endereco_entrega: inicial.endereco_entrega, endereco_faturamento: inicial.endereco_faturamento,
      carteira: inicial.carteira, indicado_por: inicial.indicado_por,
      profissional_tipo: inicial.profissional_tipo,
      data_nascimento: inicial.data_nascimento, origem_contato: inicial.origem_contato,
      preferencia_contato: inicial.preferencia_contato, status: inicial.status,
    }
  })
  const [completo, setCompleto] = useState(true)
  const [buscandoCep, setBuscandoCep] = useState(false)

  const set = (patch: Partial<ClientInput>) => setDados(atual => ({ ...atual, ...patch }))
  const pf = dados.tipo_pessoa === 'fisica'
  const docOk = documentoValido(dados.cpf_cnpj || '', dados.tipo_pessoa)

  async function buscarCep() {
    const cep = (dados.cep || '').replace(/\D/g, '')
    if (cep.length !== 8) return
    setBuscandoCep(true)
    try {
      const encontrado = await consultarCep(cep)
      // Preenche o que veio, mantendo editavel: CEP de faixa unica erra rua e numero.
      set({
        bairro: encontrado.bairro ?? dados.bairro,
        cidade: encontrado.cidade ?? dados.cidade,
        estado: encontrado.estado ?? dados.estado,
        endereco_entrega: encontrado.logradouro ?? dados.endereco_entrega,
      })
    } catch { /* falha de CEP nunca trava o cadastro */ }
    finally { setBuscandoCep(false) }
  }

  return <form className="modal-form" onSubmit={event => { event.preventDefault(); onSubmit(dados) }}>
    <fieldset>
      <legend className="mono">IDENTIFICAÇÃO</legend>
      <div className="segmented" role="group" aria-label="Tipo de pessoa">
        {/* Trocar o tipo nao apaga o que ja foi digitado no outro: guarda os dois e envia o ativo. */}
        <button type="button" className={pf ? 'active' : ''} onClick={() => set({ tipo_pessoa: 'fisica' })}>Pessoa física</button>
        <button type="button" className={!pf ? 'active' : ''} onClick={() => set({ tipo_pessoa: 'juridica' })}>Pessoa jurídica</button>
      </div>
      {pf ? <>
        <label>Nome<input value={dados.nome || ''} required onChange={e => set({ nome: e.target.value || null })} /></label>
        <label>Sobrenome<input value={dados.sobrenome || ''} required onChange={e => set({ sobrenome: e.target.value || null })} /></label>
      </> : <>
        <label>Razão social<input value={dados.razao_social || ''} required onChange={e => set({ razao_social: e.target.value || null })} /></label>
        <label>Responsável<input value={dados.nome_responsavel || ''} onChange={e => set({ nome_responsavel: e.target.value || null })} /></label>
      </>}
      <label>{pf ? 'CPF' : 'CNPJ'}
        <input value={dados.cpf_cnpj || ''} aria-invalid={!docOk} onChange={e => set({ cpf_cnpj: e.target.value || null })} placeholder={pf ? '000.000.000-00' : '00.000.000/0000-00'} />
        {/* Aviso, nao bloqueio: quem manda sobre duplicidade e formato e o backend. */}
        {!docOk && <small className="form-error">{pf ? 'CPF' : 'CNPJ'} inválido — confira.</small>}
      </label>
      <label>Telefone<input value={dados.contato || ''} onChange={e => set({ contato: e.target.value || null })} /></label>
      <label>E-mail<input type="email" value={dados.email || ''} onChange={e => set({ email: e.target.value || null })} /></label>
    </fieldset>

    {modo === 'criacao' && !completo && <button type="button" className="text-action" onClick={() => setCompleto(true)}>Completar cadastro agora</button>}

    {completo && <>
      <fieldset>
        <legend className="mono">CONTATO</legend>
        <label>Telefone secundário<input value={dados.telefone_secundario || ''} onChange={e => set({ telefone_secundario: e.target.value || null })} /></label>
        {pf && <label>Responsável<input value={dados.nome_responsavel || ''} onChange={e => set({ nome_responsavel: e.target.value || null })} /></label>}
      </fieldset>
      <fieldset>
        <legend className="mono">ENDEREÇO</legend>
        <label>CEP<input value={dados.cep || ''} placeholder="00000-000" onChange={e => set({ cep: e.target.value || null })} onBlur={() => void buscarCep()} />
          {buscandoCep && <small>Buscando endereço…</small>}
        </label>
        <label>Logradouro<input value={dados.endereco_entrega || ''} onChange={e => set({ endereco_entrega: e.target.value || null })} /></label>
        <label>Número<input value={dados.numero || ''} onChange={e => set({ numero: e.target.value || null })} /></label>
        <label>Complemento<input value={dados.complemento || ''} onChange={e => set({ complemento: e.target.value || null })} /></label>
        <label>Bairro<input value={dados.bairro || ''} onChange={e => set({ bairro: e.target.value || null })} /></label>
        <label>Cidade<input value={dados.cidade || ''} onChange={e => set({ cidade: e.target.value || null })} /></label>
        <label>Estado<Combobox ariaLabel="Estado" placeholder="UF" options={UFS.map(uf => ({ value: uf, label: uf }))} value={dados.estado || ''} onChange={valor => set({ estado: valor || null })} /></label>
      </fieldset>
      <fieldset>
        <legend className="mono">RELACIONAMENTO</legend>
        <label>Profissional<input value={dados.profissional_tipo || ''} placeholder="Arquiteto, engenheiro…" onChange={e => set({ profissional_tipo: e.target.value || null })} /></label>
        <label>Indicado por<input value={dados.indicado_por || ''} placeholder="Quem indicou" onChange={e => set({ indicado_por: e.target.value || null })} /></label>
        {/* Sem indicação, saber por onde chegou orienta onde investir. */}
        <label>Como conheceu<Combobox ariaLabel="Como conheceu" placeholder="Selecione…" options={ORIGEM_CONTATO_OPTIONS} value={dados.origem_contato || ''} onChange={valor => set({ origem_contato: valor || null })} /></label>
        <label>Preferência de contato<Combobox ariaLabel="Preferência de contato" placeholder="Selecione…" options={PREFERENCIA_CONTATO_OPTIONS} value={dados.preferencia_contato || ''} onChange={valor => set({ preferencia_contato: (valor || null) as PreferenciaContato | null })} /></label>
        <label>Data de nascimento<input type="date" value={(dados.data_nascimento || '').slice(0, 10)} onChange={e => set({ data_nascimento: e.target.value ? `${e.target.value}T00:00:00` : null })} /></label>
        <div className="campo-toggle">
          <Toggle checked={dados.carteira} label="Cliente de carteira" ariaLabel="Cliente de carteira" onChange={() => set({ carteira: !dados.carteira })} />
          <small>Marque para clientes recorrentes.</small>
        </div>
      </fieldset>
    </>}

    <footer><Button type="submit" loading={salvando}>{modo === 'edicao' ? 'Salvar alterações' : 'Salvar cliente'}</Button></footer>
  </form>
}

function Clients() {
  const [items, setItems] = useState<Client[]>([])
  const [editando, setEditando] = useState<Client | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    listClients().then(data => { if (mounted) setItems(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar clientes.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const filtered = items.filter(item => `${item.nome_fantasia} ${item.cpf_cnpj || ''} ${item.email || ''} ${item.contato || ''}`.toLowerCase().includes(query.toLowerCase()))
  async function submitClient(input: ClientInput) {
    setSaving(true); setError('')
    try { const created = await createClient(input); setItems(current => [created, ...current]); setOpen(false) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar cliente.') }
    finally { setSaving(false) }
  }

  async function salvarEdicao(input: ClientInput) {
    if (!editando) return
    setSaving(true); setError('')
    try {
      const salvo = await updateClient(editando.id, input)
      setItems(current => current.map(item => item.id === salvo.id ? salvo : item))
      setEditando(null)
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar cliente.') }
    finally { setSaving(false) }
  }
  async function removeClient(item: Client) {
    if (!confirm(`Excluir o cliente "${item.nome_fantasia}"? Esta ação não pode ser desfeita.`)) return
    try { await deleteClient(item.id); setItems(current => current.filter(current_item => current_item.id !== item.id)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao excluir cliente.') }
  }
  return <><PageHead eyebrow="VENDAS · CARTEIRA" title="Carteira de clientes" subtitle={`${items.length} clientes carregados do backend`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nome, CPF/CNPJ ou contato..."/><Button onClick={() => setOpen(true)}>+ Novo cliente</Button></>}/>{error && <p className="form-error" role="alert">{error}</p>}<section className="kpi-grid"><Kpi label="CLIENTES ATIVOS" value={String(items.filter(item => item.status === 'ativo').length)} note="vindos da API"/><Kpi label="RESULTADOS" value={String(filtered.length)} note="filtro atual"/><Kpi label="COM CONTATO" value={String(items.filter(item => item.email || item.contato).length)} note="e-mail ou telefone"/><Kpi dark label="STATUS" value={loading ? '...' : 'OK'} note="sincronização concluída"/></section><article className="card list-card"><div className="card-title"><h2>Clientes</h2><Badge>{filtered.length} resultados</Badge></div>{loading ? <Skeleton rows={5} label="Carregando clientes" /> : <DataTable headers={['CLIENTE','CONTATO','DOCUMENTO','STATUS','ENDEREÇO','AÇÕES']} rows={filtered.map(item => [<div className="person person-link" role="button" tabIndex={0} onClick={() => { location.hash = `clients/${item.id}` }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); location.hash = `clients/${item.id}` } }}><span>{item.nome_fantasia.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><b>{item.nome_fantasia}<small>{item.nome_responsavel || item.cpf_cnpj || 'Sem documento'}</small></b></div>, item.email || item.contato || 'Sem contato', <span>{item.cpf_cnpj || 'Não informado'}<small className="mono"> · {item.tipo_pessoa === 'fisica' ? 'PF' : 'PJ'}</small></span>, <Badge tone={item.status === 'ativo' ? 'success' : 'warning'}>{item.status || 'indefinido'}</Badge>, item.endereco_entrega || 'Não informado', <span><button className="text-action" onClick={event => { event.stopPropagation(); setEditando(item) }}>Editar</button> <button className="text-action" onClick={event => { event.stopPropagation(); removeClient(item) }}>Excluir</button></span>])}/>}</article>{open && <Drawer title="Novo cliente" close={() => setOpen(false)}>
      <ClienteFormulario modo="criacao" salvando={saving} onSubmit={input => void submitClient(input)} />
    </Drawer>}
    {editando && <Drawer title={`Editar ${editando.nome_fantasia}`} close={() => setEditando(null)}>
      <ClienteFormulario modo="edicao" inicial={editando} salvando={saving} onSubmit={input => void salvarEdicao(input)} />
    </Drawer>}</>
}

function Inventory() {
  const [items, setItems] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Product | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { let mounted = true; listInventoryProducts().then(data => { if (mounted) setItems(data) }).catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar estoque.') }).finally(() => { if (mounted) setLoading(false) }); return () => { mounted = false } }, [])
  const filtered = items.filter(item => `${item.id} ${item.nome} ${item.tipo || ''} ${item.material || ''}`.toLowerCase().includes(query.toLowerCase()))
  async function submitMovement(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!open) return; setSaving(true); setError(''); const form = new FormData(event.currentTarget); try { const result = await moveInventory(open.id, { quantidade: Number(form.get('quantidade') || 0), justificativa: String(form.get('justificativa') || '') }); setItems(current => current.map(item => item.id === open.id ? { ...item, quantidade_estoque: result.novo_estoque } : item)); setOpen(null) } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao movimentar estoque.') } finally { setSaving(false) } }
  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    try {
      const updated = await updateProduct(editing.id, {
        nome: String(form.get('nome') || ''),
        tipo: String(form.get('tipo') || '') || null,
        material: String(form.get('material') || '') || null,
        preco_venda: Math.round(Number(form.get('preco_venda') || 0) * 100),
        estoque_minimo: Number(form.get('estoque_minimo') || 0),
      })
      setItems(current => current.map(item => item.id === updated.id ? updated : item)); setEditing(null)
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao atualizar produto.') } finally { setSaving(false) }
  }
  const critical = items.filter(item => item.quantidade_estoque <= item.estoque_minimo).length
  return <><PageHead eyebrow="GALPÃO · ESTOQUE" title="Controle de estoque" subtitle={`${items.length} itens sincronizados com o backend`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar código ou material..."/></>}/>{error && <p className="form-error" role="alert">{error}</p>}<section className="kpi-grid"><Kpi label="ITENS EM ESTOQUE" value={String(items.length)} note="ativos na API"/><Kpi label="ABAIXO DO MÍNIMO" value={String(critical)} note="repor esta semana"/><Kpi label="UNIDADES" value={String(items.reduce((total, item) => total + item.quantidade_estoque, 0))} note="saldo atual"/><Kpi dark label="STATUS" value={loading ? '...' : 'OK'} note="sincronização concluída"/></section><article className="card list-card"><div className="card-title"><h2>Itens</h2><Badge>{filtered.length} resultados</Badge></div>{loading ? <Skeleton rows={6} label="Carregando estoque" /> : <DataTable headers={['CÓDIGO','MATERIAL','CATEGORIA','#SALDO','#MÍNIMO','SITUAÇÃO','AÇÃO']} rows={filtered.map(item => { const low = item.quantidade_estoque <= item.estoque_minimo; return [<span className="mono">CAT-{String(item.id).padStart(4, '0')}</span>, <b>{item.nome}</b>, item.material || 'Sem material', item.quantidade_estoque, item.estoque_minimo, <Badge tone={low ? 'danger' : 'success'}>{low ? 'Crítico' : 'Normal'}</Badge>, <span className="row-actions"><Button variant="secondary" onClick={() => setOpen(item)}>Movimentar</Button> <button className="text-action" onClick={() => setEditing(item)}>Editar</button></span>] })}/>}</article>{open && <Modal title={`Movimentar · ${open.nome}`} close={() => setOpen(null)}><form className="modal-form" onSubmit={submitMovement}><label>Quantidade<input name="quantidade" type="number" min="1" step="1" required autoFocus placeholder="1"/></label><label>Justificativa<textarea name="justificativa" required placeholder="Reposição recebida, ajuste ou baixa operacional"/></label>{error && <p className="form-error" role="alert">{error}</p>}<footer><Button variant="secondary" onClick={() => setOpen(null)}>Cancelar</Button><Button type="submit" loading={saving}>{saving ? 'Salvando…' : 'Registrar movimentação'}</Button></footer></form></Modal>}{editing && <Modal title={`Editar · ${editing.nome}`} close={() => setEditing(null)}><form className="modal-form" onSubmit={submitEdit}><label>Nome<input name="nome" defaultValue={editing.nome} autoFocus required/></label><label>Categoria<input name="tipo" defaultValue={editing.tipo || ''}/></label><label>Material<input name="material" defaultValue={editing.material || ''}/></label><label>Preço de venda<input name="preco_venda" type="number" min="0" step="0.01" defaultValue={(editing.preco_venda/100).toFixed(2)} required/></label><label>Estoque mínimo<input name="estoque_minimo" type="number" min="0" step="1" defaultValue={editing.estoque_minimo}/></label>{error && <p className="form-error" role="alert">{error}</p>}<footer><Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" loading={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</Button></footer></form></Modal>}</>
}

function Catalog() {
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todos')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    listCatalogProducts()
      .then(data => { if (mounted) setProducts(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar catálogo.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const categories = ['Todos', ...Array.from(new Set(products.map(product => product.tipo).filter(Boolean) as string[]))]
  const filtered = products.filter(product =>
    (category === 'Todos' || product.tipo === category) &&
    `${product.id} ${product.nome} ${product.material || ''}`.toLowerCase().includes(query.toLowerCase()),
  )

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const created = await createCatalogProduct({
        nome: String(form.get('nome') || ''),
        tipo: String(form.get('tipo') || ''),
        material: String(form.get('material') || ''),
        preco_venda: Math.round(Number(form.get('preco_venda') || 0) * 100),
      })
      setProducts(current => [...current, created])
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar produto.')
    } finally {
      setSaving(false)
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const updated = await updateProduct(editing.id, {
        nome: String(form.get('nome') || ''),
        tipo: String(form.get('tipo') || '') || null,
        material: String(form.get('material') || '') || null,
        preco_venda: Math.round(Number(form.get('preco_venda') || 0) * 100),
        estoque_minimo: Number(form.get('estoque_minimo') || 0),
      })
      setProducts(current => current.map(product => product.id === updated.id ? updated : product))
      setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar produto.')
    } finally {
      setSaving(false)
    }
  }

  return <><PageHead eyebrow="GALPÃO · CATÁLOGO" title="Catálogo de produtos" subtitle={`${products.length} materiais vindos do estoque`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar produto, código ou material..."/><Button onClick={() => setOpen(true)}>+ Produto</Button></>}/>{error&&<p className="form-error" role="alert">{error}</p>}<div className="filter-row" role="group" aria-label="Filtrar categoria">{categories.map(item => <button key={item} className={category===item?'active':''} onClick={() => setCategory(item)}>{item}</button>)}</div>{loading?<article className="card" style={{ padding: 20 }}><Skeleton rows={4} label="Carregando catálogo" /></article>:<section className="product-grid">{filtered.map((product,index) => { const low = product.quantidade_estoque <= product.estoque_minimo; return <article className="card product-card" key={product.id}><div className={`material-swatch swatch-${index%6+1}`}><span>{product.tipo || 'Material'}</span></div><div className="product-copy"><p className="mono">CAT-{String(product.id).padStart(4,'0')}</p><h2>{product.nome}</h2><small>{product.material || 'Sem material informado'}</small><footer><b>{new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(product.preco_venda/100)}</b><Badge tone={low?'warning':'success'}>{low?'Baixo estoque':'Disponível'}</Badge></footer><button className="text-action" onClick={() => setEditing(product)}>Editar</button></div></article> })}</section>}{!loading&&!filtered.length&&<article className="card"><EmptyState title="Nenhum produto encontrado" description="Ajuste a busca ou escolha outra categoria." action={<Button variant="secondary" onClick={() => { setQuery(''); setCategory('Todos') }}>Limpar filtros</Button>} /></article>}{open&&<Modal title="Novo produto" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitProduct}><label>Nome<input name="nome" autoFocus required placeholder="MDF Carvalho Natural"/></label><label>Categoria<input name="tipo" required placeholder="Painéis"/></label><label>Material<input name="material" placeholder="Carvalho natural"/></label><label>Preço de venda<input name="preco_venda" type="number" min="0" step="0.01" required placeholder="0,00"/></label>{error&&<p className="form-error" role="alert">{error}</p>}<footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={saving}>{saving?'Salvando…':'Salvar produto'}</Button></footer></form></Modal>}{editing&&<Modal title={`Editar · ${editing.nome}`} close={() => setEditing(null)}><form className="modal-form" onSubmit={submitEdit}><label>Nome<input name="nome" defaultValue={editing.nome} autoFocus required/></label><label>Categoria<input name="tipo" defaultValue={editing.tipo || ''} required/></label><label>Material<input name="material" defaultValue={editing.material || ''}/></label><label>Preço de venda<input name="preco_venda" type="number" min="0" step="0.01" defaultValue={(editing.preco_venda/100).toFixed(2)} required/></label><label>Estoque mínimo<input name="estoque_minimo" type="number" min="0" step="1" defaultValue={editing.estoque_minimo}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<footer><Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" loading={saving}>{saving?'Salvando…':'Salvar alterações'}</Button></footer></form></Modal>}</>
}

function Suppliers() {
  const [items, setItems] = useState<Supplier[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    listSuppliers().then(data => { if (mounted) setItems(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar fornecedores.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const filtered = items.filter(item => `${item.nome_fantasia} ${item.cnpj || ''} ${item.contato || ''} ${item.email || ''}`.toLowerCase().includes(query.toLowerCase()))
  async function submitSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    const input: SupplierInput = {
      nome_fantasia: String(form.get('nome_fantasia') || ''), cnpj: String(form.get('cnpj') || '') || null,
      contato: String(form.get('contato') || '') || null, email: String(form.get('email') || '') || null,
      telefone: String(form.get('telefone') || '') || null, endereco: String(form.get('endereco') || '') || null,
      observacoes: String(form.get('observacoes') || '') || null, status: 'ativo', ativo: true,
    }
    try { const created = await createSupplier(input); setItems(current => [created, ...current]); setOpen(false) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar fornecedor.') }
    finally { setSaving(false) }
  }
  async function removeSupplier(item: Supplier) {
    if (!confirm(`Excluir o fornecedor "${item.nome_fantasia}"? Esta ação não pode ser desfeita.`)) return
    try { await deleteSupplier(item.id); setItems(current => current.filter(current_item => current_item.id !== item.id)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao excluir fornecedor.') }
  }
  return <><PageHead eyebrow="GALPÃO · PARCEIROS" title="Fornecedores" subtitle={`${items.length} fornecedores ativos carregados do backend`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar fornecedor, CNPJ ou contato..."/><Button onClick={() => setOpen(true)}>+ Fornecedor</Button></>}/>{error && <p className="form-error" role="alert">{error}</p>}<section className="kpi-grid compact-kpis"><Kpi label="FORNECEDORES ATIVOS" value={String(items.filter(item => item.ativo !== false).length)} note="sincronizados"/><Kpi label="RESULTADOS" value={String(filtered.length)} note="filtro atual"/><Kpi label="COM E-MAIL" value={String(items.filter(item => item.email).length)} note="contato digital"/><Kpi dark label="STATUS" value={loading ? '...' : 'OK'} note="sincronização concluída"/></section><article className="card list-card"><div className="card-title"><h2>Base de fornecedores</h2><Badge>{filtered.length} resultados</Badge></div>{loading ? <Skeleton rows={5} label="Carregando fornecedores" /> : <DataTable headers={['FORNECEDOR','CONTATO','DOCUMENTO','TELEFONE','STATUS','AÇÕES']} rows={filtered.map(item => [<b>{item.nome_fantasia}</b>, item.contato || item.email || 'Sem contato', item.cnpj || 'Não informado', item.telefone || 'Não informado', <Badge tone={item.ativo === false ? 'warning' : 'success'}>{item.ativo === false ? 'Inativo' : item.status || 'Ativo'}</Badge>, <button className="text-action" onClick={() => removeSupplier(item)}>Excluir</button>])}/>}</article>{open && <Modal title="Novo fornecedor" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitSupplier}><label>Razão social<input name="nome_fantasia" autoFocus required placeholder="Duratex"/></label><label>CNPJ<input name="cnpj" placeholder="00.000.000/0001-00"/></label><label>Contato<input name="contato" placeholder="Marina Lopes"/></label><label>E-mail<input name="email" type="email" placeholder="contato@fornecedor.com.br"/></label><label>Telefone<input name="telefone" placeholder="(11) 3442-8801"/></label><label>Endereço<input name="endereco" placeholder="Rua, número, cidade/UF"/></label><label>Observações<textarea name="observacoes" placeholder="Condições comerciais, prazo e homologação"/></label><footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={saving}>{saving ? 'Salvando…' : 'Salvar fornecedor'}</Button></footer></form></Modal>}</>
}

/**
 * Cadastro dos componentes de um serviço composto.
 *
 * É aqui que "Bancada Banheiro Completa" ganha bancada, saia, front e ilharga. Cada
 * componente tem unidade própria porque a marmoraria mede diferente em cada peça, e é
 * essa unidade que decide a fórmula do total quando o serviço entra num orçamento.
 */
function ComponentesServico({ servico, close, onChange }: { servico: Servico; close: () => void; onChange: (total: number) => void }) {
  const [itens, setItens] = useState<ServicoComponente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [nome, setNome] = useState('')
  const [unidade, setUnidade] = useState<UnidadeMedida>('m2')
  const [preco, setPreco] = useState('')
  const [obrigatorio, setObrigatorio] = useState(true)

  useEffect(() => {
    let vivo = true
    listServicoComponentes(servico.id)
      .then(dados => { if (vivo) { setItens(dados); onChange(dados.length) } })
      .catch(err => { if (vivo) setErro(err instanceof Error ? err.message : 'Falha ao carregar componentes.') })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servico.id])

  async function adicionar() {
    if (!nome.trim()) return
    setOcupado(true); setErro('')
    try {
      const criado = await createServicoComponente(servico.id, {
        nome: nome.trim(), obrigatorio, unidade_medida: unidade,
        preco_unitario: Math.round(Number(preco.replace(',', '.') || 0) * 100), ativo: true,
      })
      setItens(atual => { const proximo = [...atual, criado]; onChange(proximo.length); return proximo })
      setNome(''); setPreco('')
    } catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao adicionar componente.') }
    finally { setOcupado(false) }
  }

  async function alternarObrigatorio(item: ServicoComponente) {
    setOcupado(true); setErro('')
    try {
      const salvo = await updateServicoComponente(servico.id, item.id, { obrigatorio: !item.obrigatorio })
      setItens(atual => atual.map(i => i.id === salvo.id ? salvo : i))
    } catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao alterar.') }
    finally { setOcupado(false) }
  }

  async function excluir(item: ServicoComponente) {
    setOcupado(true); setErro('')
    try {
      await deleteServicoComponente(servico.id, item.id)
      setItens(atual => { const proximo = atual.filter(i => i.id !== item.id); onChange(proximo.length); return proximo })
    } catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao excluir.') }
    finally { setOcupado(false) }
  }

  const total = itens.filter(i => i.obrigatorio).reduce((soma, i) => soma + (i.preco_unitario || 0), 0)

  return <Drawer title={`Componentes · ${servico.nome}`} close={close}>
    <div className="modal-form">
      <p className="subtitle">Cada componente vira uma linha própria no orçamento. Os obrigatórios entram sempre; os opcionais o vendedor escolhe na hora.</p>
      {erro && <p className="form-error" role="alert">{erro}</p>}
      {carregando ? <Skeleton rows={3} label="Carregando componentes" /> : itens.length ? <div className="componentes-servico">
        {itens.map(item => <div className="componente-linha" key={item.id}>
          <span className="componente-check">
            <b>{item.nome}</b>
            <Badge tone={item.obrigatorio ? 'neutral' : 'warning'}>{item.obrigatorio ? 'Obrigatório' : 'Opcional'}</Badge>
            <small className="mono">{UNIDADE_ROTULO[item.unidade_medida]}</small>
          </span>
          <span className="componente-medidas">
            <em>{money(item.preco_unitario || 0)}</em>
            <button type="button" className="text-action" disabled={ocupado} onClick={() => void alternarObrigatorio(item)}>
              {item.obrigatorio ? 'Tornar opcional' : 'Tornar obrigatório'}
            </button>
            <HoldButton compacto disabled={ocupado} onConfirm={() => void excluir(item)} rotuloSegurando="Segure…">Excluir</HoldButton>
          </span>
        </div>)}
        <p className="componentes-total"><span>Mínimo do serviço (só obrigatórios)</span><strong>{money(total)}</strong></p>
      </div> : <EmptyState title="Nenhum componente" description="Sem componentes, este serviço entra no orçamento como uma linha única pelo preço padrão." />}

      <fieldset>
        <legend className="mono">NOVO COMPONENTE</legend>
        <label>Nome<input value={nome} onChange={e => setNome(e.target.value)} placeholder="Bancada, Saia, Front, Ilharga…" /></label>
        <label>Unidade de medida<Combobox ariaLabel="Unidade do componente" options={UNIDADE_OPTIONS} value={unidade} onChange={v => setUnidade(v as UnidadeMedida)} /></label>
        <label>Preço ({UNIDADE_PRECO_ROTULO[unidade]})<input type="text" inputMode="decimal" value={preco} onChange={e => setPreco(e.target.value)} placeholder="0,00" /></label>
        <div className="campo-toggle">
          <Toggle checked={obrigatorio} label="Obrigatório" ariaLabel="Componente obrigatório" onChange={() => setObrigatorio(!obrigatorio)} />
          <small>Obrigatório entra sempre; opcional o vendedor marca no orçamento.</small>
        </div>
      </fieldset>
      <footer><Button onClick={adicionar} disabled={ocupado || !nome.trim()}>Adicionar componente</Button></footer>
    </div>
  </Drawer>
}

function ServicesCatalog() {
  const [items, setItems] = useState<Servico[]>([])
  const [componentesDe, setComponentesDe] = useState<Servico | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tempoUnidade, setTempoUnidade] = useState('horas')

  useEffect(() => {
    let mounted = true
    listServicos().then(data => { if (mounted) setItems(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar serviços.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const filtered = items.filter(item => `${item.nome} ${item.descricao || ''}`.toLowerCase().includes(query.toLowerCase()))

  async function submitServico(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    const input: ServicoInput = {
      nome: String(form.get('nome') || ''),
      descricao: String(form.get('descricao') || '') || null,
      preco_padrao: Math.round(Number(form.get('preco_padrao') || 0) * 100),
      tempo_medio_valor: Number(form.get('tempo_medio_valor') || 1),
      tempo_medio_unidade: tempoUnidade as ServicoInput['tempo_medio_unidade'],
      ativo: true,
    }
    try { const created = await createServico(input); setItems(current => [created, ...current]); setOpen(false) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar serviço.') }
    finally { setSaving(false) }
  }
  async function removeServico(item: Servico) {
    if (!confirm(`Excluir o serviço "${item.nome}"? Esta ação não pode ser desfeita.`)) return
    try { await deleteServico(item.id); setItems(current => current.filter(i => i.id !== item.id)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao excluir serviço.') }
  }

  return <><PageHead eyebrow="GALPÃO · SERVIÇOS" title="Catálogo de serviços" subtitle={`${items.length} serviços cadastrados`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar serviço..."/><Button onClick={() => { setTempoUnidade('horas'); setOpen(true) }}>+ Serviço</Button></>}/>
    {error && <p className="form-error" role="alert">{error}</p>}
    <article className="card list-card"><div className="card-title"><h2>Serviços</h2><Badge>{filtered.length} resultados</Badge></div>
    {loading ? <Skeleton rows={5} label="Carregando serviços" /> : filtered.length ? <DataTable headers={['SERVIÇO','COMPONENTES','PREÇO PADRÃO','TEMPO MÉDIO','STATUS','AÇÕES']} rows={filtered.map(item => [
      <b>{item.nome}<small>{item.descricao || 'Sem descrição'}</small></b>,
      <button type="button" className="text-action" onClick={() => setComponentesDe(item)}>
        {item.componentes?.length ? `${item.componentes.length} componente(s)` : 'Cadastrar componentes'}
      </button>,
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_padrao / 100),
      `${item.tempo_medio_valor} ${item.tempo_medio_unidade}`,
      <Badge tone={item.ativo ? 'success' : 'warning'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge>,
      <button className="text-action" onClick={() => removeServico(item)}>Excluir</button>,
    ])}/> : <EmptyState title="Nenhum serviço cadastrado" description="Cadastre serviços como instalação e acabamento para usar no construtor de orçamento." action={<Button onClick={() => setOpen(true)}>+ Serviço</Button>} />}
    </article>
    {componentesDe && <ComponentesServico servico={componentesDe} close={() => setComponentesDe(null)}
      onChange={total => setItems(atual => atual.map(item => item.id === componentesDe.id
        ? { ...item, componentes: Array.from({ length: total }, (_, i) => (item.componentes?.[i] ?? ({ id: -i - 1 } as ServicoComponente))) }
        : item))} />}
    {open && <Modal title="Novo serviço" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitServico}>
      <label>Nome<input name="nome" autoFocus required placeholder="Instalação de bancada"/></label>
      <label>Descrição<textarea name="descricao" placeholder="Instalação de bancada de granito no local"/></label>
      <label>Preço padrão (R$)<input name="preco_padrao" type="number" min="0" step="0.01" required placeholder="500,00"/></label>
      <label>Tempo médio de execução<input name="tempo_medio_valor" type="number" min="1" required placeholder="3"/></label>
      <label>Unidade<Combobox name="tempo_medio_unidade" ariaLabel="Unidade do tempo médio" options={[{ value: 'horas', label: 'horas' }, { value: 'dias', label: 'dias' }]} value={tempoUnidade} onChange={setTempoUnidade} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={saving}>{saving ? 'Salvando…' : 'Salvar serviço'}</Button></footer>
    </form></Modal>}
  </>
}

function MateriaPrimaSection() {
  const [items, setItems] = useState<MateriaPrima[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [unidadeNova, setUnidadeNova] = useState('m2')

  useEffect(() => {
    let mounted = true
    listMateriaPrima().then(data => { if (mounted) setItems(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar matéria-prima.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function submitMateriaPrima(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    const custo = String(form.get('preco_custo') || '')
    const input: MateriaPrimaInput = {
      nome: String(form.get('nome') || ''), tipo_material: String(form.get('tipo_material') || '') || null,
      fornecedor_id: null, unidade_medida: unidadeNova as MateriaPrimaInput['unidade_medida'],
      quantidade_estoque: Number(form.get('quantidade_estoque') || 0),
      preco_custo: custo ? Math.round(Number(custo) * 100) : null,
      comprimento: null, largura: null, espessura: null,
      observacoes: String(form.get('observacoes') || '') || null, ativo: true,
    }
    try { const created = await createMateriaPrima(input); setItems(current => [created, ...current]); setOpen(false) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar matéria-prima.') }
    finally { setSaving(false) }
  }
  async function removeMateriaPrima(item: MateriaPrima) {
    if (!confirm(`Excluir "${item.nome}"? Esta ação não pode ser desfeita.`)) return
    try { await deleteMateriaPrima(item.id); setItems(current => current.filter(i => i.id !== item.id)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao excluir matéria-prima.') }
  }

  return <article className="card list-card" style={{ marginTop: 14 }}>
    <div className="card-title"><h2>Matéria-prima</h2><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Badge>{items.length} itens</Badge><Button onClick={() => { setUnidadeNova('m2'); setOpen(true) }}>+ Matéria-prima</Button></span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <Skeleton rows={4} label="Carregando matéria-prima" /> : items.length ? <DataTable headers={['MATERIAL','TIPO','ESTOQUE','CUSTO','AÇÕES']} rows={items.map(item => [
      <b>{item.nome}</b>, item.tipo_material || 'Não informado',
      `${item.quantidade_estoque} ${item.unidade_medida}`,
      item.preco_custo ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_custo / 100) : 'Não informado',
      <button className="text-action" onClick={() => removeMateriaPrima(item)}>Excluir</button>,
    ])}/> : <EmptyState title="Nenhuma matéria-prima cadastrada" description="Cadastre chapas de granito/mármore antes de virarem produto acabado." />}
    {open && <Modal title="Nova matéria-prima" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitMateriaPrima}>
      <label>Nome<input name="nome" autoFocus required placeholder="Granito Preto São Gabriel"/></label>
      <label>Tipo de material<input name="tipo_material" placeholder="Granito"/></label>
      <label>Unidade de medida<Combobox ariaLabel="Unidade de medida" options={[{ value: 'm2', label: 'm²' }, { value: 'un', label: 'un' }, { value: 'kg', label: 'kg' }]} value={unidadeNova} onChange={setUnidadeNova} /></label>
      <label>Quantidade em estoque<input name="quantidade_estoque" type="number" min="0" step="0.01" required placeholder="12.5"/></label>
      <label>Custo (R$)<input name="preco_custo" type="number" min="0" step="0.01" placeholder="350,00"/></label>
      <label>Observações<textarea name="observacoes"/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button></footer>
    </form></Modal>}
  </article>
}

function Equipment() {
  const [items, setItems] = useState<Equipamento[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [estadoNovo, setEstadoNovo] = useState('operante')
  const estadoOptions: ComboOption[] = [{ value: 'operante', label: 'Operante' }, { value: 'manutencao', label: 'Manutenção' }, { value: 'inativo', label: 'Inativo' }]

  useEffect(() => {
    let mounted = true
    listEquipamentos().then(data => { if (mounted) setItems(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar equipamentos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const filtered = items.filter(item => `${item.nome} ${item.tipo || ''} ${item.numero_serie || ''}`.toLowerCase().includes(query.toLowerCase()))

  async function submitEquipamento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    const input: EquipamentoInput = {
      nome: String(form.get('nome') || ''), tipo: String(form.get('tipo') || '') || null,
      estado: estadoNovo as EquipamentoInput['estado'], numero_serie: String(form.get('numero_serie') || '') || null,
      data_aquisicao: null, observacoes: String(form.get('observacoes') || '') || null, ativo: true,
    }
    try { const created = await createEquipamento(input); setItems(current => [created, ...current]); setOpen(false) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar equipamento.') }
    finally { setSaving(false) }
  }
  async function mudarEstado(item: Equipamento, estado: string) {
    try { const updated = await updateEquipamento(item.id, { estado: estado as EquipamentoInput['estado'] }); setItems(current => current.map(i => i.id === updated.id ? updated : i)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao atualizar equipamento.') }
  }
  async function removeEquipamento(item: Equipamento) {
    if (!confirm(`Excluir o equipamento "${item.nome}"? Esta ação não pode ser desfeita.`)) return
    try { await deleteEquipamento(item.id); setItems(current => current.filter(i => i.id !== item.id)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao excluir equipamento.') }
  }

  return <><PageHead eyebrow="GALPÃO · MÁQUINAS" title="Equipamentos" subtitle={`${items.length} equipamentos cadastrados`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar equipamento..."/><Button onClick={() => { setEstadoNovo('operante'); setOpen(true) }}>+ Equipamento</Button></>}/>
    {error && <p className="form-error" role="alert">{error}</p>}
    <article className="card list-card"><div className="card-title"><h2>Máquinas e ferramentas</h2><Badge>{filtered.length} resultados</Badge></div>
    {loading ? <Skeleton rows={5} label="Carregando equipamentos" /> : filtered.length ? <DataTable headers={['EQUIPAMENTO','TIPO','Nº DE SÉRIE','ESTADO','AÇÕES']} rows={filtered.map(item => [
      <b>{item.nome}</b>, item.tipo || 'Não informado', item.numero_serie || 'Não informado',
      <Combobox compact ariaLabel={`Estado de ${item.nome}`} options={estadoOptions} value={item.estado} onChange={value => mudarEstado(item, value)} />,
      <button className="text-action" onClick={() => removeEquipamento(item)}>Excluir</button>,
    ])}/> : <EmptyState title="Nenhum equipamento cadastrado" description="Cadastre cortadeiras, policortes e demais máquinas do galpão." action={<Button onClick={() => setOpen(true)}>+ Equipamento</Button>} />}
    </article>
    {open && <Modal title="Novo equipamento" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitEquipamento}>
      <label>Nome<input name="nome" autoFocus required placeholder="Policorte"/></label>
      <label>Tipo<input name="tipo" placeholder="Corte"/></label>
      <label>Número de série<input name="numero_serie" placeholder="PC-001"/></label>
      <label>Estado<Combobox ariaLabel="Estado do equipamento" options={estadoOptions} value={estadoNovo} onChange={setEstadoNovo} /></label>
      <label>Observações<textarea name="observacoes" placeholder="Condição, localização no galpão..."/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={saving}>{saving ? 'Salvando…' : 'Salvar equipamento'}</Button></footer>
    </form></Modal>}
    <MateriaPrimaSection/>
  </>
}

const motivoPerdaLabel: Record<string, string> = { quebra_manuseio: 'Quebra no manuseio', quebra_transporte: 'Quebra no transporte', defeito_fabricacao: 'Defeito de fabricação', corte_errado: 'Corte errado', armazenamento_inadequado: 'Armazenamento inadequado', outro: 'Outro' }

function Losses() {
  const [items, setItems] = useState<PerdaAvaria[]>([])
  const [produtos, setProdutos] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [motivo, setMotivo] = useState('quebra_manuseio')
  const motivoOptions: ComboOption[] = Object.entries(motivoPerdaLabel).map(([value, label]) => ({ value, label }))

  useEffect(() => {
    let mounted = true
    Promise.all([listPerdas(), listInventoryProducts()])
      .then(([perdas, prods]) => { if (mounted) { setItems(perdas); setProdutos(prods) } })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar perdas e avarias.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const produtoOptions: ComboOption[] = produtos.map(p => ({ value: String(p.id), label: p.nome, meta: `${p.quantidade_estoque} em estoque` }))

  async function submitPerda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    try {
      if (!produtoId) throw new Error('Selecione o produto afetado.')
      const quantidade = Number(form.get('quantidade') || 1)
      const created = await createPerda({
        produto_id: Number(produtoId), quantidade,
        motivo: motivo as PerdaAvariaInput['motivo'], justificativa: String(form.get('justificativa') || ''),
      })
      setItems(current => [created, ...current]); setOpen(false)
      setProdutos(current => current.map(p => p.id === created.produto_id ? { ...p, quantidade_estoque: p.quantidade_estoque - quantidade } : p))
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao registrar perda.') }
    finally { setSaving(false) }
  }

  return <><PageHead eyebrow="GALPÃO · ESTOQUE" title="Perdas e Avarias" subtitle={`${items.length} registros`} actions={<Button onClick={() => { setProdutoId(''); setMotivo('quebra_manuseio'); setError(''); setOpen(true) }}>+ Registrar perda</Button>}/>
    {error && !open && <p className="form-error" role="alert">{error}</p>}
    <article className="card list-card"><div className="card-title"><h2>Registros</h2><Badge>{items.length} resultados</Badge></div>
    {loading ? <Skeleton rows={5} label="Carregando perdas e avarias" /> : items.length ? <DataTable headers={['#DATA','PRODUTO','QUANTIDADE','MOTIVO','JUSTIFICATIVA','REGISTRADO POR']} rows={items.map(item => [
      new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(item.data_ocorrencia)),
      item.produto_nome || `Produto #${item.produto_id}`, String(item.quantidade),
      <Badge tone="danger">{motivoPerdaLabel[item.motivo] || item.motivo}</Badge>,
      item.justificativa, item.usuario_nome || 'Sistema',
    ])}/> : <EmptyState title="Nenhuma perda registrada" description="Registre quebras e avarias de estoque para manter o saldo correto." action={<Button onClick={() => setOpen(true)}>+ Registrar perda</Button>} />}
    </article>
    {open && <Modal title="Registrar perda ou avaria" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitPerda}>
      <label>Produto afetado<Combobox ariaLabel="Produto afetado" searchPlaceholder="Buscar produto…" options={produtoOptions} value={produtoId} onChange={setProdutoId} /></label>
      <label>Quantidade<input name="quantidade" type="number" min="1" required defaultValue={1}/></label>
      <label>Motivo<Combobox ariaLabel="Motivo" options={motivoOptions} value={motivo} onChange={setMotivo} /></label>
      <label>Justificativa<textarea name="justificativa" required minLength={3} placeholder="O que aconteceu..."/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={saving}>{saving ? 'Registrando…' : 'Registrar perda'}</Button></footer>
    </form></Modal>}
  </>
}

function QuotesList() {
  const [items, setItems] = useState<Quote[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    listQuotes().then(data => { if (mounted) setItems(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar orçamentos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const filtered = items.filter(item => `${item.cliente_nome || ''} ${item.tipo_orcamento} ${item.status} ${item.id}`.toLowerCase().includes(query.toLowerCase()))

  return <><PageHead eyebrow="ORÇAMENTOS · TODOS OS REGISTROS" title="Listagem de orçamentos" subtitle={`${items.length} orçamentos, todos os status`} actions={<input className="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente, tipo ou status..."/>}/>
    {error && <p className="form-error" role="alert">{error}</p>}
    <article className="card list-card"><div className="card-title"><h2>Orçamentos</h2><Badge>{filtered.length} resultados</Badge></div>
    {loading ? <Skeleton rows={6} label="Carregando orçamentos" /> : filtered.length ? <DataTable headers={['ORÇAMENTO','CLIENTE','TIPO','STATUS','#CRIADO EM','VALOR']} rows={filtered.map(item => [
      <div className="person-link" role="button" tabIndex={0} onClick={() => { location.hash = `orcamento/${item.id}` }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.hash = `orcamento/${item.id}` } }}><b>ORC-{String(item.id).padStart(4, '0')}</b></div>,
      item.cliente_nome || 'Sem cliente', item.tipo_orcamento,
      <Badge tone={(columnByBackendStatus[item.status] || 'Gerando').toLowerCase()}>{item.status}</Badge>,
      new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(item.created_at)),
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((item.valor_total || 0) / 100),
    ])}/> : <EmptyState title="Nenhum orçamento encontrado" description="Orçamentos criados no construtor aparecem aqui." />}
    </article>
  </>
}

function SalesHistory() {
  const [items, setItems] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    listVendas().then(data => { if (mounted) setItems(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar histórico de vendas.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const total = items.reduce((sum, v) => sum + v.valor_total, 0)

  return <><PageHead eyebrow="VENDAS · HISTÓRICO" title="Histórico de vendas" subtitle={`${items.length} vendas · ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total / 100)} no total`}/>
    {error && <p className="form-error" role="alert">{error}</p>}
    <article className="card list-card"><div className="card-title"><h2>Vendas</h2><Badge>{items.length} resultados</Badge></div>
    {loading ? <Skeleton rows={5} label="Carregando vendas" /> : items.length ? <DataTable headers={['VENDA','ORÇAMENTO','CLIENTE','VENDEDOR','#DATA','VALOR']} rows={items.map(item => [
      `VDA-${String(item.id).padStart(4, '0')}`,
      <div className="person-link" role="button" tabIndex={0} onClick={() => { location.hash = `orcamento/${item.orcamento_id}` }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.hash = `orcamento/${item.orcamento_id}` } }}>ORC-{String(item.orcamento_id).padStart(4, '0')}</div>,
      item.cliente_nome || 'Sem cliente', item.vendedor_nome || 'Sem vendedor',
      new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(item.data_venda)),
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_total / 100),
    ])}/> : <EmptyState title="Nenhuma venda registrada" description="Aprove um orçamento e converta em venda na tela de detalhe para aparecer aqui." />}
    </article>
  </>
}


const deliveryEvents: Record<number, [string,string,string][]> = { 3:[['Entrega','Casa Ibiúna','09:00'],['Reunião','Incorporadora Ventura','14:30']], 8:[['Medição','Escritório Faria Lima','10:00']], 12:[['Faturamento','Apto Vila Madalena','08:30']], 17:[['Retirada','MDF · Duratex','16:00']], 24:[['Entrega','Loja Pinheiros','11:00']], 29:[['Montagem','Hotel Santa Cecília','07:30']] }
function Schedule() {
  const today = new Date()
  const [viewDate,setViewDate]=useState(()=>new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected,setSelected]=useState(today.getDate())
  const [view,setView]=useState<'Mês'|'Semana'>('Mês'); const [events,setEvents]=useState<CalendarEvent[]>([]); const [error,setError]=useState(''); const [eventOpen,setEventOpen]=useState(false); const [feedback,setFeedback]=useState('')
  useEffect(() => { listCalendarEvents().then(setEvents).catch(err => setError(err instanceof Error ? err.message : 'Agenda offline. Exibindo visão local.')) }, [])

  const isCurrentMonth = viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth()
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  const days = Array.from({length: daysInMonth},(_,i)=>i+1)

  const apiEvents: Record<number, [string,string,string][]> = {}
  events.forEach(event => { const date = new Date(event.start); if (date.getFullYear() === viewDate.getFullYear() && date.getMonth() === viewDate.getMonth()) { const day = date.getDate(); (apiEvents[day] ||= []).push([event.tipo, event.cliente_nome, date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})]) } })
  const usingLocalFallback = !Object.keys(apiEvents).length
  const calendarEvents = usingLocalFallback ? deliveryEvents : apiEvents
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(viewDate)

  function changeMonth(delta: number) {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1)
    setViewDate(next)
    const sameMonth = next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth()
    setSelected(sameMonth ? today.getDate() : 1)
  }

  return <><PageHead eyebrow="GESTÃO · AGENDA" title="Calendário de entregas" subtitle={`${Object.values(calendarEvents).flat().length} eventos · fonte ${events.length && !usingLocalFallback ? 'backend' : 'local'}`} actions={<><div className="segmented"><button className={view==='Mês'?'active':''} onClick={()=>setView('Mês')}>Mês</button><button className={view==='Semana'?'active':''} onClick={()=>setView('Semana')}>Semana</button></div><Button onClick={()=>setEventOpen(true)}>+ Evento</Button></>}/>{error&&<p className="form-error" role="status">{error}</p>}<section className="schedule-layout"><article className="card month-card"><header><button aria-label="Mês anterior" onClick={()=>changeMonth(-1)}>‹</button><h2>{monthLabel[0].toUpperCase()+monthLabel.slice(1)} <span>{viewDate.getFullYear()}</span></h2><button aria-label="Próximo mês" onClick={()=>changeMonth(1)}>›</button></header><div className="calendar-weekdays">{['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map(x=><span key={x}>{x}</span>)}</div><div className={`month-grid ${view==='Semana'?'week-view':''}`}>{days.map(day=><button key={day} className={`${day===selected?'selected':''} ${isCurrentMonth&&day===today.getDate()?'today':''}`} onClick={()=>setSelected(day)}><span>{day}</span>{calendarEvents[day]?.map((e,i)=><i className={`event-dot dot-${i}`} key={e[0]} title={e[0]}/>)}</button>)}</div></article><aside className="card day-panel"><p className="eyebrow">{String(selected).padStart(2,'0')} DE {monthLabel.toUpperCase()}</p><h2>{isCurrentMonth&&selected===today.getDate()?'Hoje':'Agenda do dia'}</h2>{(calendarEvents[selected]||[]).map((event,i)=><article className="event-card" key={event[0]}><i className={`dot-${i}`}/><div><b>{event[0]}</b><p>{event[1]}</p><small>{event[2]}</small></div></article>)}{!calendarEvents[selected]&&<div className="empty-day"><p>Dia livre.</p><small>Nenhuma entrega, medição ou retirada.</small></div>}</aside></section>{eventOpen&&<Modal title="Novo evento" close={()=>setEventOpen(false)}><form className="modal-form" onSubmit={e=>{e.preventDefault();setEventOpen(false);setFeedback('Evento salvo como rascunho.')}}><label>Título<input name="title" required autoFocus placeholder="Entrega, medição ou retirada…"/></label><label>Data<input name="date" type="date" required/></label><label>Horário<input name="time" type="time" required/></label><footer><Button variant="secondary" onClick={()=>setEventOpen(false)}>Cancelar</Button><Button type="submit">Salvar evento</Button></footer></form></Modal>}{feedback&&<Feedback message={feedback} close={()=>setFeedback('')}/>}</>
}

function Team() {
  const [items, setItems] = useState<TeamMember[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [novoPerfil, setNovoPerfil] = useState('vendedor')
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [selfId, setSelfId] = useState<number | null>(null)
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qr_code_url: string } | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [mfaError, setMfaError] = useState('')
  const [disableMfaOpen, setDisableMfaOpen] = useState(false)
  const [disableMfaPassword, setDisableMfaPassword] = useState('')

  useEffect(() => {
    let mounted = true
    listTeam().then(data => { if (mounted) setItems(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar equipe.') })
      .finally(() => { if (mounted) setLoading(false) })
    getSessionUser().then(data => { if (mounted) setSelfId(data.id) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  function closeEditing() { setEditing(null); setMfaSetup(null); setMfaCode(''); setMfaError(''); setDisableMfaOpen(false); setDisableMfaPassword('') }

  async function confirmDisableMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setMfaError(''); setMfaBusy(true)
    try {
      await disableMfa(disableMfaPassword)
      setItems(current => current.map(item => item.id === editing.id ? { ...item, mfa_enabled: false } : item))
      setEditing(current => current ? { ...current, mfa_enabled: false } : current)
      setDisableMfaOpen(false); setDisableMfaPassword(''); setFeedback('MFA desativado.')
    } catch (err) { setMfaError(err instanceof Error ? err.message : 'Falha ao desativar MFA.') }
    finally { setMfaBusy(false) }
  }

  async function startMfaSetup() {
    setMfaError(''); setMfaBusy(true)
    try { setMfaSetup(await enableMfa()) }
    catch (err) { setMfaError(err instanceof Error ? err.message : 'Falha ao iniciar configuração do MFA.') }
    finally { setMfaBusy(false) }
  }

  async function confirmMfaSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setMfaError(''); setMfaBusy(true)
    try {
      await verifyMfa(mfaCode)
      setItems(current => current.map(item => item.id === editing.id ? { ...item, mfa_enabled: true } : item))
      setEditing(current => current ? { ...current, mfa_enabled: true } : current)
      setMfaSetup(null); setMfaCode(''); setFeedback('MFA ativado com sucesso.')
    } catch (err) { setMfaError(err instanceof Error ? err.message : 'Código inválido.') }
    finally { setMfaBusy(false) }
  }

  const roleLabel: Record<string, string> = { admin: 'Admin', vendedor: 'Vendedor', estoquista: 'Estoquista' }
  const rows = items.filter(item => `${item.nome} ${item.email}`.toLowerCase().includes(query.toLowerCase()))

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    const input: TeamMemberInput = {
      nome: String(form.get('nome') || ''), email: String(form.get('email') || ''),
      password: String(form.get('password') || ''), role: String(form.get('role') || 'vendedor') as TeamMemberInput['role'],
      contato: String(form.get('contato') || '') || null,
    }
    try { const created = await createTeamMember(input); setItems(current => [...current, created]); setOpen(false); setFeedback(`Acesso concedido para ${created.nome}.`) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao conceder acesso.') }
    finally { setSaving(false) }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    try {
      const updated = await updateTeamMember(editing.id, { nome: String(form.get('nome') || ''), contato: String(form.get('contato') || '') || null })
      setItems(current => current.map(item => item.id === updated.id ? updated : item)); setEditing(null)
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao atualizar membro.') }
    finally { setSaving(false) }
  }

  async function deactivate(member: TeamMember) {
    if (!confirm(`Desligar o acesso de "${member.nome}"?`)) return
    try { await deactivateTeamMember(member.id); setItems(current => current.map(item => item.id === member.id ? { ...item, ativo: false } : item)); setEditing(null); setFeedback(`Acesso de ${member.nome} revogado.`) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao desligar acesso.') }
  }

  const activeCount = items.filter(item => item.ativo).length
  const suspendedCount = items.length - activeCount
  const mfaCount = items.filter(item => item.mfa_enabled).length

  return <><PageHead eyebrow="GESTÃO · ACESSOS" title="Equipe" subtitle={`${items.length} pessoas · ${activeCount} acessos ativos`} actions={<><input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nome ou e-mail…"/><Button onClick={()=>{ setNovoPerfil('vendedor'); setOpen(true) }}>+ Conceder acesso</Button></>}/>{error&&<p className="form-error" role="alert">{error}</p>}<section className="team-stats"><article className="card"><span>{String(activeCount).padStart(2,'0')}</span><div><h2>Acessos ativos</h2><p>Colaboradores com acesso imediato.</p></div></article><article className="card"><span>{String(suspendedCount).padStart(2,'0')}</span><div><h2>Acesso suspenso</h2><p>Conta preservada sem login permitido.</p></div></article><article className="card security-card"><span>{mfaCount}</span><div><h2>Com MFA ativo</h2><p>Segundo fator habilitado.</p></div></article></section><article className="card list-card"><div className="card-title"><h2>Membros</h2><Badge>{rows.length} pessoas</Badge></div>{loading ? <Skeleton rows={4} label="Carregando equipe" /> : <DataTable headers={['NOME / E-MAIL','CARGO','STATUS DO ACESSO','MFA','AÇÕES']} rows={rows.map(item=>[<div className="person"><span>{item.nome.split(' ').map(part=>part[0]).slice(0,2).join('')}</span><b>{item.nome}<small>{item.email}</small></b></div>,<Badge tone="neutral">{roleLabel[item.role]||item.role}</Badge>,<Badge tone={item.ativo?'success':'danger'}>{item.ativo?'Ativo':'Suspenso'}</Badge>,item.mfa_enabled?'✓':'—',<button className="text-action" onClick={()=>setEditing(item)}>Gerenciar</button>])}/>}</article>{open&&<Modal title="Conceder acesso" close={()=>setOpen(false)}><form className="modal-form" onSubmit={submitInvite}><label>Nome<input name="nome" autoFocus required/></label><label>E-mail<input name="email" type="email" required/></label><label>Senha provisória<input name="password" type="password" required minLength={8} placeholder="Mín. 8 caracteres, maiúscula, minúscula, número e símbolo"/></label><label>Telefone<input name="contato" placeholder="(11) 99999-9999"/></label><label>Perfil<Combobox name="role" ariaLabel="Perfil" options={perfilOptions} value={novoPerfil} onChange={setNovoPerfil} /></label>{error&&<p className="form-error" role="alert">{error}</p>}<footer><Button variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit" loading={saving}>{saving?'Salvando…':'Conceder acesso'}</Button></footer></form></Modal>}{editing&&<Modal title={`Gerenciar · ${editing.nome}`} close={closeEditing}><form className="modal-form" onSubmit={submitEdit}><label>Nome<input name="nome" defaultValue={editing.nome} autoFocus required/></label><label>Telefone<input name="contato" defaultValue={editing.contato||''}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<footer>{editing.ativo&&<Button variant="secondary" onClick={()=>deactivate(editing)}>Desligar acesso</Button>}<Button type="submit" loading={saving}>{saving?'Salvando…':'Salvar'}</Button></footer></form>
  {editing.id===selfId && <div className="modal-form" style={{ gridTemplateColumns: '1fr', borderTop: '1px solid var(--border, #e5e5e5)', paddingTop: '1rem', marginTop: '1rem' }}>
    <p className="mono">AUTENTICAÇÃO EM DUAS ETAPAS</p>
    {editing.mfa_enabled ? (disableMfaOpen ? <form onSubmit={confirmDisableMfa} className="modal-form" style={{ gridTemplateColumns: '1fr' }}>
        <p>Confirme sua senha atual para desativar o MFA.</p>
        <label>Senha<input type="password" value={disableMfaPassword} onChange={e=>setDisableMfaPassword(e.target.value)} autoFocus required/></label>
        {mfaError&&<p className="form-error" role="alert">{mfaError}</p>}
        <footer><Button type="button" variant="secondary" onClick={()=>{setDisableMfaOpen(false);setDisableMfaPassword('');setMfaError('')}}>Cancelar</Button><Button type="submit" disabled={mfaBusy}>{mfaBusy?'Desativando…':'Confirmar e desativar'}</Button></footer>
      </form>
    : <><p className="empty-state">MFA está ativo na sua conta.</p>{mfaError&&<p className="form-error" role="alert">{mfaError}</p>}<Button type="button" variant="secondary" onClick={()=>setDisableMfaOpen(true)}>Desativar MFA</Button></>)
    : mfaSetup ? <form onSubmit={confirmMfaSetup} className="modal-form" style={{ gridTemplateColumns: '1fr' }}>
        <p>No seu aplicativo autenticador (Google Authenticator, Authy…), adicione uma conta manualmente e informe a chave abaixo:</p>
        <label>Chave manual<input readOnly value={mfaSetup.secret} onFocus={e=>e.currentTarget.select()}/></label>
        <label>Código do aplicativo<input value={mfaCode} onChange={e=>setMfaCode(e.target.value)} placeholder="428913" autoFocus required/></label>
        {mfaError&&<p className="form-error" role="alert">{mfaError}</p>}
        <footer><Button type="button" variant="secondary" onClick={()=>{setMfaSetup(null);setMfaCode('');setMfaError('')}}>Cancelar</Button><Button type="submit" disabled={mfaBusy}>{mfaBusy?'Verificando…':'Confirmar e ativar'}</Button></footer>
      </form>
    : <><p className="empty-state">Adicione uma camada extra de segurança à sua conta.</p>{mfaError&&<p className="form-error" role="alert">{mfaError}</p>}<Button type="button" variant="secondary" onClick={startMfaSetup} disabled={mfaBusy}>{mfaBusy?'Gerando…':'Ativar MFA'}</Button></>}
  </div>}
</Modal>}{feedback&&<Feedback message={feedback} close={()=>setFeedback('')}/>}</>
}

/** Nome do escritorio exibido ao lado da marca. Gravar exige admin (o PUT recusa o resto). */
function CoMarca() {
  const [nome, setNome] = useState('')
  const [inicial, setInicial] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState(false)

  useEffect(() => {
    let vivo = true
    getOrcamentoConfig().then(config => {
      if (!vivo) return
      const atual = config.organizacao_nome || ''
      setNome(atual); setInicial(atual)
    }).catch(() => undefined)
    return () => { vivo = false }
  }, [])

  async function salvar() {
    setSalvando(true); setErro(''); setFeito(false)
    try {
      const config = await updateOrcamentoConfig({ organizacao_nome: nome.trim() || null })
      const gravado = config.organizacao_nome || ''
      setNome(gravado); setInicial(gravado); setFeito(true)
    } catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao salvar o nome.') }
    finally { setSalvando(false) }
  }

  return <article className="card" style={{ padding: 20, marginTop: 14 }}>
    <div className="card-title"><h2>Co-marca</h2><span className="mono">IDENTIDADE</span></div>
    <p className="subtitle" style={{ marginBottom: 14 }}>O nome do escritório aparece ao lado da marca — na barra lateral, no portal do cliente e no PDF. Deixe vazio para exibir apenas ARC.</p>
    <div className="comarca-editor">
      <label>Nome do escritório<input value={nome} maxLength={40} placeholder="Stone" onChange={event => setNome(event.target.value)}/></label>
      <div className="comarca-previa"><span className="item-detalhe-rotulo">Prévia</span><div className="logo" aria-hidden="true"><strong>ARC</strong>{nome.trim() && <em className="logo-cobranca"><i>•</i>{nome.trim()}</em>}</div></div>
      <Button onClick={() => void salvar()} loading={salvando} disabled={nome.trim() === inicial.trim()}>Salvar nome</Button>
    </div>
    {erro && <p className="form-error" role="alert">{erro}</p>}
    {feito && !erro && <p className="subtitle" role="status">Nome salvo. A barra lateral acompanha no próximo carregamento.</p>}
  </article>
}

/**
 * Condições de pagamento oferecidas no construtor de orçamento. Gravar exige admin — a rota
 * recusa o resto com 403, e o erro aparece na própria tela em vez de sumir.
 */
/**
 * CRUD de um catalogo configuravel. Um unico componente serve os cinco catalogos.
 *
 * Reordenacao por botoes ↑/↓ em vez de arrastar: sao listas de 4-15 itens editadas
 * raramente por um admin, e botoes dao teclado e leitor de tela de graca — um DnD
 * acessivel precisaria de ↑/↓ como alternativa de qualquer forma.
 */
function CatalogoConfiguravel<T extends ItemCatalogo>({ titulo, descricao, acoes, placeholderNovo, colunaExtra }: {
  titulo: string
  /** Diz ONDE o item aparece para o usuario final — sem isso o admin edita no escuro. */
  descricao: string
  acoes: AcoesCatalogo<T>
  placeholderNovo: string
  colunaExtra?: { cabecalho: string; render: (item: T) => ReactNode }
}) {
  const [itens, setItens] = useState<T[]>([])
  const [nova, setNova] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    acoes.listar()
      .then(dados => { if (vivo) setItens(dados) })
      .catch(err => { if (vivo) setErro(err instanceof Error ? err.message : 'Falha ao carregar.') })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function adicionar(event: FormEvent) {
    event.preventDefault()
    const nome = nova.trim()
    if (!nome) return
    setOcupado(true); setErro('')
    try { const criado = await acoes.criar(nome); setItens(atual => [...atual, criado]); setNova('') }
    catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao criar.') }
    finally { setOcupado(false) }
  }

  async function renomear(item: T) {
    const nome = window.prompt('Novo nome:', item.nome)?.trim()
    if (!nome || nome === item.nome) return
    if (nome.length > 120) { setErro('O nome pode ter no máximo 120 caracteres.'); return }
    setOcupado(true); setErro('')
    try { const salvo = await acoes.atualizar(item.id, { nome }); setItens(atual => atual.map(i => i.id === salvo.id ? salvo : i)) }
    catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao renomear.') }
    finally { setOcupado(false) }
  }

  async function alternar(item: T) {
    setOcupado(true); setErro('')
    try { const salvo = await acoes.atualizar(item.id, { ativo: !item.ativo }); setItens(atual => atual.map(i => i.id === salvo.id ? salvo : i)) }
    catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao alterar.') }
    finally { setOcupado(false) }
  }

  async function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao
    if (destino < 0 || destino >= itens.length) return
    const anterior = itens
    // Troca otimista: a lista responde na hora e reverte se o servidor recusar.
    const reordenado = [...itens]
    const [movido] = reordenado.splice(indice, 1)
    reordenado.splice(destino, 0, movido)
    setItens(reordenado)
    setErro('')
    try { setItens(await acoes.reordenar(reordenado.map(i => i.id))) }
    catch (err) { setItens(anterior); setErro(err instanceof Error ? err.message : 'Falha ao reordenar.') }
  }

  async function excluir(item: T) {
    setOcupado(true); setErro('')
    try { await acoes.excluir(item.id); setItens(atual => atual.filter(i => i.id !== item.id)) }
    catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao excluir.') }
    finally { setOcupado(false) }
  }

  const cabecalhos = ['ORDEM', 'NOME', ...(colunaExtra ? [colunaExtra.cabecalho] : []), 'STATUS', 'AÇÕES']

  return <article className="card list-card" style={{ marginTop: 14 }}>
    <div className="card-title"><h2>{titulo}</h2><Badge>{itens.length}</Badge></div>
    <p className="subtitle" style={{ padding: '0 16px 12px' }}>{descricao}</p>
    {erro && <p className="form-error" role="alert" style={{ padding: '0 16px' }}>{erro}</p>}
    {carregando ? <Skeleton rows={3} label={`Carregando ${titulo.toLowerCase()}`} /> : itens.length ? <DataTable headers={cabecalhos} rows={itens.map((item, indice) => [
      <span className="catalogo-ordem">
        <button type="button" aria-label={`Mover «${item.nome}» para cima`} disabled={indice === 0} onClick={() => void mover(indice, -1)}>↑</button>
        <button type="button" aria-label={`Mover «${item.nome}» para baixo`} disabled={indice === itens.length - 1} onClick={() => void mover(indice, 1)}>↓</button>
      </span>,
      <span><b>{item.nome}</b>{item.built_in && <> <Badge>Padrão do sistema</Badge></>}</span>,
      ...(colunaExtra ? [colunaExtra.render(item)] : []),
      <Toggle checked={item.ativo} disabled={ocupado} ariaLabel={`${item.nome} ativo`} label={item.ativo ? 'Ativo' : 'Inativo'} onChange={() => void alternar(item)} />,
      <span>
        <button type="button" className="text-action" disabled={ocupado} onClick={() => void renomear(item)}>Renomear</button>{' '}
        {/* Item padrao nao some da lista: botao ausente parece bug, e habilitado so daria 400. */}
        <HoldButton compacto disabled={ocupado || item.built_in} title={item.built_in ? 'Item padrão do sistema — pode ser desativado, não excluído.' : undefined} onConfirm={() => void excluir(item)} rotuloSegurando="Segure…">Excluir</HoldButton>
      </span>,
    ])} /> : <EmptyState title="Nada cadastrado" description={`Adicione o primeiro item de ${titulo.toLowerCase()}.`} />}
    <form className="condicao-nova" onSubmit={adicionar}>
      <input value={nova} onChange={event => setNova(event.target.value)} placeholder={placeholderNovo} aria-label={`Novo item em ${titulo}`} />
      <Button type="submit" variant="secondary" disabled={ocupado || !nova.trim()}>Adicionar</Button>
    </form>
  </article>
}

/** Formas de pagamento dependem do tipo pai, entao nao usam o catalogo generico. */
function FormasPagamentoConfig() {
  const [tipos, setTipos] = useState<TipoPagamento[]>([])
  const [formas, setFormas] = useState<FormaPagamento[]>([])
  const [tipoId, setTipoId] = useState<number | ''>('')
  const [nova, setNova] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    Promise.all([catalogoTiposPagamento.listar(), catalogoFormasPagamento.listar()])
      .then(([t, f]) => { if (!vivo) return; setTipos(t); setFormas(f) })
      .catch(err => { if (vivo) setErro(err instanceof Error ? err.message : 'Falha ao carregar.') })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [])

  const tiposComForma = tipos.filter(tipo => tipo.exige_forma)

  async function adicionar(event: FormEvent) {
    event.preventDefault()
    if (tipoId === '' || !nova.trim()) return
    setOcupado(true); setErro('')
    try { const criada = await catalogoFormasPagamento.criar(nova.trim(), Number(tipoId)); setFormas(atual => [...atual, criada]); setNova('') }
    catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao criar a forma.') }
    finally { setOcupado(false) }
  }

  async function alternar(forma: FormaPagamento) {
    setOcupado(true); setErro('')
    try { const salva = await catalogoFormasPagamento.atualizar(forma.id, { ativo: !forma.ativo }); setFormas(atual => atual.map(f => f.id === salva.id ? salva : f)) }
    catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao alterar.') }
    finally { setOcupado(false) }
  }

  async function excluir(forma: FormaPagamento) {
    setOcupado(true); setErro('')
    try { await catalogoFormasPagamento.excluir(forma.id); setFormas(atual => atual.filter(f => f.id !== forma.id)) }
    catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao excluir.') }
    finally { setOcupado(false) }
  }

  return <article className="card list-card" style={{ marginTop: 14 }}>
    <div className="card-title"><h2>Formas de pagamento</h2><Badge>{formas.length}</Badge></div>
    <p className="subtitle" style={{ padding: '0 16px 12px' }}>Sub-opção de um tipo que exige escolha (ex.: Crédito e Débito sob Cartão). Só aparece no checkout quando o tipo escolhido exige forma.</p>
    {erro && <p className="form-error" role="alert" style={{ padding: '0 16px' }}>{erro}</p>}
    {carregando ? <Skeleton rows={2} label="Carregando formas de pagamento" /> : formas.length ? <DataTable headers={['NOME', 'TIPO', 'STATUS', 'AÇÕES']} rows={formas.map(forma => [
      <span><b>{forma.nome}</b>{forma.built_in && <> <Badge>Padrão do sistema</Badge></>}</span>,
      <span>{tipos.find(t => t.id === forma.tipo_pagamento_id)?.nome || '—'}</span>,
      <Toggle checked={forma.ativo} disabled={ocupado} ariaLabel={`${forma.nome} ativa`} label={forma.ativo ? 'Ativa' : 'Inativa'} onChange={() => void alternar(forma)} />,
      <HoldButton compacto disabled={ocupado || forma.built_in} title={forma.built_in ? 'Item padrão do sistema — pode ser desativado, não excluído.' : undefined} onConfirm={() => void excluir(forma)} rotuloSegurando="Segure…">Excluir</HoldButton>,
    ])} /> : <EmptyState title="Nenhuma forma cadastrada" description="Formas só fazem sentido para tipos que exigem escolha, como Cartão." />}
    {tiposComForma.length > 0 && <form className="condicao-nova" onSubmit={adicionar}>
      <Combobox ariaLabel="Tipo de pagamento" placeholder="Tipo…" options={tiposComForma.map(t => ({ value: String(t.id), label: t.nome }))} value={tipoId === '' ? '' : String(tipoId)} onChange={v => setTipoId(v ? Number(v) : '')} />
      <input value={nova} onChange={event => setNova(event.target.value)} placeholder="Crédito, Débito…" aria-label="Nova forma de pagamento" />
      <Button type="submit" variant="secondary" disabled={ocupado || tipoId === '' || !nova.trim()}>Adicionar</Button>
    </form>}
  </article>
}

const ABAS_CONFIG = [
  { id: 'pagamento', label: 'Pagamento' },
  { id: 'locais', label: 'Locais' },
  { id: 'producao', label: 'Produção' },
  { id: 'perdas', label: 'Perdas e avarias' },
  { id: 'proposta', label: 'Textos da proposta' },
] as const

/**
 * Esteira de produção: quadro do que está na oficina, por etapa.
 *
 * Reaproveita o visual do kanban de vendas, mas move por botão em vez de arrastar —
 * aqui a transição registra histórico e aceita observação ("quebrou, refazer"), o que
 * um arrasto não comporta.
 */
/** Ordem atrasada é a que passou da previsão sem concluir — é o que a oficina precisa ver primeiro. */
function ordemAtrasada(ordem: OrdemProducao): boolean {
  if (!ordem.previsao_entrega || ordem.concluida_em) return false
  return new Date(ordem.previsao_entrega).getTime() < Date.now()
}

function EsteiraProducao() {
  const [ordens, setOrdens] = useState<OrdemProducao[]>([])
  const [etapas, setEtapas] = useState<EtapaProducao[]>([])
  const [equipe, setEquipe] = useState<TeamMember[]>([])
  // Rascunho do que está sendo editado no detalhe: só grava quando o usuário confirma.
  const [rascunho, setRascunho] = useState<{ responsavel_id: number | ''; previsao: string; observacoes: string }>({ responsavel_id: '', previsao: '', observacoes: '' })
  const [salvando, setSalvando] = useState(false)
  const [incluirConcluidas, setIncluirConcluidas] = useState(false)
  const [detalhe, setDetalhe] = useState<OrdemProducao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [feedback, setFeedback] = useState('')

  // Padrao do projeto: carrega dentro do efeito com guarda de montagem, sem setState
  // sincrono no corpo do efeito (que dispara render em cascata).
  useEffect(() => {
    let vivo = true
    Promise.all([listOrdensProducao(incluirConcluidas), catalogoEtapasProducao.listar(true), listTeam()])
      .then(([o, e, t]) => { if (!vivo) return; setOrdens(o); setEtapas(e); setEquipe(t.filter(m => m.ativo)) })
      .catch(err => { if (vivo) setErro(err instanceof Error ? err.message : 'Falha ao carregar a esteira.') })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [incluirConcluidas])

  async function mover(ordem: OrdemProducao, etapaId: number) {
    setOcupado(true); setErro('')
    try {
      const atualizada = await moverOrdemProducao(ordem.id, etapaId)
      setFeedback(`Ordem #${ordem.id} → ${atualizada.etapa_nome}.`)
      // Concluída sai do quadro ativo: recarrega para o filtro valer.
      if (atualizada.concluida_em && !incluirConcluidas) setOrdens(atual => atual.filter(o => o.id !== ordem.id))
      else setOrdens(atual => atual.map(o => o.id === atualizada.id ? { ...atualizada, historico: o.historico } : o))
    } catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao mover a ordem.') }
    finally { setOcupado(false) }
  }

  async function abrirDetalhe(ordem: OrdemProducao) {
    const completa = await getOrdemProducao(ordem.id).catch(() => ordem)
    setDetalhe(completa)
    setRascunho({
      responsavel_id: completa.responsavel_id ?? '',
      previsao: (completa.previsao_entrega || '').slice(0, 10),
      observacoes: completa.observacoes || '',
    })
  }

  async function salvarDetalhe() {
    if (!detalhe) return
    setSalvando(true); setErro('')
    try {
      const salva = await atualizarOrdemProducao(detalhe.id, {
        responsavel_id: rascunho.responsavel_id === '' ? null : Number(rascunho.responsavel_id),
        previsao_entrega: rascunho.previsao ? `${rascunho.previsao}T00:00:00` : null,
        observacoes: rascunho.observacoes.trim() || null,
      })
      setOrdens(atual => atual.map(o => o.id === salva.id ? { ...salva, historico: o.historico } : o))
      setDetalhe(atual => atual ? { ...salva, historico: atual.historico } : atual)
      setFeedback(`OP-${String(salva.id).padStart(4, '0')} atualizada.`)
    } catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao salvar a ordem.') }
    finally { setSalvando(false) }
  }

  const porEtapa = (etapaId: number) => ordens.filter(o => o.etapa_id === etapaId)
  const atrasadas = ordens.filter(ordemAtrasada).length

  return <>
    <PageHead eyebrow="GALPÃO · PRODUÇÃO" title="Esteira de produção"
      subtitle={`${ordens.length} ${ordens.length === 1 ? 'ordem' : 'ordens'} ${incluirConcluidas ? 'no total' : 'em andamento'}`}
      actions={<div className="segmented" role="group" aria-label="Filtro da esteira">
        <button type="button" className={!incluirConcluidas ? 'active' : ''} onClick={() => { setCarregando(true); setIncluirConcluidas(false) }}>Em andamento</button>
        <button type="button" className={incluirConcluidas ? 'active' : ''} onClick={() => { setCarregando(true); setIncluirConcluidas(true) }}>Todas</button>
      </div>} />
    {erro && <p className="form-error" role="alert">{erro}</p>}
    {atrasadas > 0 && <p className="aviso-atraso" role="status">{atrasadas} {atrasadas === 1 ? 'ordem passou' : 'ordens passaram'} da previsão de entrega.</p>}
    {carregando ? <article className="card" style={{ padding: 20 }}><Skeleton rows={4} label="Carregando esteira" /></article>
      : !etapas.length ? <EmptyState title="Nenhuma etapa configurada" description="Cadastre as etapas em Configurações do orçamento › Produção." />
      : <section className="kanban esteira">
        {etapas.map(etapa => {
          const daEtapa = porEtapa(etapa.id)
          return <div className="kanban-col" key={etapa.id}>
            <header><h2>{etapa.nome}</h2><Badge>{daEtapa.length}</Badge></header>
            {daEtapa.map(ordem => <article className="quote-card" key={ordem.id}>
              <button type="button" className="ordem-abrir" onClick={() => void abrirDetalhe(ordem)}>
                <b>OP-{String(ordem.id).padStart(4, '0')}</b>
                <span>{ordem.cliente_nome || 'Cliente não informado'}</span>
                <small>{ordem.resumo_itens || 'Sem itens'}</small>
              </button>
              <div className="ordem-meta">
                {/* Quem está tocando e para quando: é o que a oficina olha antes de tudo. */}
                <span className={ordem.responsavel_nome ? '' : 'sem-dono'}>
                  {ordem.responsavel_nome || 'Sem responsável'}
                </span>
                {ordem.previsao_entrega && <span className={ordemAtrasada(ordem) ? 'atrasada' : ''}>
                  {ordemAtrasada(ordem) ? 'Atrasada · ' : 'Entrega '}{portalDate(ordem.previsao_entrega)}
                </span>}
              </div>
              <footer>
                <em>{money(ordem.valor_total || 0)}</em>
                <Combobox compact ariaLabel={`Mover ordem ${ordem.id}`} placeholder="Mover para…"
                  options={etapas.filter(e => e.id !== etapa.id).map(e => ({ value: String(e.id), label: e.nome }))}
                  value="" disabled={ocupado} onChange={valor => { if (valor) void mover(ordem, Number(valor)) }} />
              </footer>
            </article>)}
            {!daEtapa.length && <p className="kanban-vazio">Nada aqui.</p>}
          </div>
        })}
      </section>}
    {detalhe && <Modal title={`OP-${String(detalhe.id).padStart(4, '0')}`} close={() => setDetalhe(null)}>
      <div className="modal-form">
        <dl className="ordem-dados">
          <div><dt>Cliente</dt><dd>{detalhe.cliente_nome || '—'}</dd></div>
          <div><dt>Vendedor</dt><dd>{detalhe.vendedor_nome || '—'}</dd></div>
          <div><dt>Etapa atual</dt><dd>{detalhe.etapa_nome}</dd></div>
          <div><dt>Responsável</dt><dd>{detalhe.responsavel_nome || 'Sem responsável'}</dd></div>
          {detalhe.previsao_entrega && <div><dt>Previsão</dt><dd className={ordemAtrasada(detalhe) ? 'atrasada' : ''}>{portalDate(detalhe.previsao_entrega)}</dd></div>}
          <div><dt>Valor</dt><dd>{money(detalhe.valor_total || 0)}</dd></div>
          <div><dt>Aberta em</dt><dd>{portalDate(detalhe.iniciada_em)}</dd></div>
          {detalhe.concluida_em && <div><dt>Concluída em</dt><dd>{portalDate(detalhe.concluida_em)}</dd></div>}
        </dl>
        <p className="subtitle">{detalhe.resumo_itens || 'Sem itens'}</p>
        {detalhe.orcamento_id && <button type="button" className="text-action" onClick={() => { location.hash = `orcamento/${detalhe.orcamento_id}` }}>Ver orçamento de origem</button>}

        <fieldset>
          <legend className="mono">EXECUÇÃO</legend>
          <label>Responsável<Combobox ariaLabel="Responsável pela ordem" placeholder="Sem responsável"
            options={[{ value: '', label: 'Sem responsável' }, ...equipe.map(m => ({ value: String(m.id), label: m.nome, meta: m.role }))]}
            value={rascunho.responsavel_id === '' ? '' : String(rascunho.responsavel_id)}
            onChange={valor => setRascunho(r => ({ ...r, responsavel_id: valor ? Number(valor) : '' }))} /></label>
          <label>Previsão de entrega<input type="date" value={rascunho.previsao}
            onChange={e => setRascunho(r => ({ ...r, previsao: e.target.value }))} /></label>
          <label className="item-detalhe-largo">Observações da oficina<input value={rascunho.observacoes}
            placeholder="Chapa reservada no fundo, cliente pediu borda reta…"
            onChange={e => setRascunho(r => ({ ...r, observacoes: e.target.value }))} /></label>
        </fieldset>
        <div className="timeline">
          {detalhe.historico.length ? detalhe.historico.map(h => <div key={h.id}><i /><div>
            <b>{h.etapa_nome}</b>{h.observacao && <p>{h.observacao}</p>}
            <small>{h.usuario_nome || 'Sistema'} · {portalDate(h.registrado_em)}</small>
          </div></div>) : <p className="empty-state">Sem histórico.</p>}
        </div>
        <footer>
          <Button variant="secondary" onClick={() => setDetalhe(null)}>Fechar</Button>
          <Button onClick={() => void salvarDetalhe()} loading={salvando}>Salvar</Button>
        </footer>
      </div>
    </Modal>}
    {feedback && <Feedback message={feedback} close={() => setFeedback('')} />}
  </>
}

function ConfiguracoesOrcamento() {
  const [aba, setAba] = useState<typeof ABAS_CONFIG[number]['id']>('pagamento')

  return <>
    <PageHead eyebrow="CONFIGURAÇÕES · ORÇAMENTO" title="Configurações do orçamento"
      subtitle="Catálogos que alimentam o construtor de orçamento e as telas do galpão."
      actions={<div className="segmented" role="group" aria-label="Seção de configurações">
        {ABAS_CONFIG.map(item => <button key={item.id} type="button" className={aba === item.id ? 'active' : ''} onClick={() => setAba(item.id)}>{item.label}</button>)}
      </div>} />
    {aba === 'pagamento' && <>
      <CatalogoConfiguravel titulo="Tipos de pagamento" acoes={catalogoTiposPagamento}
        descricao="Primeira etapa do checkout de venda direta. Desativar esconde da lista de novas vendas, sem apagar o histórico de quem já usou."
        placeholderNovo="Boleto, Vale…"
        colunaExtra={{ cabecalho: 'EXIGE FORMA', render: item => <span>{item.exige_forma ? 'Sim' : '—'}</span> }} />
      <FormasPagamentoConfig />
      <CatalogoConfiguravel titulo="Condições de pagamento" acoes={catalogoCondicoesPagamento}
        descricao="Parcelamento oferecido no fechamento (ex.: 40% entrada + 3x). Aparece no construtor de orçamento."
        placeholderNovo="40% entrada + 3x…" />
    </>}
    {aba === 'locais' && <CatalogoConfiguravel titulo="Locais de instalação" acoes={catalogoLocais}
      descricao="Onde a peça vai ser instalada. Aparece em cada linha do orçamento."
      placeholderNovo="Cozinha, Lavabo…" />}
    {aba === 'producao' && <CatalogoConfiguravel titulo="Etapas de produção" acoes={catalogoEtapasProducao}
      descricao="Sequência da esteira da oficina. A ordem aqui é a ordem em que o trabalho anda; a última etapa fecha a ordem de produção."
      placeholderNovo="Polimento, Conferência…"
      colunaExtra={{ cabecalho: 'FECHA A ORDEM', render: item => <span>{item.is_final ? 'Sim' : '—'}</span> }} />}
    {aba === 'perdas' && <CatalogoConfiguravel titulo="Motivos de perda e avaria" acoes={catalogoMotivosPerda}
      descricao="Alimenta o seletor da tela de Perdas e Avarias."
      placeholderNovo="Trinca no polimento…" />}
    {aba === 'proposta' && <><CoMarca /><ResetConfiguracao /></>}
  </>
}

/** Restaura os textos padrão da proposta. Some com os CNPJs de faturamento — daí a pressão. */
function ResetConfiguracao() {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState(false)

  async function resetar() {
    setOcupado(true); setErro(''); setFeito(false)
    try { await resetOrcamentoConfig(); setFeito(true) }
    catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao restaurar a configuração.') }
    finally { setOcupado(false) }
  }

  return <article className="card zona-risco" style={{ padding: 20, marginTop: 14 }}>
    <div className="card-title"><h2>Restaurar textos da proposta</h2><span className="mono">ZONA DE RISCO</span></div>
    <p className="subtitle">Volta condição de pagamento, prazo, validade, garantia e observações ao texto de fábrica — e <b>apaga os dois CNPJs de faturamento</b>, o que bloqueia a aprovação de orçamentos até você cadastrá-los de novo.</p>
    <HoldButton onConfirm={() => void resetar()} disabled={ocupado} rotuloSegurando="Segure para restaurar…">Restaurar padrões</HoldButton>
    {erro && <p className="form-error" role="alert">{erro}</p>}
    {feito && !erro && <p className="subtitle" role="status">Configuração restaurada. Recadastre os CNPJs antes de aprovar orçamentos.</p>}
  </article>
}

function Integrations() {
  const [items, setItems] = useState<ApiKey[]>([])
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<ApiKeyCreated | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let mounted = true
    listApiKeys().then(data => { if (mounted) setItems(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar chaves de API.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    try {
      const novaChave = await createApiKey(String(form.get('nome') || ''))
      setItems(current => [novaChave, ...current]); setOpen(false); setCreated(novaChave); setCopied(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao gerar chave.') }
    finally { setSaving(false) }
  }

  async function copyKey() {
    if (!created) return
    try { await navigator.clipboard.writeText(created.chave); setCopied(true) } catch { setCopied(false) }
  }

  async function revoke(key: ApiKey) {
    if (!confirm(`Revogar a chave "${key.nome}"? Qualquer integração usando-a deixará de funcionar.`)) return
    try { await revokeApiKey(key.id); setItems(current => current.map(item => item.id === key.id ? { ...item, ativo: false, revoked_at: new Date().toISOString() } : item)); setFeedback(`Chave "${key.nome}" revogada.`) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao revogar chave.') }
  }

  return <><PageHead eyebrow="GESTÃO · INTEGRAÇÕES" title="Integrações" subtitle="Chaves de API para extensões externas (ex: SketchUp ou Med-Stone) enviarem projetos direto para a ERP" actions={<><Button onClick={() => setOpen(true)}>+ Gerar chave</Button></>}/>
    {error && <p className="form-error" role="alert">{error}</p>}
    <article className="card list-card">
      <div className="card-title"><h2>Chaves de API</h2><Badge>{items.length} chave(s)</Badge></div>
      {loading ? <Skeleton rows={3} label="Carregando chaves" /> : items.length ? <DataTable headers={['NOME', 'PREFIXO', 'STATUS', '#CRIADA EM', '#ÚLTIMO USO', 'AÇÕES']} rows={items.map(key => [
        <b>{key.nome}</b>,
        <span className="mono">{key.prefixo}…</span>,
        <Badge tone={key.ativo ? 'success' : 'danger'}>{key.ativo ? 'Ativa' : 'Revogada'}</Badge>,
        new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(key.created_at)),
        key.last_used_at ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(key.last_used_at)) : 'Nunca usada',
        key.ativo ? <button className="text-action" onClick={() => revoke(key)}>Revogar</button> : '—',
      ])}/> : <EmptyState title="Nenhuma chave de API" description="Gere uma chave para conectar o SketchUp ou o Med-Stone a este ateliê." action={<Button onClick={() => setOpen(true)}>+ Gerar chave</Button>} />}
    </article>
    {open && <Modal title="Gerar chave de API" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitCreate}>
      <label>Nome da chave<input name="nome" autoFocus required placeholder="SketchUp ou Med-Stone - Notebook Ana"/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={saving}>{saving ? 'Gerando…' : 'Gerar chave'}</Button></footer>
    </form></Modal>}
    {created && <Modal title="Chave gerada" close={() => setCreated(null)}><div className="modal-form">
      <p className="form-error" role="alert">Esta chave só é mostrada uma vez. Copie e guarde em local seguro agora.</p>
      <label>Chave completa<input readOnly value={created.chave} onFocus={e => e.currentTarget.select()}/></label>
      <footer><Button variant="secondary" onClick={copyKey}>{copied ? 'Copiado ✓' : 'Copiar'}</Button><Button onClick={() => setCreated(null)}>Concluir</Button></footer>
    </div></Modal>}
    {feedback && <Feedback message={feedback} close={() => setFeedback('')}/>}
  </>
}

const acaoTone: Record<string, string> = { CRIOU: 'success', EDITOU: 'info', DELETOU: 'danger', MUDOU_STATUS: 'warning', LOGIN: 'neutral' }

function Logs() {
  const [items, setItems] = useState<AuditLog[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    listLogs().then(data => { if (mounted) setItems(data) })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar logs.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const filtered = items.filter(item => `${item.acao} ${item.detalhes} ${item.entidade || ''} ${item.usuario_nome || ''}`.toLowerCase().includes(query.toLowerCase()))

  return <><PageHead eyebrow="GESTÃO · AUDITORIA" title="Logs de auditoria" subtitle={`${items.length} registro(s) · últimos 100`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar ação, entidade ou usuário..."/></>}/>
    {error && <p className="form-error" role="alert">{error}</p>}
    <article className="card list-card">
      <div className="card-title"><h2>Ações recentes</h2><Badge>{filtered.length} resultados</Badge></div>
      {loading ? <Skeleton rows={6} label="Carregando logs" /> : filtered.length ? <DataTable headers={['#DATA/HORA', 'USUÁRIO', 'AÇÃO', 'ENTIDADE', 'DETALHES', 'IP']} rows={filtered.map(item => [
        new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(item.created_at)),
        item.usuario_nome || 'Sistema',
        <Badge tone={acaoTone[item.acao] || 'neutral'}>{item.acao}</Badge>,
        item.entidade ? `${item.entidade}${item.entidade_id ? ` #${item.entidade_id}` : ''}` : '—',
        item.detalhes,
        item.ip || '—',
      ])}/> : <EmptyState title="Nenhum log encontrado" description="As ações da equipe aparecem aqui conforme acontecem." />}
    </article>
  </>
}

function brl(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100) }

function Finance() {
  const [period, setPeriod] = useState<'Mês' | 'Trimestre'>('Mês')
  const [resumo, setResumo] = useState<FinanceiroResumo | null>(null)
  const [receivables, setReceivables] = useState<Lancamento[]>([])
  const [fluxo, setFluxo] = useState<FluxoMensalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let mounted = true

    async function carregarPeriodo() {
      setLoading(true); setError('')
      try {
        const [resumoData, receivablesData, fluxoData] = await Promise.all([
          getFinanceiroResumo(period), listLancamentos({ tipo: 'ENTRADA' }), getFluxoMensal(),
        ])
        if (!mounted) return
        setResumo(resumoData); setReceivables(receivablesData); setFluxo(fluxoData)
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar dados financeiros.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void carregarPeriodo()
    return () => { mounted = false }
  }, [period])

  async function submitLancamento(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError('')
    const form = new FormData(e.currentTarget)
    try {
      await createLancamento({
        descricao: String(form.get('description') || ''),
        valor: Math.round(Number(form.get('amount') || 0) * 100),
        data_vencimento: `${form.get('date')}T00:00:00Z`,
        tipo: 'SAIDA',
      })
      setOpen(false); setFeedback('Lançamento salvo.')
      setResumo(await getFinanceiroResumo(period))
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar lançamento.') }
    finally { setSaving(false) }
  }

  async function marcarComoPago(lancamento: Lancamento) {
    try {
      await pagarLancamento(lancamento.id)
      setReceivables(current => current.filter(l => l.id !== lancamento.id))
      setResumo(await getFinanceiroResumo(period))
      setFeedback(`Título "${lancamento.descricao}" marcado como pago.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao marcar título como pago.') }
  }

  function exportarCsv() {
    const linhas = [['TÍTULO', 'DESCRIÇÃO', 'SITUAÇÃO', 'VALOR', 'VENCIMENTO'], ...receivables.map(l => [
      `FT${l.orcamento_id ?? l.id}`, l.descricao,
      l.status === 'pago' ? 'Pago' : l.vencido ? 'Vencido' : 'Em aberto',
      (l.valor / 100).toFixed(2).replace('.', ','),
      new Date(l.data_vencimento).toLocaleDateString('pt-BR'),
    ])]
    const csv = linhas.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `titulos-a-receber-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    setFeedback('Exportação em CSV concluída.')
  }

  // Lazy initializer evita chamada impura durante cada render e mantém a
  // referência temporal estável enquanto usuário consulta o painel.
  const [agora] = useState(() => Date.now())
  const diasVencido = (venc: string) => Math.floor((agora - new Date(venc).getTime()) / 86400000)
  const pendentes = receivables.filter(l => l.status === 'pendente')
  const emDia = pendentes.filter(l => !l.vencido).length
  const vencidoAte30 = pendentes.filter(l => l.vencido && diasVencido(l.data_vencimento) <= 30).length
  const vencidoMais30 = pendentes.filter(l => l.vencido && diasVencido(l.data_vencimento) > 30).length
  const totalAging = emDia + vencidoAte30 + vencidoMais30
  const agingBuckets: [string, number, string][] = [
    ['Em dia', emDia, 'aprovado'], ['Vencido até 30 dias', vencidoAte30, 'planejando'], ['Vencido +30 dias', vencidoMais30, 'perdido'],
  ]
  const picoFluxo = Math.max(1, ...fluxo.map(f => Math.max(f.entradas, f.saidas)))

  return <><PageHead eyebrow="GESTÃO · FINANCEIRO" title="Painel financeiro" subtitle={`${period} · dados reais do ledger financeiro`} actions={<><div className="segmented"><button className={period === 'Trimestre' ? 'active' : ''} onClick={() => setPeriod('Trimestre')}>Trimestre</button><button className={period === 'Mês' ? 'active' : ''} onClick={() => setPeriod('Mês')}>Mês</button></div><Button variant="secondary" onClick={exportarCsv}>Exportar</Button><Button onClick={() => setOpen(true)}>+ Lançamento</Button></>}/>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <Skeleton rows={5} label="Carregando dados financeiros" /> : <>
      <section className="kpi-grid">
        <Kpi label="A RECEBER" value={brl(resumo?.a_receber ?? 0)} note={`${resumo?.titulos_abertos ?? 0} títulos abertos`}/>
        <Kpi label="RECEBIDO NO PERÍODO" value={brl(resumo?.recebido_no_periodo ?? 0)} note={period}/>
        <Kpi label="VENCIDOS" value={brl(resumo?.vencidos ?? 0)} note="títulos vencidos · cobrar"/>
        <Kpi dark label="MARGEM MÉDIA" value={resumo?.margem_media != null ? `${resumo.margem_media}%` : '—'} note="orçamentos aprovados no período"/>
      </section>
      <section className="finance-grid">
        <article className="card chart"><h2>Entradas e saídas pagas · últimos 6 meses</h2>
          {fluxo.length ? <div className="bars">{fluxo.map(f => <div key={f.mes}>
            <i style={{ height: `${(f.entradas / picoFluxo) * 100}%` }}/>
            <b style={{ height: `${(f.saidas / picoFluxo) * 100}%` }}/>
            <span>{f.mes.slice(5)}/{f.mes.slice(2, 4)}</span>
          </div>)}</div> : <p className="empty-state">Nenhum lançamento pago no período.</p>}
        </article>
        <div>
          <article className="card"><h2>Aging de recebíveis</h2>
            {totalAging ? <div className="status-bars">{agingBuckets.map(([label, n, tone]) => <div key={label}><span>{label}</span><i><b className={tone} style={{ width: `${(n / totalAging) * 100}%` }}/></i><em>{n}</em></div>)}</div> : <p className="empty-state">Nenhum título a receber.</p>}
          </article>
          <article className="card total-card forecast">
            <p className="mono">TÍTULOS EM ABERTO</p>
            <strong>{brl(resumo?.a_receber ?? 0)}</strong>
            <dl><dt>Recebido no período</dt><dd>{brl(resumo?.recebido_no_periodo ?? 0)}</dd><dt>Vencidos</dt><dd>{brl(resumo?.vencidos ?? 0)}</dd></dl>
          </article>
        </div>
      </section>
      <article className="card list-card">
        <div className="card-title"><h2>Títulos a receber</h2><Badge>{receivables.length} resultados</Badge></div>
        {receivables.length ? <DataTable headers={['TÍTULO', 'DESCRIÇÃO', 'SITUAÇÃO', '#VALOR', '#VENCE', 'AÇÃO']} rows={receivables.map(l => [
          `FT${l.orcamento_id ?? l.id}`,
          l.descricao,
          <Badge tone={l.status === 'pago' ? 'success' : l.vencido ? 'danger' : 'info'}>{l.status === 'pago' ? 'Pago' : l.vencido ? 'Vencido' : 'Em aberto'}</Badge>,
          brl(l.valor),
          new Intl.DateTimeFormat('pt-BR').format(new Date(l.data_vencimento)),
          l.status === 'pendente' ? <button className="text-action" onClick={() => marcarComoPago(l)}>Marcar como pago</button> : '—',
        ])}/> : <p className="empty-state">Nenhum título a receber ainda.</p>}
      </article>
    </>}
    {open && <Modal title="Novo lançamento" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitLancamento}>
      <label>Descrição<input name="description" required autoFocus placeholder="Compra de MDF…"/></label>
      <label>Valor<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0,00"/></label>
      <label>Data<input name="date" type="date" required/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={saving}>{saving ? 'Salvando…' : 'Salvar lançamento'}</Button></footer>
    </form></Modal>}
    {feedback && <Feedback message={feedback} close={() => setFeedback('')}/>}
  </>
}

function portalDate(value: string | null) {
  if (!value) return 'Data não informada'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function portalBytes(value: number | null) {
  if (!value) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`
  return `${(value / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

function Portal({ token }: { token: string }) {
  const [proposal, setProposal] = useState<PortalProposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [motive, setMotive] = useState('')
  const [motiveError, setMotiveError] = useState('')
  const [decisionError, setDecisionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState<string | number | null>(null)

  useEffect(() => {
    getPortalProposta(token).then(setProposal).catch(err => setError(err instanceof Error ? err.message : 'PORTAL_LINK_INVALIDO')).finally(() => setLoading(false))
  }, [token])

  async function submitDecision(acao: 'aprovar' | 'recusar', motivo?: string) {
    setDecisionError('')
    if (name.trim().length < 2) {
      setDecisionError('Informe seu nome para registrar a decisão.')
      return
    }
    setBusy(true)
    try {
      const updated = await enviarDecisaoPortal(token, { acao, nome: name.trim(), motivo })
      setProposal(updated)
      setAdjustOpen(false)
      setMotive('')
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : 'Não foi possível registrar a decisão.')
    } finally {
      setBusy(false)
    }
  }

  function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitDecision('aprovar')
  }

  function requestAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (motive.trim().length < 10) {
      setMotiveError('Descreva o ajuste com pelo menos 10 caracteres.')
      return
    }
    setMotiveError('')
    void submitDecision('recusar', motive.trim())
  }

  async function download(key: string | number, action: () => Promise<void>) {
    setDownloadBusy(key)
    try {
      await action()
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : 'Não foi possível baixar o documento.')
    } finally {
      setDownloadBusy(null)
    }
  }

  if (loading) return <div className="portal"><header><Logo escritorio={proposal?.organizacao_nome}/><span>Portal de aprovações</span></header><main><section className="card empty-state"><p className="mono">PORTAL</p><h1>Carregando proposta…</h1></section></main></div>
  if (error || !proposal) return <div className="portal"><header><Logo escritorio={proposal?.organizacao_nome}/><span>Portal de aprovações</span></header><main><section className="card empty-state"><p className="mono">LINK INDISPONÍVEL</p><h1>Este link expirou ou foi substituído.</h1><p>Peça um novo link ao seu arquiteto.</p></section></main></div>

  const moneyPortal = money
  const decided = Boolean(proposal.decisao_cliente)
  const canDecide = proposal.status_publico === 'Aguardando sua aprovação' && !decided
  const steps = ['Proposta enviada', 'Sua decisão', 'Confirmação do arquiteto', 'Produção', 'Entrega e montagem']
  const currentStep = decided ? 2 : proposal.status_publico === 'Aguardando sua aprovação' ? 1 : proposal.status_publico === 'Aprovada — produção liberada' ? 3 : 0
  const documentsVisible = proposal.tem_pdf_proposta || proposal.documentos.length > 0

  return <div className="portal"><header><Logo escritorio={proposal?.organizacao_nome}/><span>Portal de aprovações</span><b>{proposal.cliente_nome}</b></header><main>
    <PageHead eyebrow={`${proposal.numero_exibicao} · ${proposal.tipo_orcamento}`} title="Sua proposta" subtitle={proposal.data_entrega ? `Entrega prevista ${portalDate(proposal.data_entrega)}` : 'Confira os detalhes antes de decidir.'}/>
    <div className="portal-grid"><div>
      <article className="card proposal"><h2>O que está incluído</h2>{proposal.itens.map(item => <div key={`${item.nome}-${item.local_instalacao}`}><b>{item.nome}</b><span>{item.quantidade} {item.prazo_entrega_unidade || 'un.'}</span><em>{moneyPortal(item.subtotal)}</em></div>)}<footer>Total da proposta <strong>{moneyPortal(proposal.valor_total)}</strong></footer>{proposal.condicoes_pagamento && <p className="subtitle">Condições: {proposal.condicoes_pagamento}</p>}</article>
      {documentsVisible && <article className="card documents"><p className="mono">DOCUMENTOS DA PROPOSTA</p>{proposal.tem_pdf_proposta && <button className="text-action" disabled={downloadBusy === 'pdf'} onClick={() => void download('pdf', () => baixarPdfPropostaPortal(token))}>Proposta em PDF {downloadBusy === 'pdf' ? '…' : '↓'}</button>}{proposal.documentos.map(document => <button className="text-action" disabled={downloadBusy === document.id} key={document.id} onClick={() => void download(document.id, () => baixarDocumentoPortal(token, document.id))}>{document.nome_original} {portalBytes(document.tamanho)} {downloadBusy === document.id ? '…' : '↓'}</button>)}</article>}
    </div><aside>
      <article className="card decision"><p className="mono">SUA DECISÃO</p>{decided ? <><h2>{proposal.decisao_cliente === 'aprovado' ? 'Intenção de aprovação registrada.' : 'Pedido de ajuste registrado.'}</h2><p>Registrado por {proposal.decisao_cliente_nome || name} em {portalDate(proposal.decisao_cliente_em)}.</p>{proposal.decisao_cliente === 'recusado' && <p><strong>Motivo informado:</strong> {proposal.decisao_cliente_motivo}</p>}</> : canDecide ? <><h2>Aprovar esta proposta?</h2><p>Registre sua decisão para que o arquiteto possa dar sequência ao atendimento.</p><form className="modal-form" onSubmit={approve}><label>Seu nome<input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={200} required autoComplete="name"/></label>{decisionError && <p className="form-error" role="alert">{decisionError}</p>}<Button type="submit" loading={busy}>{busy ? 'Registrando…' : 'Aprovar proposta'}</Button></form><Button variant="secondary" onClick={() => setAdjustOpen(true)} loading={busy}>Pedir ajuste</Button></> : <><h2>{proposal.status_publico}</h2><p>Esta proposta não está aberta para uma nova decisão.</p></>}{proposal.arquiteto_nome && <small>Em caso de dúvida, fale com {proposal.arquiteto_nome}{proposal.arquiteto_contato ? ` · ${proposal.arquiteto_contato}` : ''}.</small>}</article>
      <article className="card timeline"><h2>Andamento</h2>{steps.map((step, index) => <div className={index < currentStep ? 'done' : index === currentStep ? 'current' : ''} key={step}><i/><b>{step}<small>{index === 0 ? portalDate(proposal.criado_em) : index === 1 ? (decided ? portalDate(proposal.decisao_cliente_em) : 'aguardando sua decisão') : index === 2 && decided ? 'aguardando confirmação' : 'após confirmação'}</small></b></div>)}</article>
    </aside></div></main>{adjustOpen && <Modal title="Pedir ajuste" close={() => setAdjustOpen(false)}><form className="modal-form" onSubmit={requestAdjustment}><label>O que precisa revisar?<textarea value={motive} onChange={event => { setMotive(event.target.value); if (motiveError) setMotiveError('') }} minLength={10} maxLength={2000} required autoFocus aria-invalid={Boolean(motiveError)} placeholder="Descreva o acabamento, prazo ou item…"/></label>{motiveError && <p className="form-error" role="alert">{motiveError}</p>}{decisionError && <p className="form-error" role="alert">{decisionError}</p>}<footer><Button variant="secondary" onClick={() => setAdjustOpen(false)}>Cancelar</Button><Button type="submit" loading={busy}>{busy ? 'Enviando…' : 'Enviar pedido'}</Button></footer></form></Modal>}</div>
}

function Profile() {
  const [me, setMe] = useState<TeamMember | null>(null)
  const [nome, setNome] = useState('')
  const [contato, setContato] = useState('')
  const [endereco, setEndereco] = useState(() => localStorage.getItem('arc-profile-address') || '')
  const [avatar, setAvatar] = useState(() => localStorage.getItem('arc-profile-avatar') || '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const roleLabel: Record<string, string> = { admin: 'Administrador', vendedor: 'Vendedor', estoquista: 'Estoquista' }
  useEffect(() => { getSessionUser().then(user => { setMe(user); setNome(user.nome); setContato(user.contato || '') }).catch(err => setError(err instanceof Error ? err.message : 'Falha ao carregar seu perfil.')).finally(() => setLoading(false)) }, [])
  async function salvar(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!me) return; setSaving(true); setError(''); try { const updated = await updateTeamMember(me.id, { nome, contato: contato || null }); setMe(updated); localStorage.setItem('arc-profile-address', endereco); setFeedback('Perfil atualizado com sucesso.') } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar seu perfil.') } finally { setSaving(false) } }
  function escolherFoto(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { setError('A foto deve ter no máximo 2 MB.'); return } const reader = new FileReader(); reader.onload = () => { const value = String(reader.result); setAvatar(value); localStorage.setItem('arc-profile-avatar', value); setFeedback('Foto de perfil atualizada.') }; reader.readAsDataURL(file) }
  async function solicitarTrocaSenha() { if (!me) return; try { await forgotPassword(me.email); setFeedback('Enviamos um link seguro para trocar sua senha.') } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível solicitar a troca de senha.') } }
  const iniciais = nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'U'
  return <><PageHead eyebrow="CONTA · MEU PERFIL" title="Meu perfil" subtitle="Gerencie sua identidade, seus dados de contato e a segurança de acesso." />{error && <p className="form-error" role="alert">{error}</p>}{loading ? <Skeleton rows={4} label="Carregando perfil" /> : me && <div className="profile-layout"><section><article className="card profile-hero"><div className="profile-avatar">{avatar ? <img src={avatar} alt="Foto de perfil" /> : iniciais}<label title="Alterar foto"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={escolherFoto} />+</label></div><div><p className="eyebrow">PERFIL ARC · STONE</p><h2>{nome}</h2><p>{roleLabel[me.role] || me.role} · {me.email}</p><span className="profile-status"><i /> Conta ativa</span></div></article><form className="card profile-form" onSubmit={salvar}><div className="card-title"><div><p className="eyebrow">IDENTIDADE</p><h2>Dados pessoais</h2></div><span className="mono">EDITÁVEL</span></div><div className="profile-fields"><label>Nome completo<input value={nome} onChange={e => setNome(e.target.value)} required /></label><label>Telefone<input value={contato} onChange={e => setContato(e.target.value)} placeholder="(11) 99999-9999" /></label><label className="full-field">Endereço profissional<textarea value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, complemento, cidade e CEP" rows={3} /></label></div><footer><small>O endereço fica salvo neste dispositivo até o cadastro ser integrado ao servidor.</small><Button type="submit" loading={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</Button></footer></form></section><aside><article className="card profile-info"><p className="eyebrow">ACESSO</p><h2>Dados da conta</h2><dl><dt>E-mail de acesso</dt><dd>{me.email}</dd><dt>Cargo</dt><dd><Badge tone="info">{roleLabel[me.role] || me.role}</Badge></dd><dt>Status</dt><dd className="success-text">Ativo</dd></dl></article><article className="card profile-security"><p className="eyebrow">SEGURANÇA</p><h2>Proteja seu acesso</h2><div className="security-action"><span>••••••••</span><div><b>Senha de acesso</b><small>Receba um link para criar uma nova senha.</small></div><button className="text-action" onClick={() => void solicitarTrocaSenha()}>Trocar</button></div><div className="security-action"><span>✓</span><div><b>Autenticação em duas etapas</b><small>Configure o MFA no módulo de segurança.</small></div><button className="text-action" onClick={() => { location.hash = 'profile'; location.reload() }}>Gerenciar</button></div></article><article className="card profile-tip"><b>Uma conta, todos os produtos ARC</b><p>Seus dados identificam você no ARC Stone e nos próximos produtos da plataforma.</p></article></aside></div>}{feedback && <Feedback message={feedback} close={() => setFeedback('')} />}</>
}

function ForgotPasswordModal({ close }: { close: () => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { await forgotPassword(email); setSent(true) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao solicitar recuperação.') }
    finally { setBusy(false) }
  }
  return <Modal title="Recuperar senha" close={close}>
    {sent ? <div className="modal-form"><p>Se o e-mail estiver cadastrado no ARC ERP, você receberá as instruções de recuperação em breve.</p><footer><Button onClick={close}>Fechar</Button></footer></div>
    : <form className="modal-form" onSubmit={submit}>
        <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="marina@estudio.com.br" autoFocus required/></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer><Button variant="secondary" onClick={close}>Cancelar</Button><Button type="submit" loading={busy}>{busy ? 'Enviando…' : 'Enviar instruções'}</Button></footer>
      </form>}
  </Modal>
}

function ResetPassword() {
  const token = new URLSearchParams(location.search).get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('')
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não conferem.'); return }
    setBusy(true)
    try { await resetPassword(token, password); setDone(true) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao redefinir senha.') }
    finally { setBusy(false) }
  }
  return <div className="login"><section><Logo/><div><h1>Redefinir<br/>sua senha<br/><span>em segurança.</span></h1><p>Escolha uma senha nova para voltar<br/>a acessar o ARC ERP.</p></div><footer><i/><i/><i/><i/><span className="mono">AMOSTRAS<br/>DO PROJETO ATIVO</span></footer></section>
    {!token ? <div><div><p className="eyebrow">LINK INVÁLIDO</p><h2>Token ausente</h2><p className="form-error">Este link de redefinição está incompleto. Solicite um novo pelo login.</p><footer><a href="/">Voltar ao login</a></footer></div></div>
    : done ? <div><div><p className="eyebrow">SENHA REDEFINIDA</p><h2>Tudo certo.</h2><p>Sua senha foi atualizada. Você já pode entrar com a senha nova.</p><footer><a href="/">Ir para o login</a></footer></div></div>
    : <form onSubmit={submit}><div><p className="eyebrow">NOVA SENHA</p><h2>Redefinir senha</h2>
      <label>Nova senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoFocus required minLength={8}/></label>
      <label>Confirmar nova senha<input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required minLength={8}/></label>
      {error && <p className="form-error">{error}</p>}
      <Button type="submit">{busy ? 'Salvando...' : 'Redefinir senha'}</Button>
      <footer><a href="/">Voltar ao login</a><span className="mono">V1.0 · LÍNEA</span></footer>
    </div></form>}
  </div>
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [mfa,setMfa]=useState('')
  const [mfaToken,setMfaToken]=useState<string | null>(null)
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  const [forgotOpen,setForgotOpen]=useState(false)
  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setError('')
    try {
      if (mfaToken) {
        await mfaLogin(mfaToken, mfa)
        sessionStorage.setItem('arc-session','1'); onSuccess(); return
      }
      const data = await login(email,password)
      if (data.mfa_required) { setMfaToken(data.mfa_token); setError('Digite o código do aplicativo autenticador para continuar.'); return }
      sessionStorage.setItem('arc-session','1'); onSuccess()
    } catch(err) { setError(err instanceof Error?err.message:'Falha ao entrar') } finally { setBusy(false) }
  }
  return <div className="login"><section><Logo/><div><h1>Seu projeto de<br/>interiores em<br/><span>uma tela só.</span></h1><p>Orçamento, medição, estoque e cronograma<br/>no mesmo lugar — como o cliente<br/>acompanhando pelo portal.</p></div><footer><i/><i/><i/><i/><span className="mono">AMOSTRAS<br/>DO PROJETO ATIVO</span></footer></section><form onSubmit={submit}><div><p className="eyebrow">ACESSO AO ATELIÊ</p><h2>{mfaToken?'Verificação em duas etapas':'Entrar'}</h2>{mfaToken ? <>
    <label>Código MFA <span className="mono">6 DÍGITOS</span><input className="mfa" value={mfa} onChange={e=>setMfa(e.target.value)} placeholder="428913" autoFocus required/></label>
    {error&&<p className="form-error">{error}</p>}
    <Button type="submit">{busy?'Verificando...':'Confirmar código'}</Button>
    <footer><button type="button" onClick={()=>{setMfaToken(null);setMfa('');setError('')}}>Voltar ao login</button></footer>
  </> : <>
    <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="marina@estudio.com.br" required/></label>
    <label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/></label>
    {error&&<p className="form-error">{error}</p>}
    <Button type="submit">{busy?'Entrando...':'Entrar'}</Button>
    <footer><button type="button" onClick={()=>setForgotOpen(true)}>Esqueci minha senha</button><span className="mono">V1.0 · LÍNEA</span></footer>
  </>}</div></form>{forgotOpen && <ForgotPasswordModal close={()=>setForgotOpen(false)}/>}</div>
}

export default function App() {
  const [portalToken] = useState(() => {
    const hash = location.hash
    if (!hash.startsWith('#portal/')) return ''
    const token = hash.slice('#portal/'.length)
    history.replaceState(null, '', location.pathname)
    return token
  })
  const previewMode = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === '1'
  const [authenticated,setAuthenticated] = useState(sessionStorage.getItem('arc-session')==='1' || previewMode)
  const [rota,setRota] = useState<Rota>(() => lerHash())
  useEffect(() => {
    const aoMudarHash = () => setRota(lerHash())
    window.addEventListener('hashchange', aoMudarHash)
    return () => window.removeEventListener('hashchange', aoMudarHash)
  }, [])
  useEffect(()=>{ if(!authenticated || previewMode) return; getSessionUser().catch(()=> encerrarSessao()) },[authenticated,previewMode])
  const go=(next:Route, id?: number)=>{ location.hash = id === undefined ? next : `${next}/${id}`; window.scrollTo(0,0) }
  const page = useMemo(() => {
    if (rota.nome === 'orcamento') return rota.id === undefined ? <Pipeline/> : <QuoteDetail quoteId={rota.id}/>
    if (rota.nome === 'builder') return <Builder quoteId={rota.id}/>
    if (rota.nome === 'clients' && rota.id !== undefined) return <ClientDetail clientId={rota.id}/>
    return ({ dashboard: <Dashboard/>, clients: <Clients/>, pipeline: <Pipeline/>, builder: <Builder/>, quotesList: <QuotesList/>, salesHistory: <SalesHistory/>, projects: <Projects/>, catalog: <Catalog/>, servicesCatalog: <ServicesCatalog/>, inventory: <Inventory/>, suppliers: <Suppliers/>, losses: <Losses/>, equipment: <Equipment/>, schedule: <Schedule/>, finance: <Finance/>, team: <Team/>, producao: <EsteiraProducao/>, orcamentoConfig: <ConfiguracoesOrcamento/>, integrations: <Integrations/>, logs: <Logs/>, profile: <Profile/> } as Partial<Record<Route, ReactNode>>)[rota.nome]
  }, [rota.nome, rota.id])
  if(portalToken) return <Portal token={portalToken}/>
  if(location.pathname==='/reset-password') return <ResetPassword/>
  if(!authenticated) return <Login onSuccess={()=>setAuthenticated(true)}/>
  return <AppShell route={rota.nome} go={go}>{page}</AppShell>
}
