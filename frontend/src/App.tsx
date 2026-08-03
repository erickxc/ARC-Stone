import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createCatalogProduct, createClient, createQuote, createSupplier, getSessionUser, listCalendarEvents, listCatalogProducts, listClients, listInventoryProducts, listQuotes, listSuppliers, login, logout, moveInventory, regenerateQuotePdf, updateQuote, updateQuoteStatus } from './api'
import type { CalendarEvent, Client, ClientInput, Product, Quote, Supplier, SupplierInput } from './api'
import { clients, inventory, money, quotes } from './data'
import type { Status } from './data'

type Route = 'dashboard' | 'clients' | 'pipeline' | 'builder' | 'catalog' | 'inventory' | 'suppliers' | 'schedule' | 'finance' | 'team' | 'portal'
const routes: Route[] = ['dashboard', 'clients', 'pipeline', 'builder', 'catalog', 'inventory', 'suppliers', 'schedule', 'finance', 'team', 'portal']

type IconName = Exclude<Route, 'portal'> | 'menu' | 'close'
const iconPaths: Record<IconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  clients: <><circle cx="12" cy="8" r="3.25"/><path d="M5.5 21v-2.2a6.5 6.5 0 0 1 13 0V21"/></>,
  pipeline: <><path d="M4 5h5v14H4zM15 5h5v9h-5z"/><path d="M9 9h6M12 6v6"/></>,
  builder: <><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></>,
  catalog: <><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></>,
  inventory: <><path d="M3 7h18v13H3zM7 7V4h10v3"/><path d="M8 12h8"/></>,
  suppliers: <><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
  schedule: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  finance: <><path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/></>,
  team: <><circle cx="9" cy="8" r="3"/><circle cx="18" cy="9" r="2.5"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M15 15a5 5 0 0 1 6 4.9V21"/></>,
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
    ['dashboard', 'Dashboard', '', 'dashboard'], ['clients', 'Carteira de clientes', '', 'clients'], ['pipeline', 'Pipeline de vendas', '18', 'pipeline'], ['builder', 'Construtor de orçamento', '', 'builder'], ['catalog', 'Catálogo de produtos', '', 'catalog'], ['inventory', 'Controle de estoque', '7', 'inventory'], ['suppliers', 'Fornecedores', '', 'suppliers'], ['schedule', 'Calendário de entregas', '', 'schedule'], ['finance', 'Painel financeiro', '', 'finance'], ['team', 'Equipe', '', 'team'],
  ]
  const navigate = (next: Route) => { go(next); closeMobile() }
  return <><button className={`sidebar-scrim ${mobileOpen ? 'show' : ''}`} onClick={closeMobile} aria-label="Fechar menu lateral"/><aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
    <div className="side-head"><Logo compact={collapsed} /><button className="mobile-close" onClick={closeMobile} aria-label="Fechar menu"><Icon name="close"/></button><button className="collapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>«</button></div>
    <Button onClick={() => navigate('builder')}>{collapsed ? '+' : '+ Novo orçamento'}</Button>
    <nav>
      {items.map(([key, label, count, itemIcon], index) => <div key={key}>
        {!collapsed && [1, 4, 7].includes(index) && <span className="nav-label">{index === 1 ? 'VENDAS' : index === 4 ? 'GALPÃO' : 'GESTÃO'}</span>}
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
function StatusBars() { return <div className="status-bars">{statusValues.map(([s, n, w]) => <div key={s}><span>{s}</span><i><b className={s.toLowerCase()} style={{ width: `${w}%` }} /></i><em>{n}</em></div>)}</div> }

function Dashboard() {
  const [reportOpen, setReportOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  return <><PageHead eyebrow="PAINEL DE CONTROLE · ADM" title="Bom dia, Cissa." subtitle="4 entregas nesta semana · 2 orçamentos aguardando sua aprovação." actions={<><Button variant="secondary" onClick={() => setReportOpen(true)}>Relatório mensal</Button><Button onClick={() => { location.hash = 'builder'; location.reload() }}>Novo orçamento</Button></>} />
    <section className="kpi-grid"><Kpi label="ORÇAMENTOS GLOBAIS" value="128" note="+12 esta semana" /><Kpi label="CLIENTES NA BASE" value="64" note="3 cadastros rápidos" /><Kpi label="ITENS NO GALPÃO" value="412" note="7 abaixo do mínimo" /><Kpi dark label="EM APROVAÇÃO" value="R$ 1,4M" note="18 propostas abertas" /></section>
    <section className="dashboard-grid"><article className="card span-two"><div className="card-title"><h2>Orçamentos por status</h2><span className="mono">FUNIL · 30 DIAS</span></div><StatusBars /></article>
      <article className="card"><h2>Próximos eventos</h2><ul className="events"><li><i className="danger" />Entrega · Casa Ibiúna <b>hoje</b></li><li><i className="warning" />Faturamento · Apto Vila Madalena <b>2 dias</b></li><li><i className="success" />Medição · Escritório Faria Lima <b>6 dias</b></li><li><i className="success" />Entrega · Loja Pinheiros <b>11 dias</b></li></ul></article>
      <article className="card team"><h2>Equipe comercial</h2>{[['R','Rafael Lima','68'],['C','Camila Reis','51'],['J','Júlia Antunes','36']].map(x => <div key={x[0]}><span>{x[0]}</span><p>{x[1]}<i><b style={{width:`${x[2]}%`}} /></i></p><em>R$ {x[2]}0k</em></div>)}</article>
      <article className="card calendar"><div className="card-title"><h2>Visão da semana</h2><span className="mono">01 — 07 DE AGOSTO</span></div><div className="week">{['SEG 01','TER 02','HOJE 03','QUI 04','SEX 05','SÁB 06','DOM 07'].map((d,i)=><div className={i===2?'today':''} key={d}><span>{d}</span>{i===1&&<b className="sage">Medição · Ibiúna</b>}{i===2&&<><b>Entrega ORC-0409</b><b>Reunião Ventura</b></>}{i===4&&<b className="gold">Faturar ORC-0412</b>}</div>)}</div></article>
    </section>{reportOpen&&<Modal title="Relatório mensal" close={()=>setReportOpen(false)}><div className="modal-form"><p>Resumo de agosto pronto para exportação.</p><ul className="modal-summary"><li>128 orçamentos globais</li><li>4 entregas nesta semana</li><li>R$ 1,4M em aprovação</li></ul><footer><Button variant="secondary" onClick={()=>setReportOpen(false)}>Fechar</Button><Button onClick={()=>{setFeedback('Relatório preparado para download.');setReportOpen(false)}}>Exportar relatório</Button></footer></div></Modal>}{feedback&&<Feedback message={feedback} close={()=>setFeedback('')}/>}</>
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

  useEffect(() => {
    let mounted = true
    listQuotes().then(data => { if (mounted) setRemoteQuotes(data) }).catch(err => { if (mounted) setQuoteError(err instanceof Error ? err.message : 'Kanban offline; exibindo dados locais.') }).finally(() => { if (mounted) setLoading(false) })
    listClients().then(data => { if (mounted) setQuoteClients(data) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

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
  async function moveQuote(card: KanbanQuote, status: Status) {
    if (!card.backendId) { setFeedback('Dados locais não podem alterar status antes da sincronização.'); return }
    try { await updateQuoteStatus(card.backendId, backendStatusByColumn[status]); setRemoteQuotes(current => (current || []).map(item => item.id === card.backendId ? { ...item, status: backendStatusByColumn[status] } : item)); setFeedback(`${card.id} movido para ${status}.`) }
    catch (err) { setQuoteError(err instanceof Error ? err.message : 'Falha ao atualizar status.') }
  }
  return <><PageHead eyebrow="VENDAS · PIPELINE" title={view==='Kanban'?'Kanban dos orçamentos':'Lista de orçamentos'} subtitle={`${remoteQuotes === null ? 'visão local' : `${remoteQuotes.length} orçamentos do backend`} · ${loading ? 'sincronizando…' : 'sincronizado'}`} actions={<><input className="search" placeholder="Buscar projeto ou cliente…" value={query} onChange={e=>setQuery(e.target.value)} /><Button variant="secondary" onClick={()=>setFeedback('Filtro de vendedor será ligado ao endpoint de equipe.')}>Vendedor⌄</Button><div className="segmented"><button className={view==='Lista'?'active':''} onClick={()=>setView('Lista')}>Lista</button><button className={view==='Kanban'?'active':''} onClick={()=>setView('Kanban')}>Kanban</button></div><Button onClick={()=>setOpen(true)}>+ Orçamento</Button></>} />{quoteError&&<p className="form-error" role="alert">{quoteError}</p>}
    {view==='Kanban'?<div className="kanban">{statusValues.map(([status, fallbackTotal]) => { const columnCards = filtered.filter(q=>q.status===status); return <section className={`kanban-col ${status.toLowerCase()}`} key={status}><header><h2><i />{status}</h2><Badge>{remoteQuotes === null ? fallbackTotal : columnCards.length}</Badge><p className="mono">{money(columnCards.reduce((total, card) => total + card.value, 0))}</p></header>{columnCards.map(card=><article className="quote-card" key={card.id}><div><span className="mono">{card.id}</span><b>{money(card.value)}</b></div><h3>{card.project}</h3><p>{card.client}</p><footer><span>{card.owner}</span><em>{card.date}</em></footer>{remoteQuotes!==null&&card.backendId&&<select aria-label={`Status de ${card.id}`} value={card.status} onChange={event=>moveQuote(card,event.target.value as Status)}>{statusValues.map(([option])=><option key={option} value={option}>{option}</option>)}</select>}</article>)}{status==='Gerando'&&<button className="add-card" onClick={()=>setOpen(true)}>+ Adicionar</button>}</section>})}</div>:<article className="card list-card"><DataTable headers={['ORÇAMENTO','PROJETO','CLIENTE','STATUS','VALOR']} rows={filtered.map(q=>[<span className="mono">{q.id}</span>,<b>{q.project}</b>,q.client,<Badge>{q.status}</Badge>,money(q.value)])}/></article>}{open&&<Modal title="Novo orçamento" close={()=>setOpen(false)}><form className="modal-form" onSubmit={submitQuote}><label>Cliente<select name="cliente_id" required autoFocus defaultValue=""><option value="" disabled>Selecione um cliente…</option>{quoteClients.map(client=><option key={client.id} value={client.id}>{client.nome_fantasia}</option>)}</select></label><label>Tipo de orçamento<select name="tipo_orcamento" defaultValue="Venda"><option>Venda</option><option>Locacao</option><option>Producao</option></select></label>{quoteError&&<p className="form-error" role="alert">{quoteError}</p>}<footer><Button variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving?'Salvando…':'Criar orçamento'}</Button></footer></form></Modal>}{feedback&&<Feedback message={feedback} close={()=>setFeedback('')}/>}</>
}

const proposalItems = [['Marcenaria cozinha — MDF carvalho','12,40','m²','2.180','27.032'],['Bancada quartzo branco absoluto','4,10','m²','1.640','6.724'],['Painel ripado living — freijó','8,60','m²','1.290','11.094'],['Iluminação embutida — perfil linear','14','un','340','4.760'],['Instalação e montagem','3','diária','980','2.940'],['Frete e içamento','1','un','1.850','1.850']]
export function LegacyBuilder() { const [items,setItems]=useState(proposalItems); const [feedback,setFeedback]=useState(''); return <><PageHead eyebrow="ORC-0413 · RASCUNHO" title="Cobertura Higienópolis — marcenaria" actions={<><Badge>Gerando</Badge><Button variant="secondary" onClick={()=>setFeedback('Rascunho salvo localmente.')}>Salvar rascunho</Button><Button onClick={()=>setFeedback('PDF preparado para envio ao cliente.')}>Gerar PDF e enviar</Button></>} />
  <div className="builder"><div><article className="card fields"><label>Cliente<input value="Ana Prado" readOnly /></label><label>Ambiente<input value="Cozinha + living" readOnly /></label><label>Entrega prevista<input value="12/11/2026" readOnly /></label></article><article className="card items"><div className="card-title"><h2>Itens <small>· {items.length}</small></h2><span><Button variant="secondary" onClick={()=>location.hash='catalog'}>Do catálogo</Button> <Button variant="dark" onClick={()=>setFeedback('Item livre adicionado ao rascunho.')}>+ Item livre</Button></span></div><div className="item-head mono"><span>DESCRIÇÃO</span><span>QTD / M²</span><span>UN.</span><span>UNITÁRIO</span><span>TOTAL</span></div>{items.map((x,i)=><div className={`item-row ${i===items.length-1?'editing':''}`} key={x[0]}><div><b>{x[0]}</b><small>CAT-{2210+i} · especificação do projeto</small></div>{x.slice(1).map((v,j)=><span key={`${j}-${v}`}>{v}</span>)}<button aria-label={`Remover ${x[0]}`} onClick={()=>setItems(current=>current.filter(item=>item!==x))}>×</button></div>)}</article></div>
  <aside><article className="card total-card"><p className="mono">TOTAL DA PROPOSTA</p><strong>R$ 54.400</strong><dl><dt>Materiais</dt><dd>44.850</dd><dt>Serviços</dt><dd>2.940</dd><dt>Logística</dt><dd>1.850</dd><dt>Margem aplicada</dt><dd>28%</dd></dl></article><article className="card conditions"><h2>Condições</h2><label>Pagamento<input value="40% entrada + 3x" readOnly /></label><label>Validade da proposta<input value="15 dias" readOnly /></label><p>✓ Liberar no portal do cliente</p></article><article className="card attachments"><p className="mono">ANEXOS</p><button className="text-action" onClick={()=>setFeedback('Seletor de anexos disponível quando o upload estiver ligado.')}>+ Adicionar arquivo</button><span>planta-cozinha.pdf</span><span>render-1living.jpg</span></article></aside></div>{feedback&&<Feedback message={feedback} close={()=>setFeedback('')}/>}</> }

type BuilderItem = { key: string; productId: number | null; name: string; quantity: number; unit: string; unitPrice: number; isExternal: boolean }

function Builder() {
  const [clientsList, setClientsList] = useState<Client[]>([])
  const [productsList, setProductsList] = useState<Product[]>([])
  const [selectedClient, setSelectedClient] = useState<number | ''>('')
  const [quoteType, setQuoteType] = useState<'Venda'|'Locacao'|'Producao'>('Venda')
  const [payment, setPayment] = useState('40% entrada + 3x')
  const [items, setItems] = useState<BuilderItem[]>([])
  const [quoteId, setQuoteId] = useState<number | null>(null)
  const [itemModal, setItemModal] = useState<'catalog'|'free'|null>(null)
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
      setItems(productData.slice(0, 3).map((product, index) => ({ key: `product-${product.id}-${index}`, productId: product.id, name: product.nome, quantity: 1, unit: 'un.', unitPrice: product.preco_venda, isExternal: false })))
    }).catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar dados do orçamento.') }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const selectedClientName = clientsList.find(client => client.id === selectedClient)?.nome_fantasia || 'Cliente não selecionado'
  const payload = () => ({ cliente_id: Number(selectedClient), tipo_orcamento: quoteType, condicoes_pagamento_selecionadas: payment, itens: items.map(item => item.isExternal ? { quantidade: item.quantity, preco_unitario_aplicado: item.unitPrice, is_externo: true, nome_externo: item.name, descricao_externa: 'Item livre do construtor' } : { quantidade: item.quantity, preco_unitario_aplicado: item.unitPrice, produto_id: item.productId }) })

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
    setItems(current => [...current, { key: `product-${product.id}-${Date.now()}`, productId: product.id, name: product.nome, quantity: Number(form.get('quantidade') || 1), unit: 'un.', unitPrice: product.preco_venda, isExternal: false }]); setItemModal(null)
  }

  function addFreeItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setItems(current => [...current, { key: `free-${Date.now()}`, productId: null, name: String(form.get('nome') || 'Item livre'), quantity: Number(form.get('quantidade') || 1), unit: String(form.get('unidade') || 'un.'), unitPrice: Math.round(Number(form.get('preco') || 0) * 100), isExternal: true }]); setItemModal(null)
  }

  return <><PageHead eyebrow={quoteId ? `ORC-${String(quoteId).padStart(4, '0')} · RASCUNHO` : 'NOVO ORÇAMENTO · RASCUNHO'} title={`${selectedClientName} — orçamento`} actions={<><Badge>Gerando</Badge><Button variant="secondary" onClick={() => saveQuote()} disabled={saving}>{saving ? 'Salvando…' : 'Salvar rascunho'}</Button><Button onClick={regeneratePdf}>Gerar PDF e enviar</Button></>} />{error && <p className="form-error" role="alert">{error}</p>}{loading ? <article className="card empty-state"><h2>Carregando clientes e catálogo…</h2></article> : <form onSubmit={saveQuote}><div className="builder"><div><article className="card fields"><label>Cliente<select value={selectedClient} onChange={event => setSelectedClient(Number(event.target.value) || '')} required><option value="" disabled>Selecione um cliente…</option>{clientsList.map(client => <option key={client.id} value={client.id}>{client.nome_fantasia}</option>)}</select></label><label>Tipo de orçamento<select value={quoteType} onChange={event => setQuoteType(event.target.value as 'Venda'|'Locacao'|'Producao')}><option>Venda</option><option>Locacao</option><option>Producao</option></select></label><label>Pagamento<input value={payment} onChange={event => setPayment(event.target.value)} placeholder="40% entrada + 3x…"/></label></article><article className="card items"><div className="card-title"><h2>Itens <small>· {items.length}</small></h2><span><Button type="button" variant="secondary" onClick={() => setItemModal('catalog')}>Do catálogo</Button> <Button type="button" variant="dark" onClick={() => setItemModal('free')}>+ Item livre</Button></span></div><div className="item-head mono"><span>DESCRIÇÃO</span><span>QTD / M²</span><span>UN.</span><span>UNITÁRIO</span><span>TOTAL</span></div>{items.map((item, index) => <div className={`item-row ${index === items.length - 1 ? 'editing' : ''}`} key={item.key}><div><b>{item.name}</b><small>{item.isExternal ? 'ITEM LIVRE · especificação do projeto' : `CAT-${String(item.productId).padStart(4, '0')} · catálogo`}</small></div><span>{item.quantity}</span><span>{item.unit}</span><span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unitPrice / 100)}</span><span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.quantity * item.unitPrice / 100)}</span><button type="button" aria-label={`Remover ${item.name}`} onClick={() => setItems(current => current.filter(currentItem => currentItem.key !== item.key))}>×</button></div>)}{!items.length && <p className="empty-state">Nenhum item adicionado ainda.</p>}</article></div><aside><article className="card total-card"><p className="mono">TOTAL DA PROPOSTA</p><strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total / 100)}</strong><dl><dt>Itens</dt><dd>{items.length}</dd><dt>Cliente</dt><dd>{selectedClientName}</dd><dt>Tipo</dt><dd>{quoteType}</dd></dl></article><article className="card attachments"><p className="mono">ANEXOS</p><span>PDF gerado automaticamente ao salvar</span></article></aside></div></form>}{itemModal === 'catalog' && <Modal title="Adicionar do catálogo" close={() => setItemModal(null)}><form className="modal-form" onSubmit={addCatalogItem}><label>Produto<select name="produto_id" required autoFocus defaultValue=""><option value="" disabled>Selecione um produto…</option>{productsList.map(product => <option key={product.id} value={product.id}>{product.nome}</option>)}</select></label><label>Quantidade<input name="quantidade" type="number" min="1" step="1" defaultValue="1" required/></label><footer><Button variant="secondary" onClick={() => setItemModal(null)}>Cancelar</Button><Button type="submit">Adicionar item</Button></footer></form></Modal>}{itemModal === 'free' && <Modal title="Adicionar item livre" close={() => setItemModal(null)}><form className="modal-form" onSubmit={addFreeItem}><label>Descrição<input name="nome" required autoFocus placeholder="Bancada especial…"/></label><label>Quantidade<input name="quantidade" type="number" min="1" step="1" defaultValue="1" required/></label><label>Unidade<input name="unidade" defaultValue="un." required/></label><label>Preço unitário<input name="preco" type="number" min="0" step="0.01" required placeholder="0,00"/></label><footer><Button variant="secondary" onClick={() => setItemModal(null)}>Cancelar</Button><Button type="submit">Adicionar item</Button></footer></form></Modal>}{feedback && <Feedback message={feedback} close={() => setFeedback('')}/>}</>
}

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) { return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table><footer>Exibindo {rows.length} registros <span>‹ <b>1</b> 2 ›</span></footer></div> }

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={close}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={e=>e.stopPropagation()}><header><h2 id="modal-title">{title}</h2><button aria-label="Fechar" onClick={close}>×</button></header>{children}</section></div> }

function Feedback({ message, close }: { message: string; close: () => void }) {
  return <div className="toast" role="status" aria-live="polite"><i />{message}<button aria-label="Fechar aviso" onClick={close}>×</button></div>
}

export function LegacyClients() { const [open,setOpen]=useState(false); return <><PageHead eyebrow="VENDAS · CARTEIRA" title="Carteira de clientes" subtitle="64 cadastros · 9 com proposta aberta nesta semana" actions={<><input className="search" placeholder="Buscar nome, CNPJ ou cidade..."/><Button variant="secondary">Importar CSV</Button><Button onClick={()=>setOpen(true)}>+ Novo cliente</Button></>} /><section className="kpi-grid"><Kpi label="CLIENTES ATIVOS" value="48" note="12 recorrentes"/><Kpi label="SEM CONTATO HÁ 60D" value="11" note="revisar follow-up"/><Kpi label="TICKET MÉDIO" value="R$ 184k" note="+9% no trimestre"/><Kpi dark label="CARTEIRA TOTAL" value="R$ 8,7M" note="valor histórico fechado"/></section><article className="card list-card"><div className="card-title"><h2>Clientes</h2><span><Button variant="secondary">Tipo⌄</Button> <Button variant="secondary">Cidade⌄</Button></span></div><DataTable headers={['CLIENTE','CONTATO','TIPO','EM ABERTO','ÚLTIMO CONTATO']} rows={clients.map((x,i)=>[<div className="person"><span>{x[0].split(' ').map(s=>s[0]).slice(0,2).join('')}</span><b>{x[0]}<small>{i%2?'CNPJ 44.109.882/0001-0':'CNPJ 12.884.201/0001-4'}</small></b></div>,x[1],<Badge tone={i%3===0?'info':i%3===1?'warning':'neutral'}>{x[2]}</Badge>,x[3],x[4]])}/></article>{open&&<Modal title="Novo cliente" close={()=>setOpen(false)}><form className="modal-form" onSubmit={e=>{e.preventDefault();setOpen(false)}}><label>Nome ou razão social<input autoFocus required placeholder="Studio Aroeira"/></label><label>CPF / CNPJ<input placeholder="12.345.678/0001-90"/></label><label>E-mail<input type="email" placeholder="contato@studio.com.br"/></label><label>Telefone<input placeholder="(11) 99999-9999"/></label><footer><Button variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit">Salvar cliente</Button></footer></form></Modal>}</> }

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
  return <><PageHead eyebrow="VENDAS · CARTEIRA" title="Carteira de clientes" subtitle={`${items.length} clientes carregados do backend`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar nome, CPF/CNPJ ou contato..."/><Button onClick={() => setOpen(true)}>+ Novo cliente</Button></>}/>{error && <p className="form-error" role="alert">{error}</p>}<section className="kpi-grid"><Kpi label="CLIENTES ATIVOS" value={String(items.filter(item => item.status === 'ativo').length)} note="vindos da API"/><Kpi label="RESULTADOS" value={String(filtered.length)} note="filtro atual"/><Kpi label="COM CONTATO" value={String(items.filter(item => item.email || item.contato).length)} note="e-mail ou telefone"/><Kpi dark label="STATUS" value={loading ? '...' : 'OK'} note="sincronização concluída"/></section><article className="card list-card"><div className="card-title"><h2>Clientes</h2><Badge>{filtered.length} resultados</Badge></div>{loading ? <p className="empty-state">Carregando clientes…</p> : <DataTable headers={['CLIENTE','CONTATO','DOCUMENTO','STATUS','ENDEREÇO']} rows={filtered.map(item => [<div className="person"><span>{item.nome_fantasia.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><b>{item.nome_fantasia}<small>{item.nome_responsavel || item.cpf_cnpj || 'Sem documento'}</small></b></div>, item.email || item.contato || 'Sem contato', item.cpf_cnpj || 'Não informado', <Badge tone={item.status === 'ativo' ? 'success' : 'warning'}>{item.status || 'indefinido'}</Badge>, item.endereco_entrega || 'Não informado'])}/>}</article>{open && <Modal title="Novo cliente" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitClient}><label>Nome ou razão social<input name="nome_fantasia" autoFocus required placeholder="Studio Aroeira"/></label><label>CPF / CNPJ<input name="cpf_cnpj" placeholder="12.345.678/0001-90"/></label><label>Responsável<input name="nome_responsavel" placeholder="Ana Prado"/></label><label>E-mail<input name="email" type="email" placeholder="contato@studio.com.br"/></label><label>Telefone<input name="contato" placeholder="(11) 99999-9999"/></label><label>Endereço de entrega<input name="endereco_entrega" placeholder="Rua, número, cidade/UF"/></label><footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar cliente'}</Button></footer></form></Modal>}</>
}

export function LegacyInventory() { return <><PageHead eyebrow="GALPÃO · ESTOQUE" title="Controle de estoque" subtitle="412 itens · 7 abaixo do mínimo · 2 pedidos em trânsito" actions={<><input className="search" placeholder="Buscar código ou material..."/><Button variant="secondary">Movimentações</Button><Button>+ Entrada</Button></>} /><section className="kpi-grid"><Kpi label="ITENS EM ESTOQUE" value="412" note="em 6 categorias"/><Kpi label="ABAIXO DO MÍNIMO" value="7" note="repor esta semana"/><Kpi label="EM TRÂNSITO" value="2" note="chegam 09/08"/><Kpi dark label="VALOR IMOBILIZADO" value="R$ 386k" note="custo de reposição"/></section><article className="card list-card"><div className="card-title"><h2>Itens</h2><span className="danger-text">Só críticos</span></div><DataTable headers={['CÓDIGO','MATERIAL','CATEGORIA','SALDO','MÍNIMO','SITUAÇÃO']} rows={inventory.map(x=>[<span className="mono">{x[0]}</span>,<b>{x[1]}</b>,x[2],x[3],x[4],<Badge tone={x[5]==='Crítico'?'danger':x[5]==='Atenção'?'warning':'success'}>{x[5]}</Badge>])}/></article><section className="bottom-grid"><article className="card"><h2>Consumo por categoria · 30 dias</h2><StatusBars/></article><article className="card restock"><h2>Reposição sugerida</h2><p>MDF carvalho 18mm <b>+ 8 ch.</b></p><p>Corrediça soft-close <b>+ 24 par</b></p><p>Ripa freijó 20mm <b>+ 6 barras</b></p><Button>Gerar pedido de compra</Button></article></section></> }

function Inventory() {
  const [items, setItems] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { let mounted = true; listInventoryProducts().then(data => { if (mounted) setItems(data) }).catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar estoque.') }).finally(() => { if (mounted) setLoading(false) }); return () => { mounted = false } }, [])
  const filtered = items.filter(item => `${item.id} ${item.nome} ${item.tipo || ''} ${item.material || ''}`.toLowerCase().includes(query.toLowerCase()))
  async function submitMovement(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!open) return; setSaving(true); setError(''); const form = new FormData(event.currentTarget); try { const result = await moveInventory(open.id, { quantidade: Number(form.get('quantidade') || 0), justificativa: String(form.get('justificativa') || '') }); setItems(current => current.map(item => item.id === open.id ? { ...item, quantidade_estoque: result.novo_estoque } : item)); setOpen(null) } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao movimentar estoque.') } finally { setSaving(false) } }
  const critical = items.filter(item => item.quantidade_estoque <= item.estoque_minimo).length
  return <><PageHead eyebrow="GALPÃO · ESTOQUE" title="Controle de estoque" subtitle={`${items.length} itens sincronizados com o backend`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar código ou material..."/></>}/>{error && <p className="form-error" role="alert">{error}</p>}<section className="kpi-grid"><Kpi label="ITENS EM ESTOQUE" value={String(items.length)} note="ativos na API"/><Kpi label="ABAIXO DO MÍNIMO" value={String(critical)} note="repor esta semana"/><Kpi label="UNIDADES" value={String(items.reduce((total, item) => total + item.quantidade_estoque, 0))} note="saldo atual"/><Kpi dark label="STATUS" value={loading ? '...' : 'OK'} note="sincronização concluída"/></section><article className="card list-card"><div className="card-title"><h2>Itens</h2><Badge>{filtered.length} resultados</Badge></div>{loading ? <p className="empty-state">Carregando estoque…</p> : <DataTable headers={['CÓDIGO','MATERIAL','CATEGORIA','SALDO','MÍNIMO','SITUAÇÃO','AÇÃO']} rows={filtered.map(item => { const low = item.quantidade_estoque <= item.estoque_minimo; return [<span className="mono">CAT-{String(item.id).padStart(4, '0')}</span>, <b>{item.nome}</b>, item.material || 'Sem material', item.quantidade_estoque, item.estoque_minimo, <Badge tone={low ? 'danger' : 'success'}>{low ? 'Crítico' : 'Normal'}</Badge>, <Button variant="secondary" onClick={() => setOpen(item)}>Movimentar</Button>] })}/>}</article>{open && <Modal title={`Movimentar · ${open.nome}`} close={() => setOpen(null)}><form className="modal-form" onSubmit={submitMovement}><label>Quantidade<input name="quantidade" type="number" min="1" step="1" required autoFocus placeholder="1"/></label><label>Justificativa<textarea name="justificativa" required placeholder="Reposição recebida, ajuste ou baixa operacional"/></label>{error && <p className="form-error" role="alert">{error}</p>}<footer><Button variant="secondary" onClick={() => setOpen(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Registrar movimentação'}</Button></footer></form></Modal>}</>
}

const catalogItems = [
  ['CAT-1189','MDF Carvalho Natural','Painéis','Duratex','R$ 2.180 / m²','Disponível'],
  ['CAT-0442','Quartzo Branco Absoluto','Bancadas','Pedra Nobre','R$ 1.640 / m²','Sob consulta'],
  ['CAT-0771','Ripa Freijó 20mm','Painéis','Madeiras Sul','R$ 1.290 / m²','Disponível'],
  ['CAT-2210','Perfil Linear LED 2700K','Iluminação','Lumini','R$ 340 / un','Disponível'],
  ['CAT-0318','Corrediça Soft-close 500mm','Ferragens','Hettich','R$ 189 / par','Baixo estoque'],
  ['CAT-0904','Fita de Borda ABS Carvalho','Acabamento','Proadec','R$ 86 / rolo','Disponível'],
]

export function LegacyCatalog() {
  const [query,setQuery]=useState(''); const [category,setCategory]=useState('Todos'); const [open,setOpen]=useState(false)
  const filtered=catalogItems.filter(x=>(category==='Todos'||x[2]===category)&&`${x[0]} ${x[1]} ${x[3]}`.toLowerCase().includes(query.toLowerCase()))
  return <><PageHead eyebrow="GALPÃO · CATÁLOGO" title="Catálogo de produtos" subtitle="Materiais aprovados para uso nos orçamentos" actions={<><input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produto, código ou fornecedor..."/><Button onClick={()=>setOpen(true)}>+ Produto</Button></>}/><div className="filter-row" role="group" aria-label="Filtrar categoria">{['Todos','Painéis','Bancadas','Ferragens','Iluminação','Acabamento'].map(x=><button key={x} className={category===x?'active':''} onClick={()=>setCategory(x)}>{x}</button>)}</div><section className="product-grid">{filtered.map(x=><article className="card product-card" key={x[0]}><div className={`material-swatch swatch-${catalogItems.indexOf(x)+1}`}><span>{x[2]}</span></div><div className="product-copy"><p className="mono">{x[0]}</p><h2>{x[1]}</h2><small>{x[3]}</small><footer><b>{x[4]}</b><Badge tone={x[5]==='Disponível'?'success':x[5]==='Baixo estoque'?'warning':'neutral'}>{x[5]}</Badge></footer></div></article>)}</section>{!filtered.length&&<article className="card empty-state"><Logo compact/><h2>Nenhum produto encontrado</h2><p>Ajuste busca ou escolha outra categoria.</p></article>}{open&&<Modal title="Novo produto" close={()=>setOpen(false)}><form className="modal-form" onSubmit={e=>{e.preventDefault();setOpen(false)}}><label>Nome<input autoFocus required placeholder="MDF Carvalho Natural"/></label><label>Categoria<select required><option>Painéis</option><option>Ferragens</option><option>Iluminação</option></select></label><label>Fornecedor<input placeholder="Duratex"/></label><label>Preço de referência<input placeholder="R$ 0,00"/></label><footer><Button variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit">Salvar produto</Button></footer></form></Modal>}</>
}

function Catalog() {
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todos')
  const [open, setOpen] = useState(false)
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

  return <><PageHead eyebrow="GALPÃO · CATÁLOGO" title="Catálogo de produtos" subtitle={`${products.length} materiais vindos do estoque`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar produto, código ou material..."/><Button onClick={() => setOpen(true)}>+ Produto</Button></>}/>{error&&<p className="form-error" role="alert">{error}</p>}<div className="filter-row" role="group" aria-label="Filtrar categoria">{categories.map(item => <button key={item} className={category===item?'active':''} onClick={() => setCategory(item)}>{item}</button>)}</div>{loading?<article className="card empty-state"><h2>Carregando catálogo…</h2></article>:<section className="product-grid">{filtered.map((product,index) => { const low = product.quantidade_estoque <= product.estoque_minimo; return <article className="card product-card" key={product.id}><div className={`material-swatch swatch-${index%6+1}`}><span>{product.tipo || 'Material'}</span></div><div className="product-copy"><p className="mono">CAT-{String(product.id).padStart(4,'0')}</p><h2>{product.nome}</h2><small>{product.material || 'Sem material informado'}</small><footer><b>{new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(product.preco_venda/100)}</b><Badge tone={low?'warning':'success'}>{low?'Baixo estoque':'Disponível'}</Badge></footer></div></article> })}</section>}{!loading&&!filtered.length&&<article className="card empty-state"><Logo compact/><h2>Nenhum produto encontrado</h2><p>Ajuste busca ou escolha outra categoria.</p></article>}{open&&<Modal title="Novo produto" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitProduct}><label>Nome<input name="nome" autoFocus required placeholder="MDF Carvalho Natural"/></label><label>Categoria<input name="tipo" required placeholder="Painéis"/></label><label>Material<input name="material" placeholder="Carvalho natural"/></label><label>Preço de venda<input name="preco_venda" type="number" min="0" step="0.01" required placeholder="0,00"/></label>{error&&<p className="form-error" role="alert">{error}</p>}<footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving?'Salvando…':'Salvar produto'}</Button></footer></form></Modal>}</>
}

const supplierRows = [
  ['Duratex','Painéis e MDF','Marina Lopes','(11) 3442-8801','12 itens','Ativo'],
  ['Hettich Brasil','Ferragens','Paulo Nunes','(11) 3095-1020','8 itens','Ativo'],
  ['Pedra Nobre','Bancadas','Ana França','(11) 4812-7740','4 itens','Ativo'],
  ['Lumini','Iluminação','Bruno Sá','(11) 3081-9912','14 itens','Revisar'],
  ['Madeiras Sul','Madeiras','Carla Mota','(41) 3320-4882','6 itens','Ativo'],
]

export function LegacySuppliers() {
  const [query,setQuery]=useState(''); const [open,setOpen]=useState(false)
  const rows=supplierRows.filter(x=>x.join(' ').toLowerCase().includes(query.toLowerCase()))
  return <><PageHead eyebrow="GALPÃO · PARCEIROS" title="Fornecedores" subtitle="28 fornecedores homologados · 3 cotações em andamento" actions={<><input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar fornecedor ou categoria..."/><Button onClick={()=>setOpen(true)}>+ Fornecedor</Button></>}/><section className="kpi-grid compact-kpis"><Kpi label="FORNECEDORES ATIVOS" value="28" note="6 categorias"/><Kpi label="COTAÇÕES ABERTAS" value="3" note="retorno até sexta"/><Kpi label="PRAZO MÉDIO" value="12 dias" note="-2 dias no trimestre"/><Kpi dark label="COMPRAS NO MÊS" value="R$ 211k" note="42 pedidos emitidos"/></section><article className="card list-card"><div className="card-title"><h2>Base de fornecedores</h2><Badge>{rows.length} resultados</Badge></div><DataTable headers={['FORNECEDOR','CATEGORIA','CONTATO','TELEFONE','CATÁLOGO','STATUS']} rows={rows.map(x=>[<b>{x[0]}</b>,x[1],x[2],x[3],x[4],<Badge tone={x[5]==='Ativo'?'success':'warning'}>{x[5]}</Badge>])}/></article>{open&&<Modal title="Novo fornecedor" close={()=>setOpen(false)}><form className="modal-form" onSubmit={e=>{e.preventDefault();setOpen(false)}}><label>Razão social<input autoFocus required/></label><label>CNPJ<input placeholder="00.000.000/0001-00"/></label><label>Contato<input/></label><label>E-mail<input type="email"/></label><footer><Button variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit">Salvar fornecedor</Button></footer></form></Modal>}</>
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
  return <><PageHead eyebrow="GALPÃO · PARCEIROS" title="Fornecedores" subtitle={`${items.length} fornecedores ativos carregados do backend`} actions={<><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar fornecedor, CNPJ ou contato..."/><Button onClick={() => setOpen(true)}>+ Fornecedor</Button></>}/>{error && <p className="form-error" role="alert">{error}</p>}<section className="kpi-grid compact-kpis"><Kpi label="FORNECEDORES ATIVOS" value={String(items.filter(item => item.ativo !== false).length)} note="sincronizados"/><Kpi label="RESULTADOS" value={String(filtered.length)} note="filtro atual"/><Kpi label="COM E-MAIL" value={String(items.filter(item => item.email).length)} note="contato digital"/><Kpi dark label="STATUS" value={loading ? '...' : 'OK'} note="sincronização concluída"/></section><article className="card list-card"><div className="card-title"><h2>Base de fornecedores</h2><Badge>{filtered.length} resultados</Badge></div>{loading ? <p className="empty-state">Carregando fornecedores…</p> : <DataTable headers={['FORNECEDOR','CONTATO','DOCUMENTO','TELEFONE','STATUS']} rows={filtered.map(item => [<b>{item.nome_fantasia}</b>, item.contato || item.email || 'Sem contato', item.cnpj || 'Não informado', item.telefone || 'Não informado', <Badge tone={item.ativo === false ? 'warning' : 'success'}>{item.ativo === false ? 'Inativo' : item.status || 'Ativo'}</Badge>])}/>}</article>{open && <Modal title="Novo fornecedor" close={() => setOpen(false)}><form className="modal-form" onSubmit={submitSupplier}><label>Razão social<input name="nome_fantasia" autoFocus required placeholder="Duratex"/></label><label>CNPJ<input name="cnpj" placeholder="00.000.000/0001-00"/></label><label>Contato<input name="contato" placeholder="Marina Lopes"/></label><label>E-mail<input name="email" type="email" placeholder="contato@fornecedor.com.br"/></label><label>Telefone<input name="telefone" placeholder="(11) 3442-8801"/></label><label>Endereço<input name="endereco" placeholder="Rua, número, cidade/UF"/></label><label>Observações<textarea name="observacoes" placeholder="Condições comerciais, prazo e homologação"/></label><footer><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar fornecedor'}</Button></footer></form></Modal>}</>
}

const deliveryEvents: Record<number, [string,string,string][]> = { 3:[['Entrega','Casa Ibiúna','09:00'],['Reunião','Incorporadora Ventura','14:30']], 8:[['Medição','Escritório Faria Lima','10:00']], 12:[['Faturamento','Apto Vila Madalena','08:30']], 17:[['Retirada','MDF · Duratex','16:00']], 24:[['Entrega','Loja Pinheiros','11:00']], 29:[['Montagem','Hotel Santa Cecília','07:30']] }
function Schedule() {
  const [selected,setSelected]=useState(3); const [view,setView]=useState<'Mês'|'Semana'>('Mês'); const [events,setEvents]=useState<CalendarEvent[]>([]); const [error,setError]=useState(''); const [eventOpen,setEventOpen]=useState(false); const [feedback,setFeedback]=useState(''); const days=Array.from({length:31},(_,i)=>i+1)
  useEffect(() => { listCalendarEvents().then(setEvents).catch(err => setError(err instanceof Error ? err.message : 'Agenda offline. Exibindo visão local.')) }, [])
  const apiEvents: Record<number, [string,string,string][]> = {}
  events.forEach(event => { const date = new Date(event.start); if (date.getFullYear() === 2026 && date.getMonth() === 7) { const day = date.getDate(); (apiEvents[day] ||= []).push([event.tipo, event.cliente_nome, date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})]) } })
  const calendarEvents = Object.keys(apiEvents).length ? apiEvents : deliveryEvents
  return <><PageHead eyebrow="GESTÃO · AGENDA" title="Calendário de entregas" subtitle={`${Object.values(calendarEvents).flat().length} eventos · fonte ${events.length ? 'backend' : 'local'}`} actions={<><div className="segmented"><button className={view==='Mês'?'active':''} onClick={()=>setView('Mês')}>Mês</button><button className={view==='Semana'?'active':''} onClick={()=>setView('Semana')}>Semana</button></div><Button onClick={()=>setEventOpen(true)}>+ Evento</Button></>}/>{error&&<p className="form-error" role="status">{error}</p>}<section className="schedule-layout"><article className="card month-card"><header><button aria-label="Mês anterior" onClick={()=>setFeedback('Navegação de meses será ligada ao filtro da API.')}>‹</button><h2>Agosto <span>2026</span></h2><button aria-label="Próximo mês" onClick={()=>setFeedback('Navegação de meses será ligada ao filtro da API.')}>›</button></header><div className="calendar-weekdays">{['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map(x=><span key={x}>{x}</span>)}</div><div className={`month-grid ${view==='Semana'?'week-view':''}`}>{days.map(day=><button key={day} className={`${day===selected?'selected':''} ${day===3?'today':''}`} onClick={()=>setSelected(day)}><span>{day}</span>{calendarEvents[day]?.map((e,i)=><i className={`event-dot dot-${i}`} key={e[0]} title={e[0]}/>)}</button>)}</div></article><aside className="card day-panel"><p className="eyebrow">{String(selected).padStart(2,'0')} DE AGOSTO</p><h2>{selected===3?'Hoje':'Agenda do dia'}</h2>{(calendarEvents[selected]||[]).map((event,i)=><article className="event-card" key={event[0]}><i className={`dot-${i}`}/><div><b>{event[0]}</b><p>{event[1]}</p><small>{event[2]} · Cissa</small></div></article>)}{!calendarEvents[selected]&&<div className="empty-day"><p>Dia livre.</p><small>Nenhuma entrega, medição ou retirada.</small></div>}</aside></section>{eventOpen&&<Modal title="Novo evento" close={()=>setEventOpen(false)}><form className="modal-form" onSubmit={e=>{e.preventDefault();setEventOpen(false);setFeedback('Evento salvo como rascunho.')}}><label>Título<input name="title" required autoFocus placeholder="Entrega, medição ou retirada…"/></label><label>Data<input name="date" type="date" required/></label><label>Horário<input name="time" type="time" required/></label><footer><Button variant="secondary" onClick={()=>setEventOpen(false)}>Cancelar</Button><Button type="submit">Salvar evento</Button></footer></form></Modal>}{feedback&&<Feedback message={feedback} close={()=>setFeedback('')}/>}</>
}

const teamMembers = [['Cissa','cissa@arc.com.br','Admin','Ativo','CB'],['Rafael Lima','rafael@arc.com.br','Vendedor','Ativo','RL'],['Camila Reis','camila@arc.com.br','Vendedor','Ativo','CR'],['Júlia Antunes','julia@arc.com.br','Vendedor','Ativo','JA'],['Carlos Mendes','carlos@arc.com.br','Estoquista','Suspenso','CM']]
function Team() {
  const [query,setQuery]=useState(''); const [open,setOpen]=useState(false); const [feedback,setFeedback]=useState(''); const rows=teamMembers.filter(x=>x.join(' ').toLowerCase().includes(query.toLowerCase()))
  return <><PageHead eyebrow="GESTÃO · ACESSOS" title="Equipe" subtitle="5 pessoas · 4 acessos ativos" actions={<><input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nome ou e-mail…"/><Button onClick={()=>setOpen(true)}>+ Conceder acesso</Button></>}/><section className="team-stats"><article className="card"><span>04</span><div><h2>Acessos ativos</h2><p>Colaboradores com acesso imediato.</p></div></article><article className="card"><span>01</span><div><h2>Acesso suspenso</h2><p>Conta preservada sem login permitido.</p></div></article><article className="card security-card"><span>✓</span><div><h2>MFA protegido</h2><p>Todos administradores com segundo fator.</p></div></article></section><article className="card list-card"><div className="card-title"><h2>Membros</h2><Badge>{rows.length} pessoas</Badge></div><DataTable headers={['NOME / E-MAIL','CARGO','STATUS DO ACESSO','ÚLTIMA ATIVIDADE','AÇÕES']} rows={rows.map((x,i)=>[<div className="person"><span>{x[4]}</span><b>{x[0]}<small>{x[1]}</small></b></div>,<Badge tone="neutral">{x[2]}</Badge>,<Badge tone={x[3]==='Ativo'?'success':'danger'}>{x[3]}</Badge>,i===4?'há 18 dias':'hoje',<button className="text-action" onClick={()=>setFeedback(`Gerenciamento de ${x[0]} aberto.`)}>Gerenciar</button>])}/></article>{open&&<Modal title="Conceder acesso" close={()=>setOpen(false)}><form className="modal-form" onSubmit={e=>{e.preventDefault();setOpen(false);setFeedback('Convite preparado para envio.')}}><label>Nome<input name="name" autoFocus required/></label><label>E-mail<input name="email" type="email" required/></label><label>Perfil<select name="role"><option>Vendedor</option><option>Estoquista</option><option>Admin</option></select></label><label>Validade<select name="validity"><option>Sem expiração</option><option>30 dias</option><option>90 dias</option></select></label><footer><Button variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit">Enviar convite</Button></footer></form></Modal>}{feedback&&<Feedback message={feedback} close={()=>setFeedback('')}/>}</>
}

export function LegacyFinance() { return <><PageHead eyebrow="GESTÃO · FINANCEIRO" title="Painel financeiro" subtitle="Agosto de 2026 · fechamento em 28 dias" actions={<><div className="segmented"><button>Trimestre</button><button className="active">Mês</button></div><Button variant="secondary">Exportar</Button><Button>+ Lançamento</Button></>} /><section className="kpi-grid"><Kpi label="A RECEBER" value="R$ 742k" note="18 títulos abertos"/><Kpi label="RECEBIDO NO MÊS" value="R$ 612k" note="meta R$ 700k"/><Kpi label="VENCIDOS" value="R$ 96k" note="4 títulos · cobrar"/><Kpi dark label="MARGEM MÉDIA" value="28%" note="+3 p.p. vs. julho"/></section><section className="finance-grid"><article className="card chart"><h2>Entradas e saídas</h2><div className="bars">{[55,78,43,88,66,96].map((n,i)=><div key={i}><i style={{height:`${n}%`}}/><b style={{height:`${n*.62}%`}}/><span>{['MAR','ABR','MAI','JUN','JUL','AGO'][i]}</span></div>)}</div></article><div><article className="card"><h2>Aging de recebíveis</h2><StatusBars/></article><article className="card total-card forecast"><p className="mono">FLUXO PROJETADO · 30 DIAS</p><strong>+ R$ 268k</strong><dl><dt>Entradas previstas</dt><dd>594k</dd><dt>Compras e fornecedores</dt><dd>211k</dd><dt>Folha e serviços</dt><dd>115k</dd></dl></article></div></section><article className="card list-card"><div className="card-title"><h2>Títulos a receber</h2><span className="brand-text">Ver todos</span></div><DataTable headers={['TÍTULO','PROJETO','CLIENTE','SITUAÇÃO','VALOR','VENCE']} rows={quotes.slice(0,4).map((q,i)=>[q.id.replace('ORC','FT'),<b>{q.project}</b>,q.client,<Badge tone={i===1?'success':i===2?'danger':'info'}>{i===1?'Pago':i===2?'Vencido':'Em aberto'}</Badge>,money(q.value),q.date])}/></article></> }

function Finance() {
  const [period,setPeriod]=useState<'Mês'|'Trimestre'>('Mês'); const [open,setOpen]=useState(false); const [feedback,setFeedback]=useState('')
  return <><PageHead eyebrow="GESTÃO · FINANCEIRO" title="Painel financeiro" subtitle={`${period} · dados prontos para lançamento`} actions={<><div className="segmented"><button className={period==='Trimestre'?'active':''} onClick={()=>setPeriod('Trimestre')}>Trimestre</button><button className={period==='Mês'?'active':''} onClick={()=>setPeriod('Mês')}>Mês</button></div><Button variant="secondary" onClick={()=>setFeedback('Exportação preparada em CSV.')}>Exportar</Button><Button onClick={()=>setOpen(true)}>+ Lançamento</Button></>}/><section className="kpi-grid"><Kpi label="A RECEBER" value="R$ 742k" note="18 títulos abertos"/><Kpi label="RECEBIDO NO MÊS" value="R$ 612k" note="meta R$ 700k"/><Kpi label="VENCIDOS" value="R$ 96k" note="4 títulos · cobrar"/><Kpi dark label="MARGEM MÉDIA" value="28%" note="+3 p.p. vs. julho"/></section><section className="finance-grid"><article className="card chart"><h2>Entradas e saídas</h2><div className="bars">{[55,78,43,88,66,96].map((n,i)=><div key={i}><i style={{height:`${n}%`}}/><b style={{height:`${n*.62}%`}}/><span>{['MAR','ABR','MAI','JUN','JUL','AGO'][i]}</span></div>)}</div></article><div><article className="card"><h2>Aging de recebíveis</h2><StatusBars/></article><article className="card total-card forecast"><p className="mono">FLUXO PROJETADO · 30 DIAS</p><strong>+ R$ 268k</strong><dl><dt>Entradas previstas</dt><dd>594k</dd><dt>Compras e fornecedores</dt><dd>211k</dd><dt>Folha e serviços</dt><dd>115k</dd></dl></article></div></section><article className="card list-card"><div className="card-title"><h2>Títulos a receber</h2><button className="text-action" onClick={()=>setFeedback('Filtro completo de títulos aberto.')}>Ver todos</button></div><DataTable headers={['TÍTULO','PROJETO','CLIENTE','SITUAÇÃO','VALOR','VENCE']} rows={quotes.slice(0,4).map((q,i)=>[q.id.replace('ORC','FT'),<b>{q.project}</b>,q.client,<Badge tone={i===1?'success':i===2?'danger':'info'}>{i===1?'Pago':i===2?'Vencido':'Em aberto'}</Badge>,money(q.value),q.date])}/></article>{open&&<Modal title="Novo lançamento" close={()=>setOpen(false)}><form className="modal-form" onSubmit={e=>{e.preventDefault();setOpen(false);setFeedback('Lançamento salvo como rascunho.')}}><label>Descrição<input name="description" required autoFocus placeholder="Compra de MDF…"/></label><label>Valor<input name="amount" type="number" min="0" step="0.01" required placeholder="0,00"/></label><label>Data<input name="date" type="date" required/></label><footer><Button variant="secondary" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit">Salvar lançamento</Button></footer></form></Modal>}{feedback&&<Feedback message={feedback} close={()=>setFeedback('')}/>}</>
}

function Portal() { const [approved,setApproved]=useState(false); const [adjustOpen,setAdjustOpen]=useState(false); return <div className="portal"><header><Logo/><span>Portal de aprovações</span><b>Ana Prado <i>AP</i></b></header><main><PageHead eyebrow="PROPOSTA ORC-0413 · REV. 02" title="Cobertura Higienópolis" subtitle="Cozinha e living · entrega prevista 12/11/2026 · validade da proposta 15 dias"/><div className="portal-grid"><div><article className="card proposal"><h2>O que está incluído</h2>{proposalItems.map(x=><div key={x[0]}><b>{x[0]}</b><span>{x[1]} {x[2]}</span><em>{x[4]}</em></div>)}<footer>Total da proposta <strong>R$ 54.400</strong></footer></article><article className="card documents"><p className="mono">DOCUMENTOS DO PROJETO</p><button className="text-action">planta-cozinha.pdf ↓</button> <button className="text-action">render-living.jpg ↓</button> <button className="text-action">memorial-acabamentos.pdf ↓</button></article></div><aside><article className="card decision"><p className="mono">SUA DECISÃO</p><h2>{approved?'Proposta aprovada.':'Aprovar esta proposta?'}</h2><p>{approved?'A produção foi liberada e uma cópia da aprovação seguirá por e-mail.':'Ao aprovar, a produção entra na fila e o pagamento de entrada (40%) é liberado para emissão.'}</p><Button onClick={()=>setApproved(true)}>{approved?'Aprovada':'Aprovar proposta'}</Button><Button variant="secondary" onClick={()=>setAdjustOpen(true)}>Pedir ajuste</Button><small>Você receberá uma cópia por e-mail.</small></article><article className="card timeline"><h2>Andamento</h2>{['Proposta enviada','Revisão de acabamentos','Aprovação do cliente','Produção','Entrega e montagem'].map((x,i)=><div className={i<2||approved&&i===2?'done':i===2?'current':''} key={x}><i/><b>{x}<small>{i<2?'04/08 · 09:12':i===2?(approved?'aprovado agora':'aguardando você'):'após aprovação'}</small></b></div>)}</article><article className="help">Dúvidas antes de decidir?<small>Fale com Rafael Lima · 11 99812-4402</small></article></aside></div></main>{approved&&<div className="toast"><i/>Proposta aprovada. Produção liberada.<button aria-label="Fechar aviso" onClick={()=>setApproved(false)}>×</button></div>}{adjustOpen&&<Modal title="Pedir ajuste" close={()=>setAdjustOpen(false)}><form className="modal-form" onSubmit={e=>{e.preventDefault();setAdjustOpen(false)}}><label>O que precisa revisar?<textarea name="request" required autoFocus placeholder="Descreva o acabamento, prazo ou item…"/></label><footer><Button variant="secondary" onClick={()=>setAdjustOpen(false)}>Cancelar</Button><Button type="submit">Enviar pedido</Button></footer></form></Modal>}</div> }

function Login({ onSuccess }: { onSuccess: () => void }) { const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [mfa,setMfa]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false); async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const data=await login(email,password);if(data.mfa_required){setError('MFA habilitado. Informe o código para continuar.');return}sessionStorage.setItem('arc-session','1');onSuccess()}catch(err){setError(err instanceof Error?err.message:'Falha ao entrar')}finally{setBusy(false)}} return <div className="login"><section><Logo/><div><h1>Seu projeto de<br/>interiores em<br/><span>uma tela só.</span></h1><p>Orçamento, medição, estoque e cronograma<br/>no mesmo lugar — como o cliente<br/>acompanhando pelo portal.</p></div><footer><i/><i/><i/><i/><span className="mono">AMOSTRAS<br/>DO PROJETO ATIVO</span></footer></section><form onSubmit={submit}><div><p className="eyebrow">ACESSO AO ATELIÊ</p><h2>Entrar</h2><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="marina@estudio.com.br" required/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/></label><label>Código MFA <span className="mono">6 DÍGITOS</span><input className="mfa" value={mfa} onChange={e=>setMfa(e.target.value)} placeholder="428 913"/></label>{error&&<p className="form-error">{error}</p>}<Button type="submit">{busy?'Entrando...':'Entrar'}</Button><footer><button type="button">Esqueci minha senha</button><span className="mono">V1.0 · LÍNEA</span></footer></div></form></div> }

export default function App() {
  const previewMode = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === '1'
  const [authenticated,setAuthenticated] = useState(sessionStorage.getItem('arc-session')==='1' || previewMode)
  const [route,setRoute] = useState<Route>(() => { const hash=location.hash.slice(1) as Route; return routes.includes(hash)?hash:'dashboard' })
  useEffect(()=>{ if(!authenticated) return; getSessionUser().catch(()=>{ /* cookie may be unavailable during static visual review */ }) },[authenticated])
  const go=(next:Route)=>{setRoute(next);location.hash=next;window.scrollTo(0,0)}
  const page=useMemo(()=>({dashboard:<Dashboard/>,clients:<Clients/>,pipeline:<Pipeline/>,builder:<Builder/>,catalog:<Catalog/>,inventory:<Inventory/>,suppliers:<Suppliers/>,schedule:<Schedule/>,finance:<Finance/>,team:<Team/>} as Partial<Record<Route, ReactNode>>)[route],[route])
  if(!authenticated) return <Login onSuccess={()=>setAuthenticated(true)}/>
  if(route==='portal') return <Portal/>
  return <AppShell route={route} go={go}>{page}</AppShell>
}
