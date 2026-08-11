from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func
from datetime import datetime, timezone, timedelta
import os
import uuid
from database import get_db
import models, schemas, auth
from pdf_generator import generate_orcamento_pdf
from anexo_utils import (
    validar_anexo,
    read_upload_limited,
    ensure_anexo_dir,
    anexo_disk_path,
    cnpjs_configurados,
)

router = APIRouter(prefix="/orcamentos", tags=["Orçamentos e Kanban"])


def _get_orcamento_autorizado(orcamento_id: int, db: Session, current_user: models.Usuario) -> models.Orcamento:
    orcamento = db.query(models.Orcamento).filter(models.Orcamento.id == orcamento_id).first()
    if not orcamento:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")
    if current_user.role != 'admin' and orcamento.vendedor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    return orcamento


def _remover_arquivo_anexo(anexo: models.OrcamentoAnexo) -> None:
    try:
        file_path = anexo_disk_path(anexo.url)
        if os.path.exists(file_path):
            os.remove(file_path)
    except OSError:
        pass


def _enrich_orcamento(orc, detail: bool = False):
    """Enriquece um orçamento com dados calculados. Se detail=True, expande todos os campos do cliente/vendedor."""
    cliente = getattr(orc, 'cliente', None)
    vendedor = getattr(orc, 'vendedor', None)

    valor_total = 0
    for item in getattr(orc, 'itens', []):
        valor_total += item.quantidade * item.preco_unitario_aplicado
        produto = getattr(item, 'produto', None)
        servico = getattr(item, 'servico', None)
        if produto:
            item.nome = produto.nome
            item.foto_url = produto.foto_url
        elif servico:
            item.nome = servico.nome

    orc.cliente_nome = cliente.nome_fantasia if cliente else None
    orc.cliente_status = getattr(cliente, 'status', None) if cliente else None
    orc.vendedor_nome = vendedor.nome if vendedor else None
    orc.valor_total = valor_total

    if detail:
        orc.cliente_cpf_cnpj = cliente.cpf_cnpj if cliente else None
        orc.cliente_responsavel = cliente.nome_responsavel if cliente else None
        orc.cliente_email = cliente.email if cliente else None
        orc.cliente_contato = cliente.contato if cliente else None
        orc.cliente_endereco = cliente.endereco_entrega if cliente else None
        orc.vendedor_email = vendedor.email if vendedor else None
        orc.vendedor_contato = vendedor.contato if vendedor else None

    pendencias = []
    if orc.cliente_status == 'pendente':
        pendencias.append("Finalizar cadastro do cliente")
    if not getattr(orc, 'condicao_pagamento', None):
        pendencias.append("Definir o método de pagamento")
    orc.pendencias = pendencias

    return orc


def _enrich_orcamento_detail(orc, db=None):
    """Atalho para retrocompatibilidade — chama _enrich_orcamento com detail=True."""
    return _enrich_orcamento(orc, detail=True)


def _hidratar_prazo_servico(item_data: dict, db: Session) -> dict:
    """Se o item referencia um serviço e não veio com prazo explícito, pré-preenche
    prazo_entrega_valor/unidade com o tempo médio de execução do serviço (editável depois,
    igual já acontece com o preço)."""
    if item_data.get('servico_id') and not item_data.get('prazo_entrega_valor'):
        servico = db.query(models.Servico).filter(models.Servico.id == item_data['servico_id']).first()
        if servico:
            item_data['prazo_entrega_valor'] = servico.tempo_medio_valor
            item_data['prazo_entrega_unidade'] = servico.tempo_medio_unidade
    return item_data


def _ensure_fornecedor(nome_fornecedor: str, db: Session):
    """Garante que um fornecedor com o dado nome exista. Cria como 'pendente' se não existir."""
    nome = nome_fornecedor.strip()
    if not nome:
        return
    existe = db.query(models.Fornecedor).filter(
        func.lower(models.Fornecedor.nome_fantasia) == nome.lower()
    ).first()
    if not existe:
        db.add(models.Fornecedor(nome_fantasia=nome, status="pendente", ativo=True))
        db.flush()


def _get_or_create_config(db: Session) -> models.OrcamentoConfig:
    """Retorna a configuração global do orçamento, criando com defaults se não existir."""
    config = db.query(models.OrcamentoConfig).filter(models.OrcamentoConfig.id == 1).first()
    if not config:
        config = models.OrcamentoConfig(
            id=1,
            condicao_pagamento="5% à vista OU 3x sem juros. Em caso de construtoras e empreiteiras, 28 dias de faturamento.",
            prazo_entrega="em casos de pronta entrega, até 7 dias úteis. No geral, de 30 a 40 dias úteis.",
            validade_orcamento="30 dias corridos.",
            garantia_mobiliario="6 meses contra eventuais defeitos de fabricação.",
            observacoes_extras="Peças cromadas em região litorânea não possuem garantia.\nEm caso de içamento, será de total responsabilidade do comprador."
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _build_pdf_data(orc, db=None):
    """Monta o dicionário completo para gerar o PDF lendo da memória."""
    cliente = getattr(orc, 'cliente', None)
    vendedor = getattr(orc, 'vendedor', None)
    
    itens_data = []
    for item in getattr(orc, 'itens', []):
        item_dict = {
            'quantidade': item.quantidade,
            'preco_unitario_aplicado': item.preco_unitario_aplicado,
            'is_externo': item.is_externo,
            'nome_externo': item.nome_externo,
            'descricao_externa': item.descricao_externa,
            'foto_externa_url': item.foto_externa_url,
            'local_instalacao': item.local_instalacao,
            'personalizacao_aplicada': item.personalizacao_aplicada,
            'prazo_entrega_valor': item.prazo_entrega_valor,
            'prazo_entrega_unidade': item.prazo_entrega_unidade,
        }
        # Lê do produto/serviço pré-carregado
        produto = getattr(item, 'produto', None)
        servico = getattr(item, 'servico', None)
        if produto:
            item_dict['nome'] = produto.nome
            item_dict['foto_url'] = produto.foto_url
        elif servico:
            item_dict['nome'] = servico.nome
        elif item.produto_id:
            item_dict['nome'] = f'Produto #{item.produto_id}'
        
        itens_data.append(item_dict)
    
    result = {
        'id': orc.id,
        'tipo_orcamento': orc.tipo_orcamento,
        'cliente_nome': (cliente.nome_fantasia or '') if cliente else '',
        'cliente_cpf_cnpj': (cliente.cpf_cnpj or '') if cliente else '',
        'cliente_responsavel': (cliente.nome_responsavel or '') if cliente else '',
        'cliente_email': (cliente.email or '') if cliente else '',
        'cliente_contato': (cliente.contato or '') if cliente else '',
        'cliente_endereco': (cliente.endereco_entrega or '') if cliente else '',
        'vendedor_nome': vendedor.nome if vendedor else '',
        'vendedor_email': vendedor.email if vendedor else '',
        'vendedor_contato': vendedor.contato if vendedor else '',
        'prazo_locacao_valor': orc.prazo_locacao_valor,
        'prazo_locacao_unidade': orc.prazo_locacao_unidade,
        'arquiteto_nome': getattr(orc, 'arquiteto_nome', ''),
        'arquiteto_contato': getattr(orc, 'arquiteto_contato', ''),
        'condicoes_pagamento_selecionadas': getattr(orc, 'condicoes_pagamento_selecionadas', None),
        'itens': itens_data,
    }

    config_dict = {}
    if db:
        config_db = db.query(models.OrcamentoConfig).filter(models.OrcamentoConfig.id == 1).first()
        if config_db:
            config_dict = {
                'condicao_pagamento': config_db.condicao_pagamento,
                'prazo_entrega': config_db.prazo_entrega,
                'validade_orcamento': config_db.validade_orcamento,
                'garantia_mobiliario': config_db.garantia_mobiliario,
                'observacoes_extras': config_db.observacoes_extras,
            }
    result['config'] = config_dict
    return result


@router.post("/", response_model=schemas.OrcamentoOut, status_code=status.HTTP_201_CREATED)
def criar_orcamento(orcamento: schemas.OrcamentoCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    # 1. Valida dono do cliente
    cliente = db.query(models.Cliente).filter(models.Cliente.id == orcamento.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    if current_user.role != 'admin' and cliente.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Pertence a outro vendedor.")

    # 2. Determina o vendedor_id
    if current_user.role == 'admin' and orcamento.vendedor_id:
        # Admin pode designar outro vendedor
        vendedor = db.query(models.Usuario).filter(
            models.Usuario.id == orcamento.vendedor_id,
            models.Usuario.ativo == True
        ).first()
        if not vendedor:
            raise HTTPException(status_code=404, detail="Vendedor selecionado não encontrado ou inativo.")
        vendedor_id = orcamento.vendedor_id
    else:
        # Vendedor auto-atribui; Admin sem seleção também se auto-atribui
        vendedor_id = current_user.id

    # 3. Cria Cabeçalho do Orçamento
    novo_orcamento = models.Orcamento(
        cliente_id=orcamento.cliente_id,
        vendedor_id=vendedor_id,
        tipo_orcamento=orcamento.tipo_orcamento,
        status="Gerando orçamento",
        prazo_locacao_valor=orcamento.prazo_locacao_valor,
        prazo_locacao_unidade=orcamento.prazo_locacao_unidade,
        arquiteto_nome=orcamento.arquiteto_nome,
        arquiteto_contato=orcamento.arquiteto_contato,
        condicoes_pagamento_selecionadas=orcamento.condicoes_pagamento_selecionadas,
        projeto_id=orcamento.projeto_id
    )
    db.add(novo_orcamento)
    db.flush()  # Puxa o ID gerado sem fazer commit ainda
    
    # 4. Adiciona os Itens Híbridos (Estoque e Externos)
    for item in orcamento.itens:
        if item.is_externo and item.fornecedor_externo:
            _ensure_fornecedor(item.fornecedor_externo, db)
        novo_item = models.OrcamentoItem(
            **_hidratar_prazo_servico(item.model_dump(), db),
            orcamento_id=novo_orcamento.id
        )
        db.add(novo_item)
        
    db.commit()
    db.refresh(novo_orcamento)
    
    # Grava o Log de Criação
    db.add(models.AuditLog(
        usuario_id=current_user.id,
        vendedor_id=novo_orcamento.vendedor_id,
        acao="CRIOU_ORCAMENTO",
        detalhes=f"Criou o orçamento #{novo_orcamento.id} (Tipo: {novo_orcamento.tipo_orcamento})",
        entidade="Orcamento",
        entidade_id=novo_orcamento.id
    ))
    db.commit()
    
    # 5. Gera o PDF automaticamente
    try:
        pdf_data = _build_pdf_data(novo_orcamento, db)
        pdf_url = generate_orcamento_pdf(pdf_data)
        novo_orcamento.anexo_url = pdf_url
        db.commit()
        db.refresh(novo_orcamento)
    except Exception as e:
        print(f"[PDF] Erro ao gerar PDF do orçamento #{novo_orcamento.id}: {e}")
        # Não falha a criação do orçamento se o PDF der erro
    
    return _enrich_orcamento(novo_orcamento, detail=True)


@router.get("/config", response_model=schemas.OrcamentoConfigOut)
def obter_configuracao(db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    return _get_or_create_config(db)


@router.put("/config", response_model=schemas.OrcamentoConfigOut)
def atualizar_configuracao(config_in: schemas.OrcamentoConfigUpdate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Apenas admin pode editar.")
    config = _get_or_create_config(db)
    # Só grava o que veio no corpo: antes, salvar um campo apagava todos os outros
    # (inclusive os CNPJs de faturamento). Enviar `null` explícito continua limpando.
    enviados = config_in.model_dump(exclude_unset=True)
    if 'organizacao_nome' in enviados:
        enviados['organizacao_nome'] = (enviados['organizacao_nome'] or '').strip() or None
    for campo, valor in enviados.items():
        setattr(config, campo, valor)
    db.commit()
    db.refresh(config)
    return config


@router.post("/config/reset", response_model=schemas.OrcamentoConfigOut)
def resetar_configuracao(db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Apenas admin pode editar.")
    config = _get_or_create_config(db)
    config.condicao_pagamento = "5% à vista OU 3x sem juros. Em caso de construtoras e empreiteiras, 28 dias de faturamento."
    config.prazo_entrega = "em casos de pronta entrega, até 7 dias úteis. No geral, de 30 a 40 dias úteis."
    config.validade_orcamento = "30 dias corridos."
    config.garantia_mobiliario = "6 meses contra eventuais defeitos de fabricação."
    config.observacoes_extras = "Peças cromadas em região litorânea não possuem garantia.\nEm caso de içamento, será de total responsabilidade do comprador."
    config.empresa1_nome = None
    config.empresa1_cnpj = None
    config.empresa2_nome = None
    config.empresa2_cnpj = None
    db.commit()
    db.refresh(config)
    return config

@router.put("/{orcamento_id}", response_model=schemas.OrcamentoOut)
def editar_orcamento(orcamento_id: int, orcamento_in: schemas.OrcamentoCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    orcamento = db.query(models.Orcamento).filter(models.Orcamento.id == orcamento_id).first()
    if not orcamento:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")
        
    if current_user.role != 'admin' and orcamento.vendedor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas o criador ou admin podem editar.")

    cliente = db.query(models.Cliente).filter(models.Cliente.id == orcamento_in.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    if current_user.role != 'admin' and cliente.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cliente pertence a outro vendedor.")
    
    orcamento.cliente_id = orcamento_in.cliente_id
    orcamento.tipo_orcamento = orcamento_in.tipo_orcamento
    orcamento.prazo_locacao_valor = orcamento_in.prazo_locacao_valor
    orcamento.prazo_locacao_unidade = orcamento_in.prazo_locacao_unidade
    orcamento.arquiteto_nome = orcamento_in.arquiteto_nome
    orcamento.arquiteto_contato = orcamento_in.arquiteto_contato
    orcamento.condicoes_pagamento_selecionadas = orcamento_in.condicoes_pagamento_selecionadas
    orcamento.projeto_id = orcamento_in.projeto_id

    if orcamento.status in ["Aprovado", "Entregue", "Devolvido", "Faturado"] and orcamento.tipo_orcamento in ["Locacao", "Producao"]:
        base_date = orcamento.data_entrega if orcamento.tipo_orcamento == "Locacao" else orcamento.data_aprovacao
        if base_date and orcamento.prazo_locacao_valor:
            if orcamento.prazo_locacao_unidade == "dias":
                orcamento.data_fim_locacao = base_date + timedelta(days=orcamento.prazo_locacao_valor)
            elif orcamento.prazo_locacao_unidade == "meses":
                orcamento.data_fim_locacao = base_date + timedelta(days=orcamento.prazo_locacao_valor * 30)
        elif base_date:
            orcamento.data_fim_locacao = None
            
    if current_user.role == 'admin' and orcamento_in.vendedor_id:
        vendedor = db.query(models.Usuario).filter(models.Usuario.id == orcamento_in.vendedor_id, models.Usuario.ativo == True).first()
        if vendedor:
            orcamento.vendedor_id = orcamento_in.vendedor_id

    # Remover itens antigos
    db.query(models.OrcamentoItem).filter(models.OrcamentoItem.orcamento_id == orcamento_id).delete()
    
    # Inserir novos itens
    for item in orcamento_in.itens:
        if item.is_externo and item.fornecedor_externo:
            _ensure_fornecedor(item.fornecedor_externo, db)
        novo_item = models.OrcamentoItem(
            **_hidratar_prazo_servico(item.model_dump(), db),
            orcamento_id=orcamento.id
        )
        db.add(novo_item)
        
    db.commit()
    db.refresh(orcamento)
    
    # Grava o Log de Edição
    db.add(models.AuditLog(
        usuario_id=current_user.id,
        vendedor_id=orcamento.vendedor_id,
        acao="EDITOU_ORCAMENTO",
        detalhes=f"Editou os itens/dados do orçamento #{orcamento.id}",
        entidade="Orcamento",
        entidade_id=orcamento.id
    ))
    db.commit()
    
    try:
        pdf_data = _build_pdf_data(orcamento, db)
        pdf_url = generate_orcamento_pdf(pdf_data)
        orcamento.anexo_url = pdf_url
        db.commit()
        db.refresh(orcamento)
    except Exception as e:
        print(f"[PDF] Erro ao gerar PDF na edição do orçamento #{orcamento.id}: {e}")

    return _enrich_orcamento(orcamento, detail=True)


@router.get("/", response_model=list[schemas.OrcamentoOut])
def listar_orcamentos(db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """ Retorna a lista de orçamentos para preencher o Kanban Board """
    if current_user.role == 'admin':
        orcamentos = db.query(models.Orcamento).options(
            joinedload(models.Orcamento.cliente),
            joinedload(models.Orcamento.vendedor),
            selectinload(models.Orcamento.itens).joinedload(models.OrcamentoItem.produto)
        ).all()
    else:
        orcamentos = db.query(models.Orcamento).options(
            joinedload(models.Orcamento.cliente),
            joinedload(models.Orcamento.vendedor),
            selectinload(models.Orcamento.itens).joinedload(models.OrcamentoItem.produto)
        ).filter(
            models.Orcamento.vendedor_id == current_user.id
        ).all()
    
    # Enriquece cada orçamento com dados calculados
    for orc in orcamentos:
        _enrich_orcamento(orc, detail=True)
    
    return orcamentos

# --- Condições de Pagamento Dinâmicas ---

@router.get("/condicoes-pagamento", response_model=list[schemas.CondicaoPagamentoOut])
def listar_condicoes_pagamento(db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    # Retorna todas, ordenadas pelo ID
    return db.query(models.CondicaoPagamento).order_by(models.CondicaoPagamento.id.asc()).all()

@router.post("/condicoes-pagamento", response_model=schemas.CondicaoPagamentoOut)
def criar_condicao_pagamento(condicao: schemas.CondicaoPagamentoCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Apenas admin pode gerenciar.")
    nova_condicao = models.CondicaoPagamento(**condicao.dict())
    db.add(nova_condicao)
    db.commit()
    db.refresh(nova_condicao)
    return nova_condicao

@router.patch("/condicoes-pagamento/{condicao_id}", response_model=schemas.CondicaoPagamentoOut)
def atualizar_condicao_pagamento(condicao_id: int, condicao_in: schemas.CondicaoPagamentoUpdate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Apenas admin pode gerenciar.")
    condicao = db.query(models.CondicaoPagamento).filter(models.CondicaoPagamento.id == condicao_id).first()
    if not condicao:
        raise HTTPException(status_code=404, detail="Condição não encontrada.")
    
    if condicao_in.nome != None:
        condicao.nome = condicao_in.nome
    if condicao_in.ativo != None:
        condicao.ativo = condicao_in.ativo
        
    db.commit()
    db.refresh(condicao)
    return condicao


@router.delete("/condicoes-pagamento/{condicao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_condicao_pagamento(condicao_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Apenas admin pode gerenciar.")
    condicao = db.query(models.CondicaoPagamento).filter(models.CondicaoPagamento.id == condicao_id).first()
    if not condicao:
        raise HTTPException(status_code=404, detail="Condição não encontrada.")
    db.delete(condicao)
    db.commit()
    return None


# --- Vendas (entidade própria, distinta de Orçamento) ---
# Rota literal precisa vir ANTES de /{orcamento_id} — Starlette casa rotas na ordem de
# registro, não por especificidade, então "/vendas/historico" perderia para
# "/{orcamento_id}/historico" se ficasse depois.

@router.get("/vendas/historico", response_model=list[schemas.VendaOut])
def listar_vendas(db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """Histórico de vendas — entidade própria (Venda), distinta da listagem de Orçamentos."""
    query = db.query(models.Venda).options(
        joinedload(models.Venda.orcamento).joinedload(models.Orcamento.cliente),
        joinedload(models.Venda.vendedor),
    )
    if current_user.role != 'admin':
        query = query.filter(models.Venda.vendedor_id == current_user.id)
    vendas = query.order_by(models.Venda.data_venda.desc()).all()
    for venda in vendas:
        venda.cliente_nome = venda.orcamento.cliente.nome_fantasia if venda.orcamento and venda.orcamento.cliente else None
        venda.vendedor_nome = venda.vendedor.nome if venda.vendedor else None
    return vendas


@router.get("/{orcamento_id}", response_model=schemas.OrcamentoDetailOut)
def obter_orcamento(orcamento_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """ Retorna os detalhes completos de um orçamento específico """
    orcamento = db.query(models.Orcamento).options(
        joinedload(models.Orcamento.cliente),
        joinedload(models.Orcamento.vendedor),
        selectinload(models.Orcamento.itens).joinedload(models.OrcamentoItem.produto)
    ).filter(models.Orcamento.id == orcamento_id).first()
    
    if not orcamento:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")
    
    # Segurança: vendedor só vê os próprios
    if current_user.role != 'admin' and orcamento.vendedor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado. Este orçamento pertence a outro vendedor.")
    
    return _enrich_orcamento_detail(orcamento, db)


@router.post("/{orcamento_id}/portal-link", response_model=schemas.PortalLinkOut)
def gerar_link_portal(
    orcamento_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.get_current_user),
):
    """Gera e envia o link mágico; cada envio revoga automaticamente o anterior."""
    orcamento = _get_orcamento_autorizado(orcamento_id, db, current_user)
    if orcamento.status not in ("Orçamento gerado", "Ajuste solicitado"):
        raise HTTPException(status_code=400, detail="Gere o orçamento antes de enviar ao cliente.")
    if not orcamento.cliente or not orcamento.cliente.email or not orcamento.cliente.email.strip():
        raise HTTPException(
            status_code=400,
            detail="O cadastro do cliente precisa de um e-mail para envio do link.",
        )

    orcamento.portal_token_version = (orcamento.portal_token_version or 0) + 1
    db.commit()
    db.refresh(orcamento)
    token = auth.create_portal_token(orcamento)
    url = f"{auth.FRONTEND_URL.rstrip('/')}/#portal/{token}"
    expira_em = datetime.now(timezone.utc) + timedelta(days=auth.PORTAL_TOKEN_EXPIRE_DAYS)

    db.add(
        models.AuditLog(
            usuario_id=current_user.id,
            vendedor_id=orcamento.vendedor_id,
            acao="ENVIOU_PORTAL",
            detalhes=f"Enviou link do portal do orçamento #{orcamento.id} para {orcamento.cliente.email}",
            entidade="Orcamento",
            entidade_id=orcamento.id,
            ip=request.headers.get("X-Real-IP", request.client.host if request.client else "127.0.0.1"),
        )
    )
    db.commit()
    try:
        auth.send_portal_link_email(orcamento.cliente.email, url)
    except Exception as exc:
        # O vendedor ainda pode copiar a URL; o envio por e-mail é conveniência.
        print(f"Erro ao enviar link do portal: {exc}")

    return schemas.PortalLinkOut(url=url, expira_em=expira_em, enviado_para=orcamento.cliente.email)


@router.post("/{orcamento_id}/portal-link/revogar", status_code=status.HTTP_204_NO_CONTENT)
def revogar_link_portal(
    orcamento_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.get_current_user),
):
    """Revoga links emitidos sem criar blacklist ou expor o token anterior."""
    orcamento = _get_orcamento_autorizado(orcamento_id, db, current_user)
    orcamento.portal_token_version = (orcamento.portal_token_version or 0) + 1
    db.add(
        models.AuditLog(
            usuario_id=current_user.id,
            vendedor_id=orcamento.vendedor_id,
            acao="REVOGOU_PORTAL",
            detalhes=f"Revogou o link do portal do orçamento #{orcamento.id}",
            entidade="Orcamento",
            entidade_id=orcamento.id,
            ip=request.headers.get("X-Real-IP", request.client.host if request.client else "127.0.0.1"),
        )
    )
    db.commit()
    return None


@router.get("/{orcamento_id}/historico", response_model=list[schemas.AuditLogOut])
def obter_historico_orcamento(orcamento_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """ Retorna o histórico de atividades de um orçamento """
    orcamento = db.query(models.Orcamento).filter(models.Orcamento.id == orcamento_id).first()
    if not orcamento:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")
        
    if current_user.role != 'admin' and orcamento.vendedor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado.")
        
    logs = db.query(models.AuditLog).options(joinedload(models.AuditLog.usuario)).filter(
        models.AuditLog.entidade == "Orcamento",
        models.AuditLog.entidade_id == orcamento_id
    ).order_by(models.AuditLog.created_at.desc()).all()
    
    for log in logs:
        log.usuario_nome = log.usuario.nome if log.usuario else "Sistema"
        
    return logs


# --- Anexos do Orçamento ---

@router.get("/{orcamento_id}/anexos", response_model=list[schemas.OrcamentoAnexoOut])
def listar_anexos(orcamento_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """ Lista os anexos de um orçamento """
    _get_orcamento_autorizado(orcamento_id, db, current_user)
    anexos = db.query(models.OrcamentoAnexo).options(
        joinedload(models.OrcamentoAnexo.usuario)
    ).filter(
        models.OrcamentoAnexo.orcamento_id == orcamento_id
    ).order_by(models.OrcamentoAnexo.created_at.desc()).all()

    for anexo in anexos:
        anexo.usuario_nome = anexo.usuario.nome if anexo.usuario else None
        # URL pública autenticada (não expor caminho estático)
        anexo.url = f"/orcamentos/{orcamento_id}/anexos/{anexo.id}/download"
    return anexos


@router.patch("/{orcamento_id}/anexos/{anexo_id}/visibilidade", response_model=schemas.OrcamentoAnexoOut)
def alterar_visibilidade_anexo(
    orcamento_id: int,
    anexo_id: int,
    payload: schemas.OrcamentoAnexoVisibilidadeIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.get_current_user),
):
    """Libera ou retira um documento do portal com auditoria explícita."""
    orcamento = _get_orcamento_autorizado(orcamento_id, db, current_user)
    anexo = db.query(models.OrcamentoAnexo).filter(
        models.OrcamentoAnexo.id == anexo_id,
        models.OrcamentoAnexo.orcamento_id == orcamento_id,
    ).first()
    if not anexo:
        raise HTTPException(status_code=404, detail="Anexo não encontrado.")

    anexo.visivel_cliente = payload.visivel_cliente
    db.add(
        models.AuditLog(
            usuario_id=current_user.id,
            vendedor_id=orcamento.vendedor_id,
            acao="ALTEROU_VISIBILIDADE_ANEXO",
            detalhes=(
                f"{'Liberou' if payload.visivel_cliente else 'Retirou'} o documento "
                f"'{anexo.nome_original}' para o portal do orçamento #{orcamento_id}"
            ),
            entidade="Orcamento",
            entidade_id=orcamento_id,
            ip=request.headers.get("X-Real-IP", request.client.host if request.client else "127.0.0.1"),
        )
    )
    db.commit()
    db.refresh(anexo)
    anexo.usuario_nome = current_user.nome
    anexo.url = f"/orcamentos/{orcamento_id}/anexos/{anexo.id}/download"
    return anexo


@router.post("/{orcamento_id}/anexos", response_model=schemas.OrcamentoAnexoOut, status_code=status.HTTP_201_CREATED)
async def adicionar_anexo(orcamento_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """ Anexa um arquivo (PDF, DOCX, XLSX, etc.) ao orçamento. Não altera o PDF do orçamento. """
    orcamento = _get_orcamento_autorizado(orcamento_id, db, current_user)

    filename = file.filename or "anexo"
    ext = os.path.splitext(filename)[1].lower()
    content = await read_upload_limited(file)
    validar_anexo(ext, content)

    safe_filename = f"anexo_orc{orcamento_id}_{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(ensure_anexo_dir(), safe_filename)
    with open(file_path, "wb") as buffer:
        buffer.write(content)

    # Guarda caminho interno (não servido por StaticFiles); download só via endpoint autenticado
    anexo = models.OrcamentoAnexo(
        orcamento_id=orcamento_id,
        usuario_id=current_user.id,
        nome_original=filename,
        url=f"anexos/{safe_filename}",
        extensao=ext,
        tamanho=len(content),
    )
    db.add(anexo)
    db.add(models.AuditLog(
        usuario_id=current_user.id,
        vendedor_id=orcamento.vendedor_id,
        acao="ADICIONOU_ANEXO",
        detalhes=f"Anexou o arquivo '{filename}' ao orçamento #{orcamento_id}",
        entidade="Orcamento",
        entidade_id=orcamento_id
    ))
    db.commit()
    db.refresh(anexo)
    anexo.usuario_nome = current_user.nome
    anexo.url = f"/orcamentos/{orcamento_id}/anexos/{anexo.id}/download"
    return anexo


@router.get("/{orcamento_id}/anexos/{anexo_id}/download")
def download_anexo(orcamento_id: int, anexo_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """ Download autenticado do anexo (arquivos não ficam públicos em /static). """
    _get_orcamento_autorizado(orcamento_id, db, current_user)
    anexo = db.query(models.OrcamentoAnexo).filter(
        models.OrcamentoAnexo.id == anexo_id,
        models.OrcamentoAnexo.orcamento_id == orcamento_id
    ).first()
    if not anexo:
        raise HTTPException(status_code=404, detail="Anexo não encontrado.")

    file_path = anexo_disk_path(anexo.url)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no servidor.")

    return FileResponse(
        path=file_path,
        filename=anexo.nome_original,
        media_type="application/octet-stream",
        content_disposition_type="attachment",
    )


@router.delete("/{orcamento_id}/anexos/{anexo_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_anexo(orcamento_id: int, anexo_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """ Remove um anexo do orçamento (e o arquivo do disco) """
    orcamento = _get_orcamento_autorizado(orcamento_id, db, current_user)
    anexo = db.query(models.OrcamentoAnexo).filter(
        models.OrcamentoAnexo.id == anexo_id,
        models.OrcamentoAnexo.orcamento_id == orcamento_id
    ).first()
    if not anexo:
        raise HTTPException(status_code=404, detail="Anexo não encontrado.")

    _remover_arquivo_anexo(anexo)

    nome = anexo.nome_original
    db.delete(anexo)
    db.add(models.AuditLog(
        usuario_id=current_user.id,
        vendedor_id=orcamento.vendedor_id,
        acao="REMOVEU_ANEXO",
        detalhes=f"Removeu o anexo '{nome}' do orçamento #{orcamento_id}",
        entidade="Orcamento",
        entidade_id=orcamento_id
    ))
    db.commit()
    return None


@router.delete("/{orcamento_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_orcamento(orcamento_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """ Exclui um orçamento e seus itens. Apenas Admin ou o Vendedor dono podem excluir. """
    orcamento = db.query(models.Orcamento).filter(models.Orcamento.id == orcamento_id).first()
    if not orcamento:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")
        
    if current_user.role != 'admin' and orcamento.vendedor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas o criador ou admin podem excluir.")

    # Remove arquivos físicos dos anexos antes do cascade no banco
    anexos = db.query(models.OrcamentoAnexo).filter(models.OrcamentoAnexo.orcamento_id == orcamento_id).all()
    for anexo in anexos:
        _remover_arquivo_anexo(anexo)
        
    # Os itens serão apagados em cascata se o relacionamento estiver configurado para isso,
    # mas para garantir, apagamos manualmente:
    db.query(models.OrcamentoItem).filter(models.OrcamentoItem.orcamento_id == orcamento_id).delete()
    db.query(models.OrcamentoAnexo).filter(models.OrcamentoAnexo.orcamento_id == orcamento_id).delete()
    # Desvincula (sem apagar) lançamentos financeiros ligados a este orçamento — excluir o
    # orçamento não deve apagar o histórico financeiro nem violar a FK orcamento_id.
    db.query(models.LancamentoFinanceiro).filter(
        models.LancamentoFinanceiro.orcamento_id == orcamento_id
    ).update({"orcamento_id": None})
    db.delete(orcamento)
    
    # Grava o Log de Exclusão
    db.add(models.AuditLog(
        usuario_id=current_user.id,
        vendedor_id=orcamento.vendedor_id,
        acao="EXCLUIU_ORCAMENTO",
        detalhes=f"Excluiu o orçamento #{orcamento_id}",
        entidade="Orcamento",
        entidade_id=orcamento_id
    ))
    db.commit()
    return None


@router.put("/{orcamento_id}/status", response_model=schemas.OrcamentoOut)
def atualizar_status(orcamento_id: int, novo_status: str, cnpj_faturamento: str | None = None, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """ Transição de Status do Kanban (Arraste e Solte) """
    orcamento = db.query(models.Orcamento).filter(models.Orcamento.id == orcamento_id).first()
    if not orcamento:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")
        
    if current_user.role != 'admin' and orcamento.vendedor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas o vendedor criador pode alterar o status.")
        
    status_permitidos = ["Gerando orçamento", "Planejando", "Orçamento gerado", "Ajuste solicitado", "Orçamento negado", "Aprovado", "Entregue", "Devolvido", "Faturado"]
    if novo_status not in status_permitidos:
        raise HTTPException(status_code=400, detail=f"Status de funil inválido: {novo_status}")
        
    if novo_status in ["Aprovado", "Entregue", "Devolvido", "Faturado"]:
        pendencias = []
        cliente = db.query(models.Cliente).filter(models.Cliente.id == orcamento.cliente_id).first()
        if cliente and getattr(cliente, 'status', 'ativo') == 'pendente':
            pendencias.append("Finalizar cadastro do cliente")
        if not orcamento.condicoes_pagamento_selecionadas or orcamento.condicoes_pagamento_selecionadas == "[]":
            pendencias.append("Definir o método de pagamento")
            
        if pendencias:
            msgs = " e ".join(pendencias)
            raise HTTPException(status_code=400, detail=f"Não é possível aprovar. Pendências: {msgs}.")

    status_anterior = orcamento.status

    # Ao aprovar, exige CNPJ da whitelist configurada pelo admin (quando houver)
    if novo_status == "Aprovado" and status_anterior != "Aprovado":
        config = db.query(models.OrcamentoConfig).filter(models.OrcamentoConfig.id == 1).first()
        permitidos = cnpjs_configurados(config)
        escolhido = (cnpj_faturamento or "").strip()
        if permitidos:
            if escolhido not in permitidos:
                raise HTTPException(
                    status_code=400,
                    detail="Selecione um CNPJ de faturamento válido entre as empresas configuradas.",
                )
            orcamento.cnpj_faturamento = escolhido
        elif escolhido:
            # Sem empresas configuradas: não grava CNPJ arbitrário
            raise HTTPException(
                status_code=400,
                detail="Nenhum CNPJ de faturamento configurado. Remova a seleção ou cadastre as empresas nas configurações.",
            )

    orcamento.status = novo_status

    # Financeiro: gera/cancela o título a receber automático ao entrar/sair do grupo de
    # status que representa negócio fechado. Lançamentos já pagos não são removidos —
    # ficam como histórico mesmo se o orçamento voltar de status depois.
    financeiro_statuses = ["Aprovado", "Entregue", "Devolvido", "Faturado"]
    if novo_status in financeiro_statuses and status_anterior not in financeiro_statuses:
        valor_total = sum(item.quantidade * item.preco_unitario_aplicado for item in orcamento.itens)
        if valor_total > 0:
            db.add(models.LancamentoFinanceiro(
                tipo="ENTRADA",
                descricao=f"Orçamento #{orcamento.id} — {orcamento.tipo_orcamento}",
                valor=valor_total,
                status="pendente",
                data_vencimento=datetime.now(timezone.utc),
                automatico=True,
                orcamento_id=orcamento.id,
                usuario_id=current_user.id,
            ))
    elif status_anterior in financeiro_statuses and novo_status not in financeiro_statuses:
        db.query(models.LancamentoFinanceiro).filter(
            models.LancamentoFinanceiro.orcamento_id == orcamento.id,
            models.LancamentoFinanceiro.automatico.is_(True),
            models.LancamentoFinanceiro.status == "pendente",
        ).delete()

    if novo_status == "Aprovado" and status_anterior != "Aprovado":
        orcamento.data_aprovacao = datetime.now(timezone.utc)
        if orcamento.tipo_orcamento == "Producao" and orcamento.prazo_locacao_valor:
            if orcamento.prazo_locacao_unidade == "dias":
                orcamento.data_fim_locacao = orcamento.data_aprovacao + timedelta(days=orcamento.prazo_locacao_valor)
            elif orcamento.prazo_locacao_unidade == "meses":
                orcamento.data_fim_locacao = orcamento.data_aprovacao + timedelta(days=orcamento.prazo_locacao_valor * 30)
    elif novo_status not in ["Aprovado", "Entregue", "Devolvido", "Faturado"]:
        orcamento.data_aprovacao = None
        orcamento.data_entrega = None
        orcamento.data_fim_locacao = None
        orcamento.cnpj_faturamento = None

    if novo_status == "Entregue" and status_anterior != "Entregue":
        orcamento.data_entrega = datetime.now(timezone.utc)
        if orcamento.tipo_orcamento == "Locacao" and orcamento.prazo_locacao_valor:
            if orcamento.prazo_locacao_unidade == "dias":
                orcamento.data_fim_locacao = orcamento.data_entrega + timedelta(days=orcamento.prazo_locacao_valor)
            elif orcamento.prazo_locacao_unidade == "meses":
                orcamento.data_fim_locacao = orcamento.data_entrega + timedelta(days=orcamento.prazo_locacao_valor * 30)

    # Lógica de Estoque — batch queries para evitar N+1
    retained_statuses = ["Aprovado", "Entregue"]
    consumed_statuses = ["Faturado"]

    # Coleta os IDs de produtos internos dos itens
    produto_ids = [
        item.produto_id for item in orcamento.itens
        if item.produto_id and not item.is_externo
    ]

    if produto_ids:
        # Trava as linhas dos produtos envolvidos: evita que duas aprovações concorrentes do
        # mesmo item leiam o mesmo saldo disponível e retenham mais do que existe fisicamente.
        produtos_map = {
            p.id: p for p in db.query(models.Produto).filter(
                models.Produto.id.in_(produto_ids)
            ).with_for_update().all()
        }

        # 1. Estorno de Retenção
        if status_anterior in retained_statuses and novo_status not in retained_statuses and novo_status not in consumed_statuses:
            for item in orcamento.itens:
                p = produtos_map.get(item.produto_id) if item.produto_id and not item.is_externo else None
                if p:
                    p.quantidade_retida = max(0, p.quantidade_retida - item.quantidade)

        # 2. Nova Retenção — só reserva o que realmente está disponível (estoque - já retido)
        if status_anterior not in retained_statuses and novo_status in retained_statuses:
            for item in orcamento.itens:
                p = produtos_map.get(item.produto_id) if item.produto_id and not item.is_externo else None
                if p:
                    disponivel = p.quantidade_estoque - p.quantidade_retida
                    if disponivel < item.quantidade:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Estoque insuficiente para aprovar: '{p.nome}' tem {disponivel} unidade(s) disponível(is), mas o orçamento pede {item.quantidade}.",
                        )
            for item in orcamento.itens:
                p = produtos_map.get(item.produto_id) if item.produto_id and not item.is_externo else None
                if p:
                    p.quantidade_retida += item.quantidade

        # 3. Consumo Definitivo / Faturamento
        if novo_status in consumed_statuses and status_anterior not in consumed_statuses:
            for item in orcamento.itens:
                p = produtos_map.get(item.produto_id) if item.produto_id and not item.is_externo else None
                if p:
                    if status_anterior in retained_statuses:
                        p.quantidade_retida = max(0, p.quantidade_retida - item.quantidade)
                    p.quantidade_estoque = max(0, p.quantidade_estoque - item.quantidade)
        
    db.commit()
    db.refresh(orcamento)
    
    # Grava o Log de Status
    db.add(models.AuditLog(
        usuario_id=current_user.id,
        vendedor_id=orcamento.vendedor_id,
        acao="MUDOU_STATUS",
        detalhes=f"Alterou o status do orçamento #{orcamento.id} para '{novo_status}'" + (f" (CNPJ: {orcamento.cnpj_faturamento})" if novo_status == "Aprovado" and orcamento.cnpj_faturamento else ""),
        entidade="Orcamento",
        entidade_id=orcamento.id
    ))
    db.commit()
    return _enrich_orcamento(orcamento, detail=True)


class RenovarLocacaoRequest(schemas.BaseModel):
    prazo_valor: int
    prazo_unidade: str # "dias" ou "meses"

@router.post("/{orcamento_id}/renovar", response_model=schemas.OrcamentoDetailOut)
def renovar_locacao(orcamento_id: int, renovacao: RenovarLocacaoRequest, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """ Estende a data de fim da locação/produção baseada nos novos dias ou meses """
    orcamento = db.query(models.Orcamento).options(
        joinedload(models.Orcamento.cliente),
        joinedload(models.Orcamento.vendedor),
        selectinload(models.Orcamento.itens).joinedload(models.OrcamentoItem.produto)
    ).filter(models.Orcamento.id == orcamento_id).first()
    
    if not orcamento:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")
        
    if current_user.role != 'admin' and orcamento.vendedor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado.")
        
    if orcamento.tipo_orcamento not in ["Locacao", "Producao"]:
        raise HTTPException(status_code=400, detail="Este orçamento não é de locação ou produção.")
        
    if not orcamento.data_fim_locacao:
        raise HTTPException(status_code=400, detail="O orçamento não possui data de fim estabelecida (ainda não aprovado).")
        
    from datetime import timedelta
    
    if renovacao.prazo_unidade == "dias":
        orcamento.data_fim_locacao = orcamento.data_fim_locacao + timedelta(days=renovacao.prazo_valor)
    elif renovacao.prazo_unidade == "meses":
        orcamento.data_fim_locacao = orcamento.data_fim_locacao + timedelta(days=renovacao.prazo_valor * 30)
        
    db.commit()
    db.refresh(orcamento)
    
    return _enrich_orcamento_detail(orcamento, db)


@router.post("/{orcamento_id}/converter-venda", response_model=schemas.VendaOut, status_code=status.HTTP_201_CREATED)
def converter_em_venda(orcamento_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """Conversão explícita de um orçamento Aprovado em Venda. Não é automática: um orçamento
    aprovado pode nunca virar venda (ex: cliente desiste antes da entrega)."""
    orcamento = _get_orcamento_autorizado(orcamento_id, db, current_user)

    if orcamento.status != "Aprovado":
        raise HTTPException(status_code=400, detail="Só é possível converter em venda um orçamento com status 'Aprovado'.")

    venda_existente = db.query(models.Venda).filter(models.Venda.orcamento_id == orcamento_id).first()
    if venda_existente:
        raise HTTPException(status_code=400, detail="Este orçamento já foi convertido em venda.")

    valor_total = sum(item.quantidade * item.preco_unitario_aplicado for item in orcamento.itens)
    nova_venda = models.Venda(
        orcamento_id=orcamento.id,
        vendedor_id=orcamento.vendedor_id,
        valor_total=valor_total,
    )
    db.add(nova_venda)
    db.commit()
    db.refresh(nova_venda)

    db.add(models.AuditLog(
        usuario_id=current_user.id,
        vendedor_id=orcamento.vendedor_id,
        acao="CONVERTEU_EM_VENDA",
        detalhes=f"Converteu o orçamento #{orcamento.id} em venda (ID {nova_venda.id})",
        entidade="Venda",
        entidade_id=nova_venda.id,
    ))
    db.commit()

    nova_venda.cliente_nome = orcamento.cliente.nome_fantasia if orcamento.cliente else None
    nova_venda.vendedor_nome = orcamento.vendedor.nome if orcamento.vendedor else None
    return nova_venda


@router.post("/{orcamento_id}/regenerate-pdf")
def regenerar_pdf(orcamento_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """ Regenera o PDF de um orçamento existente """
    orcamento = db.query(models.Orcamento).options(
        joinedload(models.Orcamento.cliente),
        joinedload(models.Orcamento.vendedor),
        selectinload(models.Orcamento.itens).joinedload(models.OrcamentoItem.produto)
    ).filter(models.Orcamento.id == orcamento_id).first()
    
    if not orcamento:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado.")
    
    if current_user.role != 'admin' and orcamento.vendedor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    
    pdf_data = _build_pdf_data(orcamento, db)
    try:
        pdf_url = generate_orcamento_pdf(pdf_data)
    except Exception as e:
        print(f"[PDF] Erro ao regenerar PDF do orçamento #{orcamento_id}: {e}")
        raise HTTPException(status_code=500, detail="Falha ao gerar o PDF. Verifique os dados do orçamento (cliente, itens) por caracteres inválidos.")
    orcamento.anexo_url = pdf_url
    db.commit()

    return {"status": "PDF regenerado com sucesso", "anexo_url": pdf_url}
