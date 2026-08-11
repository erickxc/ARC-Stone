"""Endpoints públicos do portal de aprovação de propostas."""

import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload, selectinload

import auth
import models
import schemas
from database import get_db
from anexo_utils import anexo_disk_path
from rate_limiter import limiter


router = APIRouter(prefix="/portal", tags=["Portal do Cliente"])

STATUS_PUBLICO = {
    "Gerando orçamento": "Em elaboração",
    "Planejando": "Em elaboração",
    "Orçamento gerado": "Aguardando sua aprovação",
    "Ajuste solicitado": "Ajuste solicitado por você",
    "Aprovado": "Aprovada — produção liberada",
    "Entregue": "Entregue",
    "Faturado": "Concluída",
    "Devolvido": "Encerrada",
    "Orçamento negado": "Encerrada",
}


def _carregar_proposta(db: Session, orcamento_id: int) -> models.Orcamento:
    """Carrega somente relações necessárias para montar a resposta pública."""
    proposta = (
        db.query(models.Orcamento)
        .populate_existing()
        .options(
            joinedload(models.Orcamento.cliente),
            joinedload(models.Orcamento.vendedor),
            selectinload(models.Orcamento.itens).joinedload(models.OrcamentoItem.produto),
            selectinload(models.Orcamento.anexos),
        )
        .filter(models.Orcamento.id == orcamento_id)
        .first()
    )
    if not proposta:
        raise HTTPException(status_code=404, detail="Proposta não encontrada.")
    return proposta


def _travar_proposta(db: Session, orcamento_id: int) -> models.Orcamento:
    """Trava apenas a linha do orçamento, sem eager loading.

    O PostgreSQL recusa FOR UPDATE sobre o lado nulável de um outer join,
    que é o que joinedload gera para as relações opcionais da proposta.
    """
    proposta = (
        db.query(models.Orcamento)
        .filter(models.Orcamento.id == orcamento_id)
        .with_for_update()
        .first()
    )
    if not proposta:
        raise HTTPException(status_code=404, detail="Proposta não encontrada.")
    return proposta


def _formatar_condicoes(raw: str | None) -> str | None:
    """Converte JSON/CSV legado em texto curto, sem devolver o valor bruto."""
    if not raw or raw == "[]":
        return None
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return raw.strip() or None
    if isinstance(parsed, list):
        valores = []
        for item in parsed:
            if isinstance(item, dict):
                valores.append(str(item.get("nome") or item.get("descricao") or ""))
            else:
                valores.append(str(item))
        return ", ".join(valor for valor in valores if valor) or None
    return str(parsed)


def _foto_publica(value: str | None) -> str | None:
    """Nunca transforma caminho de disco interno em campo público."""
    if not value:
        return None
    if value.startswith(("https://", "http://")):
        return value
    return None


def _co_marca(db: Session) -> str | None:
    """Nome do escritório exibido ao lado da marca no portal do cliente."""
    config = db.query(models.OrcamentoConfig).first()
    return (config.organizacao_nome or None) if config else None


def _publicar_proposta(proposta: models.Orcamento, organizacao_nome: str | None = None) -> schemas.PortalPropostaOut:
    """Projeta o orçamento para o contrato público, omitindo campos internos."""
    itens = []
    for item in proposta.itens:
        produto = item.produto
        nome = produto.nome if produto else (item.nome_externo or "Item")
        descricao = item.descricao_externa or item.personalizacao_aplicada
        preco_unitario = item.preco_unitario_aplicado
        itens.append(
            schemas.PortalItemOut(
                nome=nome,
                descricao=descricao,
                quantidade=item.quantidade,
                preco_unitario=preco_unitario,
                # Mesma fórmula do resto do sistema (ver schemas.calcular_total_linha):
                # item medido em m²/metro não é quantidade × preço.
                subtotal=schemas.calcular_total_linha(
                    unidade_medida=getattr(item, 'unidade_medida', None) or 'un',
                    quantidade=item.quantidade,
                    preco_unitario=preco_unitario,
                    area_m2=float(getattr(item, 'area_m2', None)) if getattr(item, 'area_m2', None) is not None else None,
                    comprimento_m=float(getattr(item, 'comprimento_m', None)) if getattr(item, 'comprimento_m', None) is not None else None,
                    acrescimo_centavos=getattr(item, 'acrescimo_centavos', 0) or 0,
                    desconto_centavos=getattr(item, 'desconto_centavos', 0) or 0,
                ),
                local_instalacao=item.local_instalacao,
                prazo_entrega_valor=item.prazo_entrega_valor,
                prazo_entrega_unidade=item.prazo_entrega_unidade,
                foto_url=_foto_publica(produto.foto_url if produto else item.foto_externa_url),
            )
        )

    documentos = [
        schemas.PortalDocumentoOut(
            id=anexo.id,
            nome_original=anexo.nome_original,
            extensao=anexo.extensao,
            tamanho=anexo.tamanho,
            created_at=anexo.created_at,
        )
        for anexo in proposta.anexos
        if anexo.visivel_cliente
    ]
    return schemas.PortalPropostaOut(
        organizacao_nome=organizacao_nome,
        orcamento_id=proposta.id,
        numero_exibicao=f"ORC-{proposta.id:04d}",
        tipo_orcamento=proposta.tipo_orcamento,
        status_publico=STATUS_PUBLICO.get(proposta.status, "Em elaboração"),
        cliente_nome=proposta.cliente.nome_fantasia,
        itens=itens,
        valor_total=sum(item.subtotal for item in itens),
        condicoes_pagamento=_formatar_condicoes(proposta.condicoes_pagamento_selecionadas),
        documentos=documentos,
        tem_pdf_proposta=bool(proposta.anexo_url),
        data_entrega=proposta.data_entrega,
        arquiteto_nome=proposta.arquiteto_nome,
        arquiteto_contato=proposta.arquiteto_contato,
        decisao_cliente=proposta.decisao_cliente,
        decisao_cliente_nome=proposta.decisao_cliente_nome,
        decisao_cliente_motivo=proposta.decisao_cliente_motivo,
        decisao_cliente_em=proposta.decisao_cliente_em,
        criado_em=proposta.created_at,
    )


def _proposta_autorizada(
    request: Request,
    db: Session = Depends(get_db),
) -> models.Orcamento:
    """Dependência única: token mágico é validado antes de qualquer dado público."""
    return auth.get_portal_orcamento(request, db)


@router.get("/proposta", response_model=schemas.PortalPropostaOut)
@limiter.limit("30/minute")
def obter_proposta(
    request: Request,
    proposta: models.Orcamento = Depends(_proposta_autorizada),
    db: Session = Depends(get_db),
):
    proposta = _carregar_proposta(db, proposta.id)
    return _publicar_proposta(proposta, _co_marca(db))


@router.post("/decisao", response_model=schemas.PortalPropostaOut)
@limiter.limit("5/minute")
def registrar_decisao(
    request: Request,
    decisao: schemas.PortalDecisaoIn,
    proposta: models.Orcamento = Depends(_proposta_autorizada),
    db: Session = Depends(get_db),
):
    proposta = _travar_proposta(db, proposta.id)
    if proposta.status not in ("Orçamento gerado", "Ajuste solicitado"):
        raise HTTPException(status_code=409, detail="Esta proposta não está aberta para decisão.")
    if proposta.decisao_cliente:
        raise HTTPException(status_code=409, detail="Uma decisão já foi registrada para esta proposta.")

    agora = datetime.now(timezone.utc)
    proposta.decisao_cliente = "aprovado" if decisao.acao == "aprovar" else "recusado"
    proposta.decisao_cliente_nome = decisao.nome.strip()
    proposta.decisao_cliente_em = agora
    proposta.decisao_cliente_motivo = decisao.motivo.strip() if decisao.motivo else None
    if decisao.acao == "recusar":
        # Recusa não usa atualizar_status: não pode reservar estoque, criar financeiro
        # ou exigir CNPJ antes de a equipe tratar o ajuste solicitado.
        proposta.status = "Ajuste solicitado"

    ip = request.headers.get("X-Real-IP", request.client.host if request.client else "127.0.0.1")
    db.add(
        models.AuditLog(
            usuario_id=None,
            vendedor_id=proposta.vendedor_id,
            acao="DECISAO_CLIENTE",
            detalhes=f"Cliente {proposta.decisao_cliente} orçamento #{proposta.id}; nome={proposta.decisao_cliente_nome}",
            entidade="Orcamento",
            entidade_id=proposta.id,
            ip=ip,
        )
    )
    db.commit()

    try:
        if proposta.vendedor and proposta.vendedor.email:
            auth.send_portal_decision_email(
                proposta.vendedor.email,
                proposta.id,
                decisao.acao,
                proposta.decisao_cliente_nome,
                proposta.decisao_cliente_motivo,
            )
    except Exception as exc:
        # Notificação é secundária; a decisão persistida nunca deve ser desfeita.
        print(f"Erro ao notificar decisão do portal: {exc}")

    return _publicar_proposta(_carregar_proposta(db, proposta.id), _co_marca(db))


def _registrar_download(
    db: Session,
    request: Request,
    proposta: models.Orcamento,
    nome_documento: str,
):
    """Registra acesso público sem associar a decisão a usuário interno."""
    db.add(
        models.AuditLog(
            usuario_id=None,
            vendedor_id=proposta.vendedor_id,
            acao="BAIXOU_DOCUMENTO_PORTAL",
            detalhes=f"Cliente baixou '{nome_documento}' do orçamento #{proposta.id}",
            entidade="Orcamento",
            entidade_id=proposta.id,
            ip=request.headers.get("X-Real-IP", request.client.host if request.client else "127.0.0.1"),
        )
    )
    db.commit()


@router.get("/anexos/{anexo_id}/download")
@limiter.limit("60/minute")
def baixar_anexo(
    anexo_id: int,
    request: Request,
    proposta: models.Orcamento = Depends(_proposta_autorizada),
    db: Session = Depends(get_db),
):
    """Baixa apenas anexo liberado pertencente ao orçamento do token."""
    anexo = db.query(models.OrcamentoAnexo).filter(
        models.OrcamentoAnexo.id == anexo_id,
        models.OrcamentoAnexo.orcamento_id == proposta.id,
        models.OrcamentoAnexo.visivel_cliente.is_(True),
    ).first()
    if not anexo:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")

    file_path = anexo_disk_path(anexo.url)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    _registrar_download(db, request, proposta, anexo.nome_original)
    return FileResponse(
        path=file_path,
        filename=anexo.nome_original,
        media_type="application/octet-stream",
        content_disposition_type="attachment",
    )


@router.get("/proposta/pdf")
@limiter.limit("60/minute")
def baixar_pdf_proposta(
    request: Request,
    proposta: models.Orcamento = Depends(_proposta_autorizada),
    db: Session = Depends(get_db),
):
    """Baixa o PDF já gerado, sem regenerá-lo em uma requisição pública."""
    if not proposta.anexo_url:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    file_path = anexo_disk_path(proposta.anexo_url)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    _registrar_download(db, request, proposta, f"proposta_{proposta.id}.pdf")
    return FileResponse(
        path=file_path,
        filename=f"proposta_{proposta.id}.pdf",
        media_type="application/octet-stream",
        content_disposition_type="attachment",
    )
