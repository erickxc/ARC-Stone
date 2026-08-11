"""Esteira de produção: acompanha o que foi vendido enquanto passa pela oficina.

A `OrdemProducao` nasce automaticamente junto com a `Venda` (ver `_criar_venda` em
routers/orcamentos.py) — vendeu, tem que produzir. Ela avança por etapas configuráveis
(catálogo `EtapaProducao`) e pode VOLTAR: peça que quebra no corte refaz o caminho.
Cada transição fica no histórico, senão não dá para saber onde a peça travou.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload, selectinload
from datetime import datetime, timezone

from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/producao", tags=["Esteira de produção"])

# Quem toca a oficina: admin e estoquista. Vendedor acompanha, não move.
_gestor_producao = auth.RoleChecker(["admin", "estoquista"])


def primeira_etapa(db: Session) -> models.EtapaProducao | None:
    """Etapa em que toda ordem nova entra."""
    return (
        db.query(models.EtapaProducao)
        .filter(models.EtapaProducao.ativo.is_(True))
        .order_by(models.EtapaProducao.ordem.asc(), models.EtapaProducao.id.asc())
        .first()
    )


def criar_ordem_para_venda(venda: models.Venda, db: Session, usuario_id: int | None = None) -> models.OrdemProducao | None:
    """Abre a ordem de produção de uma venda recém-criada.

    Sem commit: quem chama controla a transação (a venda direta cria orçamento, venda e
    ordem no mesmo request). Devolve None se não houver etapa ativa configurada — nesse
    caso a venda acontece normalmente, só não entra na esteira.
    """
    etapa = primeira_etapa(db)
    if not etapa:
        return None
    ordem = models.OrdemProducao(venda_id=venda.id, etapa_id=etapa.id)
    db.add(ordem)
    db.flush()
    db.add(models.OrdemProducaoEtapa(
        ordem_id=ordem.id, etapa_id=etapa.id, usuario_id=usuario_id,
        observacao="Ordem aberta automaticamente pela venda.",
    ))
    return ordem


def _expandir(ordem: models.OrdemProducao, com_historico: bool = False) -> schemas.OrdemProducaoOut:
    saida = schemas.OrdemProducaoOut.model_validate(ordem)
    saida.etapa_nome = ordem.etapa.nome if ordem.etapa else None
    saida.etapa_is_final = bool(ordem.etapa and ordem.etapa.is_final)
    saida.responsavel_nome = ordem.responsavel.nome if ordem.responsavel else None

    venda = ordem.venda
    orcamento = venda.orcamento if venda else None
    saida.valor_total = venda.valor_total if venda else None
    saida.orcamento_id = orcamento.id if orcamento else None
    saida.vendedor_nome = venda.vendedor.nome if venda and venda.vendedor else None
    saida.cliente_nome = orcamento.cliente.nome_fantasia if orcamento and orcamento.cliente else None
    if orcamento:
        nomes = []
        for item in orcamento.itens:
            if item.produto:
                nomes.append(f"{item.quantidade}x {item.produto.nome}")
            elif item.servico:
                nomes.append(f"{item.quantidade}x {item.servico.nome}")
            elif item.nome_externo:
                nomes.append(f"{item.quantidade}x {item.nome_externo}")
        saida.resumo_itens = ", ".join(nomes) or None

    if com_historico:
        saida.historico = [
            schemas.OrdemProducaoEtapaOut(
                id=h.id, etapa_id=h.etapa_id,
                etapa_nome=h.etapa.nome if h.etapa else None,
                usuario_nome=h.usuario.nome if h.usuario else None,
                observacao=h.observacao, registrado_em=h.registrado_em,
            )
            for h in ordem.historico
        ]
    else:
        saida.historico = []
    return saida


def _query_base(db: Session):
    return db.query(models.OrdemProducao).options(
        joinedload(models.OrdemProducao.etapa),
        joinedload(models.OrdemProducao.responsavel),
        joinedload(models.OrdemProducao.venda).joinedload(models.Venda.vendedor),
        joinedload(models.OrdemProducao.venda)
        .joinedload(models.Venda.orcamento)
        .joinedload(models.Orcamento.cliente),
        joinedload(models.OrdemProducao.venda)
        .joinedload(models.Venda.orcamento)
        .selectinload(models.Orcamento.itens)
        .joinedload(models.OrcamentoItem.produto),
        joinedload(models.OrdemProducao.venda)
        .joinedload(models.Venda.orcamento)
        .selectinload(models.Orcamento.itens)
        .joinedload(models.OrcamentoItem.servico),
    )


def _autorizar(ordem: models.OrdemProducao, current_user: models.Usuario) -> None:
    """Vendedor só enxerga a produção das próprias vendas; admin e estoquista veem tudo."""
    if current_user.role in ("admin", "estoquista"):
        return
    if ordem.venda and ordem.venda.vendedor_id == current_user.id:
        return
    raise HTTPException(status_code=403, detail="Esta ordem pertence à venda de outro vendedor.")


@router.get("/ordens", response_model=list[schemas.OrdemProducaoOut])
def listar_ordens(
    incluir_concluidas: bool = False,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.get_current_user),
):
    """Esteira ativa. Ordem em etapa final só aparece com `incluir_concluidas=true` —
    senão a oficina afoga o quadro com o que já saiu."""
    query = _query_base(db)
    if current_user.role not in ("admin", "estoquista"):
        query = query.join(models.Venda).filter(models.Venda.vendedor_id == current_user.id)
    if not incluir_concluidas:
        query = query.filter(models.OrdemProducao.concluida_em.is_(None))
    ordens = query.order_by(models.OrdemProducao.created_at.desc()).all()
    return [_expandir(o) for o in ordens]


@router.get("/ordens/{ordem_id}", response_model=schemas.OrdemProducaoOut)
def obter_ordem(
    ordem_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.get_current_user),
):
    ordem = _query_base(db).options(
        selectinload(models.OrdemProducao.historico).joinedload(models.OrdemProducaoEtapa.etapa),
        selectinload(models.OrdemProducao.historico).joinedload(models.OrdemProducaoEtapa.usuario),
    ).filter(models.OrdemProducao.id == ordem_id).first()
    if not ordem:
        raise HTTPException(status_code=404, detail="Ordem de produção não encontrada.")
    _autorizar(ordem, current_user)
    return _expandir(ordem, com_historico=True)


@router.patch("/ordens/{ordem_id}/mover", response_model=schemas.OrdemProducaoOut)
def mover_ordem(
    request: Request,
    ordem_id: int,
    dados: schemas.OrdemProducaoMoverIn,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(_gestor_producao),
):
    """Move a ordem para outra etapa, registrando a transição no histórico.

    Movimento para trás é permitido de propósito: peça que quebra no corte volta.
    """
    ordem = _query_base(db).filter(models.OrdemProducao.id == ordem_id).first()
    if not ordem:
        raise HTTPException(status_code=404, detail="Ordem de produção não encontrada.")

    etapa = db.query(models.EtapaProducao).filter(
        models.EtapaProducao.id == dados.etapa_id,
        models.EtapaProducao.ativo.is_(True),
    ).first()
    if not etapa:
        raise HTTPException(status_code=404, detail="Etapa não encontrada ou inativa.")
    if etapa.id == ordem.etapa_id:
        return _expandir(ordem)

    ordem.etapa_id = etapa.id
    # Etapa final fecha a ordem; voltar de uma final reabre (retrabalho acontece).
    ordem.concluida_em = datetime.now(timezone.utc) if etapa.is_final else None
    db.add(models.OrdemProducaoEtapa(
        ordem_id=ordem.id, etapa_id=etapa.id,
        usuario_id=current_user.id, observacao=dados.observacao,
    ))
    db.add(models.AuditLog(
        usuario_id=current_user.id,
        acao="MOVEU_PRODUCAO",
        detalhes=f"Ordem #{ordem.id} movida para '{etapa.nome}'",
        entidade="OrdemProducao",
        entidade_id=ordem.id,
        ip=request.headers.get('X-Real-IP', request.client.host if request.client else None),
    ))
    db.commit()
    db.refresh(ordem)
    return _expandir(ordem)


@router.patch("/ordens/{ordem_id}", response_model=schemas.OrdemProducaoOut)
def atualizar_ordem(
    ordem_id: int,
    dados: schemas.OrdemProducaoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(_gestor_producao),
):
    ordem = _query_base(db).filter(models.OrdemProducao.id == ordem_id).first()
    if not ordem:
        raise HTTPException(status_code=404, detail="Ordem de produção não encontrada.")
    alteracoes = dados.model_dump(exclude_unset=True)
    if "responsavel_id" in alteracoes and alteracoes["responsavel_id"] is not None:
        existe = db.query(models.Usuario).filter(
            models.Usuario.id == alteracoes["responsavel_id"],
            models.Usuario.ativo.is_(True),
        ).first()
        if not existe:
            raise HTTPException(status_code=404, detail="Responsável não encontrado ou inativo.")
    for campo, valor in alteracoes.items():
        setattr(ordem, campo, valor)
    db.commit()
    db.refresh(ordem)
    return _expandir(ordem)
