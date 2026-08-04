import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createApiKey, createCatalogProduct, createClient, createLancamento, createQuote, createSupplier, createTeamMember, deactivateTeamMember, deleteClient, deleteProjeto, deleteSupplier, disableMfa, enableMfa, forgotPassword, getFinanceiroResumo, getFluxoMensal, getOrcamentoConfig, getProjeto, getSessionUser, importarProjetoCsv, listApiKeys, listCalendarEvents, listCatalogProducts, listClients, listInventoryProducts, listLancamentos, listLogs, listPaymentConditions, listProjetos, listQuotes, listSuppliers, listTeam, login, logout, mfaLogin, moveInventory, pagarLancamento, regenerateQuotePdf, resetPassword, revokeApiKey, updateProduct, updateQuote, updateQuoteStatus, updateTeamMember, verifyMfa } from './api'
import type { ApiKey, ApiKeyCreated, AuditLog, CalendarEvent, Client, ClientInput, FinanceiroResumo, FluxoMensalItem, Lancamento, OrcamentoConfig, PaymentCondition, Product, Projeto, ProjetoDetail, Quote, Supplier, SupplierInput, TeamMember, TeamMemberInput } from './api'
import { money, quotes } from './data'
import type { Status } from './data'

type Route = 'dashboard' | 'clients' | 'pipeline' | 'builder' | 'projects' | 'catalog' | 'inventory' | 'suppliers' | 'schedule' | 'finance' | 'team' | 'integrations' | 'logs' | 'portal'
const routes: Route[] = ['dashboard', 'clients', 'pipeline', 'builder', 'projects', 'catalog', 'inventory', 'suppliers', 'schedule', 'finance', 'team', 'integrations', 'logs', 'portal']

type IconName = Exclude<Route, 'portal'> | 'menu' | 'close'
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
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
}

function Icon({ name }: { name: IconName }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="logo" aria-label="ARC"><svg className="logo-mark" viewBox="0 0 40 40" aria-hidden="true"><path fill="#D9633C" d="M2 2h36v13.2C25.4 15.2 15.2 25.4 15.2 38H2V2Z"/><path fill="#F8F6F0" d="M15.2 38C15.2 25.4 25.4 15.2 38 15.2v8.2A14.6 14.6 0 0 0 23.4 38h-8.2Z"/><path fill="#2E2C29" d="M23.4 38A14.6 14.6 0 0 1 38 23.4V38H23.4Z"/><circle cx="11" cy="11" r="3.2" fill="#E2A44C"/></svg>{!compact && <strong>ARC</strong>}</div>
}

function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone || String(children).toLowerCase()}`}>{children}</span>
}

function Button({ children, variant = 'primary', onClick, type = 'button', disabled = false }: { children: ReactNode; variant?: string; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean }) {
  return <button className={`button ${variant}`} onClick={onClick} type={type} disabled={disabled}>{children}</button>
}

function Sidebar({ route, go, collapsed, setCollapsed, mobileOpen, closeMobile }: { route: Route; go: (r: Route) => void; collapsed: boolean; setCollapsed: (v: boolean) => void; mobileOpen: boolean; closeMobile: () => void }) {
  const items: [Route, string, string, IconName][] = [
    ['dashboard', 'Dashboard', '', 'dashboard'], ['clients', 'Carteira de clientes', '', 'clients'], ['pipeline', 'Pipeline de vendas', '18', 'pipeline'], ['builder', 'Construtor de orçamento', '', 'builder'], ['projects', 'Projetos', '', 'projects'], ['catalog', 'Catálogo de produtos', '', 'catalog'], ['inventory', 'Controle de estoque', '7', 'inventory'], ['suppliers', 'Fornecedores', '', 'suppliers'], ['schedule', 'Calendário de entregas', '', 'schedule'], ['finance', 'Painel financeiro', '', 'finance'], ['team', 'Equipe', '', 'team'], ['integrations', 'Integrações', '', 'integrations'], ['logs', 'Logs de auditoria', '', 'logs'],
  ]
  const navigate = (next: Route) => { go(next); closeMobile() }
  return <><button className={`sidebar-scrim ${mobileOpen ? 'show' : ''}`} onClick={closeMobile} aria-label="Fechar menu lateral"/><aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
    <div className="side-head"><Logo compact={collapsed} /><button className="mobile-close" onClick={closeMobile} aria-label="Fechar menu"><Icon name="close"/></button><button className="collapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>«</button></div>
    <Button onClick={() => navigate('builder')}>{collapsed ? '+' : '+ Novo orçamento'}</Button>
    <nav>
      {items.map(([key, label, count, itemIcon], index) => <div key={key}>
        {!collapsed && [1, 5, 8].includes(index) && <span className="nav-label">{index === 1 ? 'VENDAS' : index === 5 ? 'GALPÃO' : 'GESTÃO'}</span>}
        <button className={route === key ? 'active' : ''} onClick={() => navigate(key)} title={label}><span><Icon name={itemIcon}/></span>{!collapsed && <>{label}<em>{count}</em></>}</button>
      </div>)}
    </nav>
    <button className="user-card" onClick={async () => { await logout(); location.hash = 'login'; location.reload() }}><span>C</span>{!collapsed && <><b>Cissa<small>ADMIN</small></b><i>⌄</i></>}</button>
  </aside></>
}

function AppShell({ route, go, children }: { route: Route; go: (r: Route) => void; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  return <div className={`app ${collapsed ? 'rail' : ''}`}><Sidebar route={route} go={go} collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} closeMobile={()=>setMobileOpen(false)} /><div className="app-body"><header className="mobile-topbar"><button onClick={()=>setMobileOpen(true)} aria-label="Abrir menu"><Icon name="menu"/></button><Logo/><button className="mobile-avatar" aria-label="Abrir perfil" onClick={()=>go('team')}>C</button></header><main className="content">{children}</main></div></div>
}

function PageHead({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return <header className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div>{actions && <div className="actions">{actions}</div>}</header>
}

function Kpi({ label, value, note, dark }: { label: string; value: string; note: string; dark?: boolean }) {
  return <article className={`card kpi ${dark ? 'dark' : ''}`}><p className="mono">{label}</p><strong>{value}</strong><small>{note}</small></article>
}

const statusValues: [Status, number, number][] = [['Gerando', 14, 22], ['Planejando', 26, 41], ['Enviado', 43, 68], ['Aprovado', 34, 53], ['Perdido', 11, 17]]
function StatusBars({ rows = statusValues }: { rows?: [Status, number, number][] }) { return <div className="status-bars">{rows.map(([s, n, w]) => <div key={s}><span>{s}</span><i><b className={s.toLowerCase()} style={{ width: `${w}%` }} /></i><em>{n}</em></div>)}</div> }

function Dashboard() {
  const [reportOpen, setReportOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [quotesData, setQuotesData] = useState<Quote[]>([])
  const [clientsData, setClientsData] = useState<Client[]>([])
  const [productsData, setProductsData] = useState<Product[]>([])
  const [eventsData, setEventsData] = useState<CalendarEvent[]>([])
  const [userName, setUserName] = useState('')

  useEffect(() => {
    let mounted = true
    Promise.all([listQuotes(), listClients(), listInventoryProducts(), listCalendarEvents()])
      .then(([quotesRes, clientsRes, productsRes, eventsRes]) => {
        if (!mounted) return
        setQuotesData(quotesRes); setClientsData(clientsRes); setProductsData(productsRes); setEventsData(eventsRes)
      })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar o painel.') })
      .finally(() => { if (mounted) setLoading(false) })
    getSessionUser().then(data => { if (mounted) setUserName(String(data.nome || '').split(' ')[0]) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  const criticalStock = productsData.filter(product => product.quantidade_estoque <= product.estoque_minimo).length
  const openQuotes = quotesData.filter(quote => !['Aprovado','Orçamento negado','Entregue','Faturado','Devolvido'].includes(quote.status))
  const openValue = openQuotes.reduce((total, quote) => total + (quote.valor_total || 0), 0)
  const pendingApproval = quotesData.filter(quote => quote.status === 'Orçamento gerado').length

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const weekStart = new Date(startOfToday); weekStart.setDate(startOfToday.getDate() - ((today.getDay() + 6) % 7))
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7)
  const weekEvents = eventsData.filter(event => { const d = new Date(event.start); return d >= weekStart && d < weekEnd })
  const deliveriesThisWeek = weekEvents.filter(event => event.tipo === 'Entrega').length

  const upcomingEvents = [...eventsData]
    .filter(event => new Date(event.start) >= startOfToday)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 4)
  function daysUntil(dateStr: string) { return Math.round((new Date(dateStr).getTime() - startOfToday.getTime()) / 86400000) }
  function relativeLabel(dateStr: string) { const diff = daysUntil(dateStr); if (diff <= 0) return 'hoje'; if (diff === 1) return 'amanhã'; return `${diff} dias` }
  function relativeTone(dateStr: string) { const diff = daysUntil(dateStr); if (diff <= 0) return 'danger'; if (diff <= 3) return 'warning'; return 'success' }

  const revenueByVendor = new Map<string, number>()
  quotesData.forEach(quote => { const name = quote.vendedor_nome || 'Sem vendedor'; revenueByVendor.set(name, (revenueByVendor.get(name) || 0) + (quote.valor_total || 0)) })
  const teamRanking = [...revenueByVendor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const topRevenue = teamRanking[0]?.[1] || 1

  const statusCounts = statusValues.map(([status]) => [status, quotesData.filter(quote => (columnByBackendStatus[quote.status] || 'Gerando') === status).length] as [Status, number])
  const maxStatusCount = Math.max(1, ...statusCounts.map(([, count]) => count))
  const statusRows: [Status, number, number][] = statusCounts.map(([status, count]) => [status, count, count ? Math.max(10, Math.round(count / maxStatusCount * 100)) : 0])

  const weekDayLabels = ['SEG','TER','QUA','QUI','SEX','SÁB','DOM']
  const weekDays = Array.from({length: 7}, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d })
  const weekMonthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(weekDays[0])

  return <><PageHead eyebrow="PAINEL DE CONTROLE · ADM" title={userName ? `Bom dia, ${userName}.` : 'Bom dia.'} subtitle={`${deliveriesThisWeek} entrega${deliveriesThisWeek===1?'':'s'} nesta semana · ${pendingApproval} orçamento${pendingApproval===1?'':'s'} aguardando sua aprovação.`} actions={<><Button variant="secondary" onClick={() => setReportOpen(true)}>Relatório mensal</Button><Button onClick={() => { location.hash = 'builder'; location.reload() }}>Novo orçamento</Button></>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="kpi-grid"><Kpi label="ORÇAMENTOS GLOBAIS" value={loading?'...':String(quotesData.length)} note={`${openQuotes.length} em andamento`} /><Kpi label="CLIENTES NA BASE" value={loading?'...':String(clientsData.length)} note="cadastrados no CRM" /><Kpi label="ITENS NO GALPÃO" value={loading?'...':String(productsData.length)} note={`${criticalStock} abaixo do mínimo`} /><Kpi dark label="EM APROVAÇÃO" value={loading?'...':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact'}).format(openValue/100)} note={`${openQuotes.length} propostas abertas`} /></section>
    <section className="dashboard-grid"><article className="card span-two"><div className="card-title"><h2>Orçamentos por status</h2><span className="mono">FUNIL · TODOS OS REGISTROS</span></div><StatusBars rows={statusRows} /></article>
      <article className="card"><h2>Próximos eventos</h2>{upcomingEvents.length ? <ul className="events">{upcomingEvents.map(event => <li key={event.id}><i className={relativeTone(event.start)} />{event.tipo} · {event.cliente_nome} <b>{relativeLabel(event.start)}</b></li>)}</ul> : <p className="empty-state">Nenhum evento agendado.</p>}</article>
      <article className="card team"><h2>Equipe comercial</h2>{teamRanking.length ? teamRanking.map(([name, total]) => <div key={name}><span>{name.split(' ').map(part=>part[0]).slice(0,2).join('')}</span><p>{name}<i><b style={{width:`${Math.round(total/topRevenue*100)}%`}} /></i></p><em>{new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact'}).format(total/100)}</em></div>) : <p className="empty-state">Sem orçamentos ainda.</p>}</article>
      <article className="card calendar"><div className="card-title"><h2>Visão da semana</h2><span className="mono">{String(weekDays[0].getDate()).padStart(2,'0')} — {String(weekDays[6].getDate()).padStart(2,'0')} DE {weekMonthLabel.toUpperCase()}</span></div><div className="week">{weekDays.map((d,i)=>{ const isToday = d.toDateString()===today.toDateString(); const dayEvents = weekEvents.filter(event=>new Date(event.start).toDateString()===d.toDateString()); return <div className={isToday?'today':''} key={d.toISOString()}><span>{weekDayLabels[i]} {String(d.getDate()).padStart(2,'0')}</span>{dayEvents.map(event=><b key={event.id}>{event.tipo} · {event.cliente_nome}</b>)}</div> })}</div></article>
    </section>{reportOpen&&<Modal title="Relatório mensal" close={()=>setReportOpen(false)}><div className="modal-form"><p>Resumo pronto para exportação.</p><ul className="modal-summary"><li>{quotesData.length} orçamentos globais</li><li>{deliveriesThisWeek} entregas nesta semana</li><li>{new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(openValue/100)} em aprovação</li></ul><footer><Button variant="secondary" onClick={()=>setReportOpen(false)}>Fechar</Button><Button onClick={()=>{setFeedback('Relatório preparado para download.');setReportOpen(false)}}>Exportar relatório</Button></footer></div></Modal>}{feedback&&<Feedback message={feedback} close={()=>setFeedback('')}/>}</>
}

const backendStatusByColumn: Record<Status, string> = { Gerando: 'Gerando orçamento', Planejando: 'Planejando', Enviado: 'Orçamento gerado', Aprovado: 'Aprovado', Perdido: 'Orçamento negado' }
const columnByBackendStatus: Record<string, Status> = { 'Gerando orçamento': 'Gerando', 'Planejando': 'Planejando', 'Orçamento gerado': 'Enviado', 'Aprovado': 'Aprovado', 'Orçamento negado': 'Perdido', 'Entregue': 'Aprovado', 'Faturado': 'Aprovado', 'Devolvido': 'Perdido' }
type KanbanQuote = { id: string; backendId?: number; project: string; client: string; status: Status; value: number; date: string; owner: string }

function quoteToCard(quote: Quote): KanbanQuote {
  const owner = (quote.vendedor_nome || 'ARC').split(' ').map(part => part[0]).slice(0, 2).join('')
  const dateValue = quote.data_entrega || quote.created_at
  const date = dateValue ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(dateValue)) : 'sem data'
  return { id: `ORC-${String(quote.id).padStart(4, '0')}`, backendId: quote.id, project: quote.cliente_nome || quote.tipo_orcamento, client: quote.cliente_nome || 'Cliente sem nome', status: columnByBackendStatus[quote.status] || 'Gerando', value: quote.valor_total || 0, date, owner }
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
  const [approveCard, setApproveCard] = useState<KanbanQuote | null>(null)
  const [approveCnpj, setApproveCnpj] = useState('')

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

  const cards: KanbanQuote[] = remoteQuotes === null ? quotes : remoteQuotes.map(quoteToCard)
  const filtered = cards.filter(q => `${q.project} ${q.client} ${q.id}`.toLowerCase().includes(query.toLowerCase()))
  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setQuoteError('')
    const form = new FormData(event.currentTarget); const clienteId = Number(form.get('cliente_id') || 0)
    try {
      if (!clienteId) throw new Error('Selecione um cliente para criar o orçamento.')
      const created = await createQuote({ cliente_id: clienteId, tipo_orcamento: String(form.get('tipo_orcamento') || 'Venda') as 'Venda'|'Locacao'|'Producao', itens: [] })
      setRemoteQuotes(current => [...(current || []), created]); setOpen(false); setFeedback('Orçamento criado no backend.')
    } catch (err) { setQuoteError(err instanceof Error ? err.message : 'Falha ao criar orçamento.') } finally { setSaving(false) }
  }
  async function applyStatus(card: KanbanQuote, status: Status, cnpj?: string) {
    if (!card.backendId) { setFeedback('Dados locais não podem alterar status antes da sincronização.'); return }
    try { await updateQuoteStatus(card.backendId, backendStatusByColumn[status], cnpj); setRemoteQuotes(current => (current || []).map(item => item.id === card.backendId ? { ...item, status: backendStatusByColumn[status] } : item)); setFeedback(`${card.id} movido para ${status}.`) }
    catch (err) { setQuoteError(err instanceof Error ? err.message : 'Falha ao atualizar status.') }
  }
  async function moveQuote(card: KanbanQuote, status: Status) {
    if (status === 'Aprovado' && cnpjOptions.length) { setApproveCnpj(cnpjOptions[0].cnpj); setApproveCard(card); return }
    await applyStatus(card, status)
  }
  async function confirmApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!approveCard) return
    await applyStatus(approveCard, 'Aprovado', approveCnpj)
    setApproveCard(null)
  }
  return <><PageHead eyebrow="VENDAS · PIPELINE" title={view==='Kanban'?'Kanban dos orçamentos':'Lista de orçamentos'} subtitle={`${remoteQuotes === null ? 'visão local' : `${remoteQuotes.length} orçamentos do backend`} · ${loading ? 'sincronizando…' : 'sincronizado'}`} actions={<><input className="search" placeholder="Buscar projeto ou cliente…" value={query} onChange={e=>setQuery(e.target.value)} /><Button variant="secondary" onClick={()=>setFeedback('Filtro de vendedor será ligado ao endpoint de equipe.')}>Vendedor⌄</Button><div className="segmented"><button className={view==='Lista'?'active':''} onClick={()=>setView('Lista')}>Lista</button><button className={view==='Kanban'?'active':''} onClick={()=>setView('Kanban')}>Kanban</button></div><Button onClick={()=>setOpen(true)}>+ Orçamento</Button></>} />{quoteError&&<p className="form-error" role="alert">{quoteError}</p>}
    {view==='Kanban'?<div className="kanban">{statusValues.map(([status, fallbackTotal]) => { const columnCards = filtered.filter(q=>q.status===status); return <section className={`kanban-col ${status.toLowerCase()}`} key={status}><header><h2><i />{status}</h2><Badge>{remoteQuotes === null ? fallbackTotal : columnCards.length}</Badge><p className="mono">{money(columnCards.reduce((total, card) => total + card.value, 0))}</p></header>{columnCards.map(card=><article className="quote-card" key={card.id}><div><span className="mono">{card.id}</span><b>{money(card.value)}</b></div><h3>{card.project}</h3><p>{card.client}</p><footer><span>{card.owner}</span><em>{card.date}</em></footer>{remoteQuotes!==null&&card.backendId&&<select aria-label={`Status de ${card.id}`} value={card.status} onChange={event=>moveQuote(card,event.target.value as Status)}>{statusValues.map(([option])=><option key={option} value={option}>{option}</option>)}</select>}</article>)}{status==='Gerando'&&<button className="add-card" onClick={()=>setOpen(true)}>+ Adicionar</button>}</section>})}</div>:<article className="card list-card"><DataTable headers={['ORÇAMENTO','PROJETO','CLIENTE','STATUS','VALOR']} rows={filtered.map(q=>[<span className="mono">{q.id}</span>,<b>{q.project}</b>,q.client,<Badge>{q.status}</Badge>,money(q.value)])}/></article>}{open&&<Modal title="Novo orçamento" close={()=>setOpen(false)}><form className="modal-form" onSubmit={submitQuote}><label>Cliente<select name="cliente_id" required autoFocus defaultValue=""><option value="" disabled>Selecione um cliente…</option>{quoteClients.map(client=><option key={client.id} value={client.id}>{client.nome_fantasia}</option>)}</select></label><label>Tipo de orçamento<select name="tipo_orcamento" defaultValue="Venda"><option>Venda</option><option>Locacao</option><option>Producao</option></select></label>{quoteError&&<p className="form-error" role="alert">{quoteError}</p>}<footer><Button variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving?'Salvando…':'Criar orçamento'}</Button></footer></form></Modal>}{approveCard&&<Modal title={`Aprovar ${approveCard.id}`} close={()=>setApproveCard(null)}><form className="modal-form" onSubmit={confirmApproval}><label>CNPJ de faturamento<select value={approveCnpj} onChange={e=>setApproveCnpj(e.target.value)} required autoFocus>{cnpjOptions.map(o=><option key={o.cnpj} value={o.cnpj}>{o.nome||o.cnpj} — {o.cnpj}</option>)}</select></label><footer><Button variant="secondary" onClick={()=>setApproveCard(null)}>Cancelar</Button><Button type="submit">Aprovar orçamento</Button></footer></form></Modal>}{feedback&&<Feedback message={feedback} close={()=>setFeedback('')}/>}</>
}

const proposalItems = [['Marcenaria cozinha — MDF carvalho','12,40','m²','2.180','27.032'],['Bancada quartzo branco absoluto','4,10','m²','1.640','6.724'],['Painel ripado living — freijó','8,60','m²','1.290','11.094'],['Iluminação embutida — perfil linear','14','un','340','4.760'],['Instalação e montagem','3','diária','980','2.940'],['Frete e içamento','1','un','1.850','1.850']]
type BuilderItem = { key: string; productId: number | null; name: string; quantity: number; unit: string; unitPrice: number; isExternal: boolean; projetoItemId: number | null }
type ValidationRow = { projetoItemId: number; nome: string; quantidade: number; material: string | null; matchedProductId: number | null; unitPrice: number; included: boolean }

function Builder() {
  const [clientsList, setClientsList] = useState<Client[]>([])
  const [productsList, setProductsList] = useState<Product[]>([])
  const [selectedClient, setSelectedClient] = useState<number | ''>('')
  const [quoteType, setQuoteType] = useState<'Venda'|'Locacao'|'Producao'>('Venda')
  const [payment, setPayment] = useState('40% entrada + 3x')
  const [paymentOptions, setPaymentOptions] = useState<PaymentCondition[]>([])
  const [items, setItems] = useState<BuilderItem[]>([])
  const [quoteId, setQuoteId] = useState<number | null>(null)
  const [itemModal, setItemModal] = useState<'catalog'|'free'|'project'|'project-validate'|null>(null)
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
      if (clientData[0]) setSelectedClient(clientData[0].id)
      setItems(productData.slice(0, 3).map((product, index) => ({ key: `product-${product.id}-${index}`, productId: product.id, name: product.nome, quantity: 1, unit: 'un.', unitPrice: product.preco_venda, isExternal: false, projetoItemId: null })))
    }).catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar dados do orçamento.') }).finally(() => { if (mounted) setLoading(false) })
    listPaymentConditions().then(data => {
      if (!mounted) return
      const active = data.filter(condition => condition.ativo !== false)
      setPaymentOptions(active)
      if (active[0]) setPayment(active[0].nome)
    }).catch(() => undefined)
    listProjetos().then(data => { if (mounted) setProjetosList(data) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const selectedClientName = clientsList.find(client => client.id === selectedClient)?.nome_fantasia || 'Cliente não selecionado'
  const payload = () => ({
    cliente_id: Number(selectedClient), tipo_orcamento: quoteType, condicoes_pagamento_selecionadas: payment,
    projeto_id: projectDraft?.id ?? null,
    itens: items.map(item => item.isExternal
      ? { quantidade: item.quantity, preco_unitario_aplicado: item.unitPrice, is_externo: true, nome_externo: item.name, descricao_externa: 'Item livre do construtor', projeto_item_id: item.projetoItemId }
      : { quantidade: item.quantity, preco_unitario_aplicado: item.unitPrice, produto_id: item.productId, projeto_item_id: item.projetoItemId }),
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
        key: `project-${row.projetoItemId}-${Date.now()}`,
        productId: row.matchedProductId,
        name: produto?.nome || row.nome,
        quantity: row.quantidade,
        unit: 'un.',
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
      if (!selectedClient) throw new Error('Selecione um cliente antes de salvar.')
      if (!items.length) throw new Error('Adicione pelo menos um item ao orçamento.')
      const saved = quoteId ? await updateQuote(quoteId, payload()) : await createQuote(payload())
      setQuoteId(saved.id); setFeedback(`Orçamento ORC-${String(saved.id).padStart(4, '0')} salvo no backend.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar orçamento.') } finally { setSaving(false) }
  }

  async function regeneratePdf() {
    if (!quoteId) { setError('Salve o orçamento antes de gerar o PDF.'); return }
    try { const result = await regenerateQuotePdf(quoteId); setFeedback(result.status) } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao gerar PDF.') }
  }

  function addCatalogItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const product = productsList.find(item => item.id === Number(form.get('produto_id'))); if (!product) return
    setItems(current => [...current, { key: `product-${product.id}-${Date.now()}`, productId: product.id, name: product.nome, quantity: Number(form.get('quantidade') || 1), unit: 'un.', unitPrice: product.preco_venda, isExternal: false, projetoItemId: null }]); setItemModal(null)
  }

  function addFreeItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setItems(current => [...current, { key: `free-${Date.now()}`, productId: null, name: String(form.get('nome') || 'Item livre'), quantity: Number(form.get('quantidade') || 1), unit: String(form.get('unidade') || 'un.'), unitPrice: Math.round(Number(form.get('preco') || 0) * 100), isExternal: true, projetoItemId: null }]); setItemModal(null)
  }

  return <><PageHead eyebrow={quoteId ? `ORC-${String(quoteId).padStart(4, '0')} · RASCUNHO` : 'NOVO ORÇAMENTO · RASCUNHO'} title={`${selectedClientName} — orçamento`} actions={<><Badge>Gerando</Badge><Button variant="secondary" onClick={() => saveQuote()} disabled={saving}>{saving ? 'Salvando…' : 'Salvar rascunho'}</Button><Button onClick={regeneratePdf}>Gerar PDF e enviar</Button></>} />{error && <p className="form-error" role="alert">{error}</p>}{loading ? <article className="card empty-state"><h2>Carregando clientes e catálogo…</h2></article> : <form onSubmit={saveQuote}><div className="builder"><div><article className="card fields"><label>Cliente<select value={selectedClient} onChange={event => setSelectedClient(Number(event.target.value) || '')} required><option value="" disabled>Selecione um cliente…</option>{clientsList.map(client => <option key={client.id} value={client.id}>{client.nome_fantasia}</option>)}</select></label><label>Tipo de orçamento<select value={quoteType} onChange={event => setQuoteType(event.target.value as 'Venda'|'Locacao'|'Producao')}><option>Venda</option><option>Locacao</option><option>Producao</option></select></label><label>Pagamento{paymentOptions.length ? <select value={payment} onChange={event => setPayment(event.target.value)} required><option value="" disabled>Selecione uma condição…</option>{paymentOptions.map(option => <option key={option.id} value={option.nome}>{option.nome}</option>)}</select> : <input value={payment} onChange={event => setPayment(event.target.value)} placeholder="40% entrada + 3x…"/>}</label></article><article className="card items"><div className="card-title"><h2>Itens <small>· {items.length}</small></h2><span><Button type="button" variant="secondary" onClick={() => setItemModal('catalog')}>Do catálogo</Button> <Button type="button" variant="dark" onClick={() => setItemModal('free')}>+ Item livre</Button> <Button type="button" variant="secondary" onClick={() => setItemModal('project')}>Importar de um projeto</Button></span></div><div className="item-head mono"><span>DESCRIÇÃO</span><span>QTD / M²</span><span>UN.</span><span>UNITÁRIO</span><span>TOTAL</span></div>{items.map((item, index) => <div className={`item-row ${index === items.length - 1 ? 'editing' : ''}`} key={item.key}><div><b>{item.name}</b><small>{item.isExternal ? 'ITEM LIVRE · especificação do projeto' : `CAT-${String(item.productId).padStart(4, '0')} · catálogo`}</small></div><span>{item.quantity}</span><span>{item.unit}</span><span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unitPrice / 100)}</span><span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantity * item.unitPrice / 100)}</span><button type="button" aria-label={`Remover ${item.name}`} onClick={() => setItems(current => current.filter(currentItem => currentItem.key !== item.key))}>×</button></div>)}{!items.length && <p className="empty-state">Nenhum item adicionado ainda.</p>}</article></div><aside><article className="card total-card"><p className="mono">TOTAL DA PROPOSTA</p><strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total / 100)}</strong><dl><dt>Itens</dt><dd>{items.length}</dd><dt>Cliente</dt><dd>{selectedClientName}</dd><dt>Tipo</dt><dd>{quoteType}</dd></dl></article><article className="card attachments"><p className="mono">ANEXOS</p><span>PDF gerado automaticamente ao salvar</span></article></aside></div></form>}{itemModal === 'catalog' && <Modal title="Adicionar do catálogo" close={() => setItemModal(null)}><form className="modal-form" onSubmit={addCatalogItem}><label>Produto<select name="produto_id" required autoFocus defaultValue=""><option value="" disabled>Selecione um produto…</option>{productsList.map(product => <option key={product.id} value={product.id}>{product.nome}</option>)}</select></label><label>Quantidade<input name="quantidade" type="number" min="1" step="1" defaultValue="1" required/></label><footer><Button variant="secondary" onClick={() => setItemModal(null)}>Cancelar</Button><Button type="submit">Adicionar item</Button></footer></form></Modal>}{itemModal === 'free' && <Modal title="Adicionar item livre" close={() => setItemModal(null)}><form className="modal-form" onSubmit={addFreeItem}><label>Descrição<input name="nome" required autoFocus placeholder="Bancada especial…"/></label><label>Quantidade<input name="quantidade" type="number" min="1" step="1" defaultValue="1" required/></label><label>Unidade<input name="unidade" defaultValue="un." required/></label><label>Preço unitário<input name="preco" type="number" min="0" step="0.01" required placeholder="0,00"/></label><footer><Button variant="secondary" onClick={() => setItemModal(null)}>Cancelar</Button><Button type="submit">Adicionar item</Button></footer></form></Modal>}
    {itemModal === 'project' && <Modal title="Importar de um projeto" close={() => setItemModal(null)}>
      <div className="modal-form" style={{ gridTemplateColumns: '1fr' }}>
        {projetosList.length ? <DataTable headers={['PROJETO', 'ORIGEM', 'CLIENTE', 'ITENS', '']} rows={sortedProjects.map(p => [
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
        <p className="empty-state">Confira cada item antes de adicionar ao orçamento — nada é incluído automaticamente.</p>
        <DataTable headers={['ITEM', 'QTD', 'PRODUTO DO CATÁLOGO', 'PREÇO UNIT.', 'INCLUIR']} rows={validationRows.map((row, index) => [
          <div><b>{row.nome}</b>{row.material && <small>{row.material}</small>}</div>,
          <input type="number" min="1" step="1" value={row.quantidade} onChange={e => updateValidationRow(index, { quantidade: Number(e.target.value) || 1 })}/>,
          <select value={row.matchedProductId ?? ''} onChange={e => { const id = e.target.value ? Number(e.target.value) : null; const produto = productsList.find(p => p.id === id); updateValidationRow(index, { matchedProductId: id, unitPrice: produto ? produto.preco_venda : row.unitPrice }) }}>
            <option value="">— manter como item externo —</option>
            {productsList.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>,
          <input type="number" min="0" step="0.01" value={(row.unitPrice / 100).toFixed(2)} onChange={e => updateValidationRow(index, { unitPrice: Math.round(Number(e.target.value || 0) * 100) })}/>,
          <input type="checkbox" checked={row.included} onChange={e => updateValidationRow(index, { included: e.target.checked })} aria-label={`Incluir ${row.nome}`}/>,
        ])}/>
        <footer><Button variant="secondary" onClick={() => setItemModal(null)}>Cancelar</Button><Button onClick={confirmProjectSelection} disabled={!validationRows.some(row => row.included)}>Confirmar seleção</Button></footer>
      </div>
    </Modal>}
    {feedback && <Feedback message={feedback} close={() => setFeedback('')}/>}</>
}

const projetoOrigemLabel: Record<string, string> = { sketchup: 'SketchUp', manual_csv: 'CSV manual' }

function Projects() {
  const [items, setItems] = useState<Projeto[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
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

  const filtered = items.filter(item => `${item.nome} ${item.origem} ${item.cliente_nome || ''}`.toLowerCase().includes(query.toLowerCase()))

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

  return <><PageHead eyebrow="VENDAS · PROJETOS" title="Projetos" subtitle={`${items.length} projeto(s) importado(s) de softwares de arquitetura`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar projeto, origem ou cliente..."/><Button onClick={() => setOpen(true)}>+ Importar CSV</Button></>}/>
    {error && <p className="form-error" role="alert">{error}</p>}
    <article className="card list-card">
      <div className="card-title"><h2>Projetos importados</h2><Badge>{filtered.length} resultados</Badge></div>
      {loading ? <p className="empty-state">Carregando projetos…</p> : filtered.length ? <DataTable headers={['PROJETO', 'ORIGEM', 'CLIENTE', 'ITENS', 'IMPORTADO EM', 'AÇÕES']} rows={filtered.map(item => [
        <b>{item.nome}</b>,
        <Badge tone="neutral">{projetoOrigemLabel[item.origem] || item.origem}</Badge>,
        item.cliente_nome || 'Sem cliente definido',
        String(item.total_itens ?? 0),
        new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(item.created_at)),
        <span className="row-actions"><button className="text-action" onClick={() => openDetail(item.id)}>Ver itens</button> <button className="text-action" onClick={() => removeProjeto(item)}>Excluir</button></span>,
      ])}/> : <p className="empty-state">Nenhum projeto importado ainda. Use "+ Importar CSV" para trazer uma lista de itens do SketchUp.</p>}
    </article>
    {open && <Modal title="Importar projeto (CSV)" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitImport}>
      <label>Nome do projeto<input name="nome" autoFocus required placeholder="Apto 302 - Torre B"/></label>
      <label>Cliente (opcional)<select name="cliente_id" defaultValue=""><option value="">Sem cliente definido</option>{clientsList.map(client => <option key={client.id} value={client.id}>{client.nome_fantasia}</option>)}</select></label>
      <label>Arquivo CSV<input name="file" type="file" accept=".csv,.txt" required/></label>
      <small>Exporte a lista de componentes pelo "Generate Report" do SketchUp (colunas nome/quantidade/material/dimensões) e envie aqui.</small>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Importando…' : 'Importar'}</Button></footer>
    </form></Modal>}
    {detail && <Modal title={`Projeto · ${detail.nome}`} close={() => setDetail(null)}>
      <DataTable headers={['ITEM', 'QTD', 'MATERIAL', 'PRODUTO SUGERIDO']} rows={detail.itens.map(item => [
        <b>{item.nome}</b>, item.quantidade, item.material || '—', item.produto_nome_sugerido || <span className="danger-text">Sem correspondência</span>,
      ])}/>
    </Modal>}
    {feedback && <Feedback message={feedback} close={() => setFeedback('')}/>}
  </>
}

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) { return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table><footer>Exibindo {rows.length} registros <span>‹ <b>1</b> 2 ›</span></footer></div> }

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={close}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={e=>e.stopPropagation()}><header><h2 id="modal-title">{title}</h2><button aria-label="Fechar" onClick={close}>×</button></header>{children}</section></div> }

function Feedback({ message, close }: { message: string; close: () => void }) {
  return <div className="toast" role="status" aria-live="polite"><i />{message}<button aria-label="Fechar aviso" onClick={close}>×</button></div>
}

function Clients() {
  const [items, setItems] = useState<Client[]>([])
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
  async function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const form = new FormData(event.currentTarget)
    const input: ClientInput = {
      nome_fantasia: String(form.get('nome_fantasia') || ''), cpf_cnpj: String(form.get('cpf_cnpj') || '') || null,
      nome_responsavel: String(form.get('nome_responsavel') || '') || null, email: String(form.get('email') || '') || null,
      contato: String(form.get('contato') || '') || null, endereco_entrega: String(form.get('endereco_entrega') || '') || null,
      endereco_faturamento: String(form.get('endereco_faturamento') || '') || null, status: 'ativo',
    }
    try { const created = await createClient(input); setItems(current => [created, ...current]); setOpen(false) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar cliente.') }
    finally { setSaving(false) }
  }
  async function removeClient(item: Client) {
    if (!confirm(`Excluir o cliente "${item.nome_fantasia}"? Esta ação não pode ser desfeita.`)) return
    try { await deleteClient(item.id); setItems(current => current.filter(current_item => current_item.id !== item.id)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao excluir cliente.') }
  }
  return <><PageHead eyebrow="VENDAS · CARTEIRA" title="Carteira de clientes" subtitle={`${items.length} clientes carregados do backend`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nome, CPF/CNPJ ou contato..."/><Button onClick={() => setOpen(true)}>+ Novo cliente</Button></>}/>{error && <p className="form-error" role="alert">{error}</p>}<section className="kpi-grid"><Kpi label="CLIENTES ATIVOS" value={String(items.filter(item => item.status === 'ativo').length)} note="vindos da API"/><Kpi label="RESULTADOS" value={String(filtered.length)} note="filtro atual"/><Kpi label="COM CONTATO" value={String(items.filter(item => item.email || item.contato).length)} note="e-mail ou telefone"/><Kpi dark label="STATUS" value={loading ? '...' : 'OK'} note="sincronização concluída"/></section><article className="card list-card"><div className="card-title"><h2>Clientes</h2><Badge>{filtered.length} resultados</Badge></div>{loading ? <p className="empty-state">Carregando clientes…</p> : <DataTable headers={['CLIENTE','CONTATO','DOCUMENTO','STATUS','ENDEREÇO','AÇÕES']} rows={filtered.map(item => [<div className="person"><span>{item.nome_fantasia.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><b>{item.nome_fantasia}<small>{item.nome_responsavel || item.cpf_cnpj || 'Sem documento'}</small></b></div>, item.email || item.contato || 'Sem contato', item.cpf_cnpj || 'Não informado', <Badge tone={item.status === 'ativo' ? 'success' : 'warning'}>{item.status || 'indefinido'}</Badge>, item.endereco_entrega || 'Não informado', <button className="text-action" onClick={() => removeClient(item)}>Excluir</button>])}/>}</article>{open && <Modal title="Novo cliente" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitClient}><label>Nome ou razão social<input name="nome_fantasia" autoFocus required placeholder="Studio Aroeira"/></label><label>CPF / CNPJ<input name="cpf_cnpj" placeholder="12.345.678/0001-90"/></label><label>Responsável<input name="nome_responsavel" placeholder="Ana Prado"/></label><label>E-mail<input name="email" type="email" placeholder="contato@studio.com.br"/></label><label>Telefone<input name="contato" placeholder="(11) 99999-9999"/></label><label>Endereço de entrega<input name="endereco_entrega" placeholder="Rua, número, cidade/UF"/></label><footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar cliente'}</Button></footer></form></Modal>}</>
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
  return <><PageHead eyebrow="GALPÃO · ESTOQUE" title="Controle de estoque" subtitle={`${items.length} itens sincronizados com o backend`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar código ou material..."/></>}/>{error && <p className="form-error" role="alert">{error}</p>}<section className="kpi-grid"><Kpi label="ITENS EM ESTOQUE" value={String(items.length)} note="ativos na API"/><Kpi label="ABAIXO DO MÍNIMO" value={String(critical)} note="repor esta semana"/><Kpi label="UNIDADES" value={String(items.reduce((total, item) => total + item.quantidade_estoque, 0))} note="saldo atual"/><Kpi dark label="STATUS" value={loading ? '...' : 'OK'} note="sincronização concluída"/></section><article className="card list-card"><div className="card-title"><h2>Itens</h2><Badge>{filtered.length} resultados</Badge></div>{loading ? <p className="empty-state">Carregando estoque…</p> : <DataTable headers={['CÓDIGO','MATERIAL','CATEGORIA','SALDO','MÍNIMO','SITUAÇÃO','AÇÃO']} rows={filtered.map(item => { const low = item.quantidade_estoque <= item.estoque_minimo; return [<span className="mono">CAT-{String(item.id).padStart(4, '0')}</span>, <b>{item.nome}</b>, item.material || 'Sem material', item.quantidade_estoque, item.estoque_minimo, <Badge tone={low ? 'danger' : 'success'}>{low ? 'Crítico' : 'Normal'}</Badge>, <span className="row-actions"><Button variant="secondary" onClick={() => setOpen(item)}>Movimentar</Button> <button className="text-action" onClick={() => setEditing(item)}>Editar</button></span>] })}/>}</article>{open && <Modal title={`Movimentar · ${open.nome}`} close={() => setOpen(null)}><form className="modal-form" onSubmit={submitMovement}><label>Quantidade<input name="quantidade" type="number" min="1" step="1" required autoFocus placeholder="1"/></label><label>Justificativa<textarea name="justificativa" required placeholder="Reposição recebida, ajuste ou baixa operacional"/></label>{error && <p className="form-error" role="alert">{error}</p>}<footer><Button variant="secondary" onClick={() => setOpen(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Registrar movimentação'}</Button></footer></form></Modal>}{editing && <Modal title={`Editar · ${editing.nome}`} close={() => setEditing(null)}><form className="modal-form" onSubmit={submitEdit}><label>Nome<input name="nome" defaultValue={editing.nome} autoFocus required/></label><label>Categoria<input name="tipo" defaultValue={editing.tipo || ''}/></label><label>Material<input name="material" defaultValue={editing.material || ''}/></label><label>Preço de venda<input name="preco_venda" type="number" min="0" step="0.01" defaultValue={(editing.preco_venda/100).toFixed(2)} required/></label><label>Estoque mínimo<input name="estoque_minimo" type="number" min="0" step="1" defaultValue={editing.estoque_minimo}/></label>{error && <p className="form-error" role="alert">{error}</p>}<footer><Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</Button></footer></form></Modal>}</>
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

  return <><PageHead eyebrow="GALPÃO · CATÁLOGO" title="Catálogo de produtos" subtitle={`${products.length} materiais vindos do estoque`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar produto, código ou material..."/><Button onClick={() => setOpen(true)}>+ Produto</Button></>}/>{error&&<p className="form-error" role="alert">{error}</p>}<div className="filter-row" role="group" aria-label="Filtrar categoria">{categories.map(item => <button key={item} className={category===item?'active':''} onClick={() => setCategory(item)}>{item}</button>)}</div>{loading?<article className="card empty-state"><h2>Carregando catálogo…</h2></article>:<section className="product-grid">{filtered.map((product,index) => { const low = product.quantidade_estoque <= product.estoque_minimo; return <article className="card product-card" key={product.id}><div className={`material-swatch swatch-${index%6+1}`}><span>{product.tipo || 'Material'}</span></div><div className="product-copy"><p className="mono">CAT-{String(product.id).padStart(4,'0')}</p><h2>{product.nome}</h2><small>{product.material || 'Sem material informado'}</small><footer><b>{new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(product.preco_venda/100)}</b><Badge tone={low?'warning':'success'}>{low?'Baixo estoque':'Disponível'}</Badge></footer><button className="text-action" onClick={() => setEditing(product)}>Editar</button></div></article> })}</section>}{!loading&&!filtered.length&&<article className="card empty-state"><Logo compact/><h2>Nenhum produto encontrado</h2><p>Ajuste busca ou escolha outra categoria.</p></article>}{open&&<Modal title="Novo produto" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitProduct}><label>Nome<input name="nome" autoFocus required placeholder="MDF Carvalho Natural"/></label><label>Categoria<input name="tipo" required placeholder="Painéis"/></label><label>Material<input name="material" placeholder="Carvalho natural"/></label><label>Preço de venda<input name="preco_venda" type="number" min="0" step="0.01" required placeholder="0,00"/></label>{error&&<p className="form-error" role="alert">{error}</p>}<footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving?'Salvando…':'Salvar produto'}</Button></footer></form></Modal>}{editing&&<Modal title={`Editar · ${editing.nome}`} close={() => setEditing(null)}><form className="modal-form" onSubmit={submitEdit}><label>Nome<input name="nome" defaultValue={editing.nome} autoFocus required/></label><label>Categoria<input name="tipo" defaultValue={editing.tipo || ''} required/></label><label>Material<input name="material" defaultValue={editing.material || ''}/></label><label>Preço de venda<input name="preco_venda" type="number" min="0" step="0.01" defaultValue={(editing.preco_venda/100).toFixed(2)} required/></label><label>Estoque mínimo<input name="estoque_minimo" type="number" min="0" step="1" defaultValue={editing.estoque_minimo}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<footer><Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving?'Salvando…':'Salvar alterações'}</Button></footer></form></Modal>}</>
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
  return <><PageHead eyebrow="GALPÃO · PARCEIROS" title="Fornecedores" subtitle={`${items.length} fornecedores ativos carregados do backend`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar fornecedor, CNPJ ou contato..."/><Button onClick={() => setOpen(true)}>+ Fornecedor</Button></>}/>{error && <p className="form-error" role="alert">{error}</p>}<section className="kpi-grid compact-kpis"><Kpi label="FORNECEDORES ATIVOS" value={String(items.filter(item => item.ativo !== false).length)} note="sincronizados"/><Kpi label="RESULTADOS" value={String(filtered.length)} note="filtro atual"/><Kpi label="COM E-MAIL" value={String(items.filter(item => item.email).length)} note="contato digital"/><Kpi dark label="STATUS" value={loading ? '...' : 'OK'} note="sincronização concluída"/></section><article className="card list-card"><div className="card-title"><h2>Base de fornecedores</h2><Badge>{filtered.length} resultados</Badge></div>{loading ? <p className="empty-state">Carregando fornecedores…</p> : <DataTable headers={['FORNECEDOR','CONTATO','DOCUMENTO','TELEFONE','STATUS','AÇÕES']} rows={filtered.map(item => [<b>{item.nome_fantasia}</b>, item.contato || item.email || 'Sem contato', item.cnpj || 'Não informado', item.telefone || 'Não informado', <Badge tone={item.ativo === false ? 'warning' : 'success'}>{item.ativo === false ? 'Inativo' : item.status || 'Ativo'}</Badge>, <button className="text-action" onClick={() => removeSupplier(item)}>Excluir</button>])}/>}</article>{open && <Modal title="Novo fornecedor" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitSupplier}><label>Razão social<input name="nome_fantasia" autoFocus required placeholder="Duratex"/></label><label>CNPJ<input name="cnpj" placeholder="00.000.000/0001-00"/></label><label>Contato<input name="contato" placeholder="Marina Lopes"/></label><label>E-mail<input name="email" type="email" placeholder="contato@fornecedor.com.br"/></label><label>Telefone<input name="telefone" placeholder="(11) 3442-8801"/></label><label>Endereço<input name="endereco" placeholder="Rua, número, cidade/UF"/></label><label>Observações<textarea name="observacoes" placeholder="Condições comerciais, prazo e homologação"/></label><footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar fornecedor'}</Button></footer></form></Modal>}</>
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

  return <><PageHead eyebrow="GESTÃO · ACESSOS" title="Equipe" subtitle={`${items.length} pessoas · ${activeCount} acessos ativos`} actions={<><input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nome ou e-mail…"/><Button onClick={()=>setOpen(true)}>+ Conceder acesso</Button></>}/>{error&&<p className="form-error" role="alert">{error}</p>}<section className="team-stats"><article className="card"><span>{String(activeCount).padStart(2,'0')}</span><div><h2>Acessos ativos</h2><p>Colaboradores com acesso imediato.</p></div></article><article className="card"><span>{String(suspendedCount).padStart(2,'0')}</span><div><h2>Acesso suspenso</h2><p>Conta preservada sem login permitido.</p></div></article><article className="card security-card"><span>{mfaCount}</span><div><h2>Com MFA ativo</h2><p>Segundo fator habilitado.</p></div></article></section><article className="card list-card"><div className="card-title"><h2>Membros</h2><Badge>{rows.length} pessoas</Badge></div>{loading ? <p className="empty-state">Carregando equipe…</p> : <DataTable headers={['NOME / E-MAIL','CARGO','STATUS DO ACESSO','MFA','AÇÕES']} rows={rows.map(item=>[<div className="person"><span>{item.nome.split(' ').map(part=>part[0]).slice(0,2).join('')}</span><b>{item.nome}<small>{item.email}</small></b></div>,<Badge tone="neutral">{roleLabel[item.role]||item.role}</Badge>,<Badge tone={item.ativo?'success':'danger'}>{item.ativo?'Ativo':'Suspenso'}</Badge>,item.mfa_enabled?'✓':'—',<button className="text-action" onClick={()=>setEditing(item)}>Gerenciar</button>])}/>}</article>{open&&<Modal title="Conceder acesso" close={()=>setOpen(false)}><form className="modal-form" onSubmit={submitInvite}><label>Nome<input name="nome" autoFocus required/></label><label>E-mail<input name="email" type="email" required/></label><label>Senha provisória<input name="password" type="password" required minLength={8} placeholder="Mín. 8 caracteres, maiúscula, minúscula, número e símbolo"/></label><label>Telefone<input name="contato" placeholder="(11) 99999-9999"/></label><label>Perfil<select name="role" defaultValue="vendedor"><option value="vendedor">Vendedor</option><option value="estoquista">Estoquista</option><option value="admin">Admin</option></select></label>{error&&<p className="form-error" role="alert">{error}</p>}<footer><Button variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving?'Salvando…':'Conceder acesso'}</Button></footer></form></Modal>}{editing&&<Modal title={`Gerenciar · ${editing.nome}`} close={closeEditing}><form className="modal-form" onSubmit={submitEdit}><label>Nome<input name="nome" defaultValue={editing.nome} autoFocus required/></label><label>Telefone<input name="contato" defaultValue={editing.contato||''}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<footer>{editing.ativo&&<Button variant="secondary" onClick={()=>deactivate(editing)}>Desligar acesso</Button>}<Button type="submit" disabled={saving}>{saving?'Salvando…':'Salvar'}</Button></footer></form>
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

  return <><PageHead eyebrow="GESTÃO · INTEGRAÇÕES" title="Integrações" subtitle="Chaves de API para extensões externas (ex: SketchUp) enviarem projetos direto para a ERP" actions={<><Button onClick={() => setOpen(true)}>+ Gerar chave</Button></>}/>
    {error && <p className="form-error" role="alert">{error}</p>}
    <article className="card list-card">
      <div className="card-title"><h2>Chaves de API</h2><Badge>{items.length} chave(s)</Badge></div>
      {loading ? <p className="empty-state">Carregando chaves…</p> : items.length ? <DataTable headers={['NOME', 'PREFIXO', 'STATUS', 'CRIADA EM', 'ÚLTIMO USO', 'AÇÕES']} rows={items.map(key => [
        <b>{key.nome}</b>,
        <span className="mono">{key.prefixo}…</span>,
        <Badge tone={key.ativo ? 'success' : 'danger'}>{key.ativo ? 'Ativa' : 'Revogada'}</Badge>,
        new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(key.created_at)),
        key.last_used_at ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(key.last_used_at)) : 'Nunca usada',
        key.ativo ? <button className="text-action" onClick={() => revoke(key)}>Revogar</button> : '—',
      ])}/> : <p className="empty-state">Nenhuma chave gerada ainda. Gere uma para conectar a extensão do SketchUp.</p>}
    </article>
    {open && <Modal title="Gerar chave de API" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitCreate}>
      <label>Nome da chave<input name="nome" autoFocus required placeholder="SketchUp - Notebook Ana"/></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Gerando…' : 'Gerar chave'}</Button></footer>
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
      {loading ? <p className="empty-state">Carregando logs…</p> : filtered.length ? <DataTable headers={['DATA/HORA', 'USUÁRIO', 'AÇÃO', 'ENTIDADE', 'DETALHES', 'IP']} rows={filtered.map(item => [
        new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(item.created_at)),
        item.usuario_nome || 'Sistema',
        <Badge tone={acaoTone[item.acao] || 'neutral'}>{item.acao}</Badge>,
        item.entidade ? `${item.entidade}${item.entidade_id ? ` #${item.entidade_id}` : ''}` : '—',
        item.detalhes,
        item.ip || '—',
      ])}/> : <p className="empty-state">Nenhum log encontrado ainda.</p>}
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

  async function carregar() {
    setLoading(true); setError('')
    try {
      const [resumoData, receivablesData, fluxoData] = await Promise.all([
        getFinanceiroResumo(period), listLancamentos({ tipo: 'ENTRADA' }), getFluxoMensal(),
      ])
      setResumo(resumoData); setReceivables(receivablesData); setFluxo(fluxoData)
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar dados financeiros.') }
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [period])

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

  const agora = Date.now()
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
    {loading ? <p className="empty-state">Carregando dados financeiros…</p> : <>
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
        {receivables.length ? <DataTable headers={['TÍTULO', 'DESCRIÇÃO', 'SITUAÇÃO', 'VALOR', 'VENCE', 'AÇÃO']} rows={receivables.map(l => [
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
      <footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar lançamento'}</Button></footer>
    </form></Modal>}
    {feedback && <Feedback message={feedback} close={() => setFeedback('')}/>}
  </>
}

function Portal() { const [approved,setApproved]=useState(false); const [adjustOpen,setAdjustOpen]=useState(false); return <div className="portal"><header><Logo/><span>Portal de aprovações</span><b>Ana Prado <i>AP</i></b></header><main><PageHead eyebrow="PROPOSTA ORC-0413 · REV. 02" title="Cobertura Higienópolis" subtitle="Cozinha e living · entrega prevista 12/11/2026 · validade da proposta 15 dias"/><div className="portal-grid"><div><article className="card proposal"><h2>O que está incluído</h2>{proposalItems.map(x=><div key={x[0]}><b>{x[0]}</b><span>{x[1]} {x[2]}</span><em>{x[4]}</em></div>)}<footer>Total da proposta <strong>R$ 54.400</strong></footer></article><article className="card documents"><p className="mono">DOCUMENTOS DO PROJETO</p><button className="text-action">planta-cozinha.pdf ↓</button> <button className="text-action">render-living.jpg ↓</button> <button className="text-action">memorial-acabamentos.pdf ↓</button></article></div><aside><article className="card decision"><p className="mono">SUA DECISÃO</p><h2>{approved?'Proposta aprovada.':'Aprovar esta proposta?'}</h2><p>{approved?'A produção foi liberada e uma cópia da aprovação seguirá por e-mail.':'Ao aprovar, a produção entra na fila e o pagamento de entrada (40%) é liberado para emissão.'}</p><Button onClick={()=>setApproved(true)}>{approved?'Aprovada':'Aprovar proposta'}</Button><Button variant="secondary" onClick={()=>setAdjustOpen(true)}>Pedir ajuste</Button><small>Você receberá uma cópia por e-mail.</small></article><article className="card timeline"><h2>Andamento</h2>{['Proposta enviada','Revisão de acabamentos','Aprovação do cliente','Produção','Entrega e montagem'].map((x,i)=><div className={i<2||approved&&i===2?'done':i===2?'current':''} key={x}><i/><b>{x}<small>{i<2?'04/08 · 09:12':i===2?(approved?'aprovado agora':'aguardando você'):'após aprovação'}</small></b></div>)}</article><article className="help">Dúvidas antes de decidir?<small>Fale com Rafael Lima · 11 99812-4402</small></article></aside></div></main>{approved&&<div className="toast"><i/>Proposta aprovada. Produção liberada.<button aria-label="Fechar aviso" onClick={()=>setApproved(false)}>×</button></div>}{adjustOpen&&<Modal title="Pedir ajuste" close={()=>setAdjustOpen(false)}><form className="modal-form" onSubmit={e=>{e.preventDefault();setAdjustOpen(false)}}><label>O que precisa revisar?<textarea name="request" required autoFocus placeholder="Descreva o acabamento, prazo ou item…"/></label><footer><Button variant="secondary" onClick={()=>setAdjustOpen(false)}>Cancelar</Button><Button type="submit">Enviar pedido</Button></footer></form></Modal>}</div> }

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
        <footer><Button variant="secondary" onClick={close}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar instruções'}</Button></footer>
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
  const previewMode = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === '1'
  const [authenticated,setAuthenticated] = useState(sessionStorage.getItem('arc-session')==='1' || previewMode)
  const [route,setRoute] = useState<Route>(() => { const hash=location.hash.slice(1) as Route; return routes.includes(hash)?hash:'dashboard' })
  useEffect(()=>{ if(!authenticated) return; getSessionUser().catch(()=>{ /* cookie may be unavailable during static visual review */ }) },[authenticated])
  const go=(next:Route)=>{setRoute(next);location.hash=next;window.scrollTo(0,0)}
  const page=useMemo(()=>({dashboard:<Dashboard/>,clients:<Clients/>,pipeline:<Pipeline/>,builder:<Builder/>,projects:<Projects/>,catalog:<Catalog/>,inventory:<Inventory/>,suppliers:<Suppliers/>,schedule:<Schedule/>,finance:<Finance/>,team:<Team/>,integrations:<Integrations/>,logs:<Logs/>} as Partial<Record<Route, ReactNode>>)[route],[route])
  if(location.pathname==='/reset-password') return <ResetPassword/>
  if(!authenticated) return <Login onSuccess={()=>setAuthenticated(true)}/>
  if(route==='portal') return <Portal/>
  return <AppShell route={route} go={go}>{page}</AppShell>
}
