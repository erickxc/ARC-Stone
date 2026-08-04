from datetime import datetime, timezone
from typing import Optional

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db

router = APIRouter(prefix="/financeiro", tags=["Financeiro"])


def _periodo_inicio(periodo: str) -> datetime:
    agora = datetime.now(timezone.utc)
    inicio_mes = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if periodo == "Trimestre":
        return inicio_mes - relativedelta(months=2)
    return inicio_mes


def _marcar_vencido(lancamento: models.LancamentoFinanceiro) -> models.LancamentoFinanceiro:
    agora = datetime.now(timezone.utc)
    lancamento.vencido = lancamento.status == "pendente" and lancamento.data_vencimento < agora
    return lancamento


@router.get("/resumo", response_model=schemas.FinanceiroResumoOut)
def resumo(
    periodo: str = "Mês",
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin'])),
):
    inicio = _periodo_inicio(periodo)
    agora = datetime.now(timezone.utc)

    pendentes_entrada = db.query(models.LancamentoFinanceiro).filter(
        models.LancamentoFinanceiro.tipo == "ENTRADA",
        models.LancamentoFinanceiro.status == "pendente",
    ).all()
    a_receber = sum(l.valor for l in pendentes_entrada)
    vencidos = sum(l.valor for l in pendentes_entrada if l.data_vencimento < agora)

    recebido_no_periodo = db.query(models.LancamentoFinanceiro).filter(
        models.LancamentoFinanceiro.tipo == "ENTRADA",
        models.LancamentoFinanceiro.status == "pago",
        models.LancamentoFinanceiro.data_pagamento >= inicio,
    ).all()
    recebido_total = sum(l.valor for l in recebido_no_periodo)

    # Margem média aproximada: usa o preço congelado do item (venda) vs. o custo atual do
    # produto (o custo não é congelado por item — só o preço de venda é). Considera apenas
    # orçamentos aprovados dentro do período.
    itens = db.query(models.OrcamentoItem).join(models.Orcamento).join(
        models.Produto, models.OrcamentoItem.produto_id == models.Produto.id
    ).filter(
        models.Orcamento.data_aprovacao >= inicio,
        models.OrcamentoItem.is_externo.is_(False),
    ).all()
    soma_venda = sum(i.quantidade * i.preco_unitario_aplicado for i in itens)
    soma_custo = sum(i.quantidade * i.produto.preco_custo for i in itens if i.produto)
    margem_media = round((soma_venda - soma_custo) / soma_venda * 100, 1) if soma_venda > 0 else None

    return schemas.FinanceiroResumoOut(
        a_receber=a_receber,
        recebido_no_periodo=recebido_total,
        vencidos=vencidos,
        margem_media=margem_media,
        titulos_abertos=len(pendentes_entrada),
    )


@router.get("/lancamentos", response_model=list[schemas.LancamentoOut])
def listar_lancamentos(
    tipo: Optional[str] = None,
    lancamento_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin'])),
):
    query = db.query(models.LancamentoFinanceiro)
    if tipo:
        query = query.filter(models.LancamentoFinanceiro.tipo == tipo)
    if lancamento_status:
        query = query.filter(models.LancamentoFinanceiro.status == lancamento_status)
    lancamentos = query.order_by(models.LancamentoFinanceiro.data_vencimento.desc()).all()
    return [_marcar_vencido(l) for l in lancamentos]


@router.post("/lancamentos", response_model=schemas.LancamentoOut, status_code=status.HTTP_201_CREATED)
def criar_lancamento(
    request: Request,
    lancamento_in: schemas.LancamentoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin'])),
):
    novo = models.LancamentoFinanceiro(
        tipo=lancamento_in.tipo,
        descricao=lancamento_in.descricao,
        categoria=lancamento_in.categoria,
        valor=lancamento_in.valor,
        status="pendente",
        data_vencimento=lancamento_in.data_vencimento,
        automatico=False,
        usuario_id=current_user.id,
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)

    db.add(models.AuditLog(
        usuario_id=current_user.id,
        acao="CRIOU_LANCAMENTO",
        detalhes=f"Criou lançamento '{novo.descricao}' ({novo.tipo}, R$ {novo.valor / 100:.2f})",
        entidade="LancamentoFinanceiro", entidade_id=novo.id,
        ip=request.headers.get('X-Real-IP', request.client.host if request.client else None),
    ))
    db.commit()
    return _marcar_vencido(novo)


@router.patch("/lancamentos/{lancamento_id}/pagar", response_model=schemas.LancamentoOut)
def marcar_pago(
    request: Request,
    lancamento_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin'])),
):
    lancamento = db.query(models.LancamentoFinanceiro).filter(
        models.LancamentoFinanceiro.id == lancamento_id
    ).first()
    if not lancamento:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado.")
    if lancamento.status == "pago":
        raise HTTPException(status_code=400, detail="Lançamento já está pago.")

    lancamento.status = "pago"
    lancamento.data_pagamento = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lancamento)

    db.add(models.AuditLog(
        usuario_id=current_user.id,
        acao="PAGOU_LANCAMENTO",
        detalhes=f"Marcou lançamento #{lancamento.id} ('{lancamento.descricao}') como pago",
        entidade="LancamentoFinanceiro", entidade_id=lancamento.id,
        ip=request.headers.get('X-Real-IP', request.client.host if request.client else None),
    ))
    db.commit()
    return _marcar_vencido(lancamento)


@router.get("/fluxo-mensal", response_model=list[schemas.FluxoMensalItem])
def fluxo_mensal(
    meses: int = 6,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin'])),
):
    agora = datetime.now(timezone.utc)
    inicio_mes_atual = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    inicio_janela = inicio_mes_atual - relativedelta(months=meses - 1)

    lancamentos = db.query(models.LancamentoFinanceiro).filter(
        models.LancamentoFinanceiro.status == "pago",
        models.LancamentoFinanceiro.data_pagamento >= inicio_janela,
    ).all()

    buckets: dict[str, dict[str, int]] = {}
    for i in range(meses):
        chave = (inicio_janela + relativedelta(months=i)).strftime("%Y-%m")
        buckets[chave] = {"entradas": 0, "saidas": 0}

    for l in lancamentos:
        chave = l.data_pagamento.strftime("%Y-%m")
        if chave in buckets:
            if l.tipo == "ENTRADA":
                buckets[chave]["entradas"] += l.valor
            else:
                buckets[chave]["saidas"] += l.valor

    return [
        schemas.FluxoMensalItem(mes=chave, entradas=v["entradas"], saidas=v["saidas"])
        for chave, v in buckets.items()
    ]
