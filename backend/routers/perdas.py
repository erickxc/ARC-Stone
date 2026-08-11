from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.exc import StaleDataError
from typing import List
from database import get_db
import models, schemas, auth
from routers.estoque import registrar_movimentacao

router = APIRouter(prefix="/perdas", tags=["Perdas e Avarias"])


def _serializar(perda: models.PerdaAvaria) -> models.PerdaAvaria:
    perda.produto_nome = perda.produto.nome if perda.produto else None
    perda.usuario_nome = perda.usuario.nome if perda.usuario else None
    return perda


@router.get("/", response_model=List[schemas.PerdaAvariaOut])
def listar_perdas(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista'])),
):
    perdas = (
        db.query(models.PerdaAvaria)
        .options(joinedload(models.PerdaAvaria.produto), joinedload(models.PerdaAvaria.usuario))
        .order_by(models.PerdaAvaria.data_ocorrencia.desc())
        .all()
    )
    return [_serializar(p) for p in perdas]


@router.post("/", response_model=schemas.PerdaAvariaOut, status_code=status.HTTP_201_CREATED)
def registrar_perda(
    request: Request,
    perda_in: schemas.PerdaAvariaCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista'])),
):
    try:
        produto = registrar_movimentacao(
            db,
            produto_id=perda_in.produto_id,
            quantidade=perda_in.quantidade,
            tipo='SAIDA',
            usuario_id=current_user.id,
            justificativa=f"Perda/avaria: {perda_in.justificativa}",
        )

        nova_perda = models.PerdaAvaria(
            produto_id=perda_in.produto_id,
            usuario_id=current_user.id,
            quantidade=perda_in.quantidade,
            motivo=perda_in.motivo,
            justificativa=perda_in.justificativa,
        )
        db.add(nova_perda)
        db.commit()
        db.refresh(nova_perda)

        db.add(models.AuditLog(
            usuario_id=current_user.id,
            acao="REGISTROU_PERDA_AVARIA",
            detalhes=f"Perda/avaria de {perda_in.quantidade}un do produto '{produto.nome}' (ID {produto.id}). Motivo: {perda_in.motivo}",
            entidade="PerdaAvaria", entidade_id=nova_perda.id,
            ip=request.headers.get('X-Real-IP', request.client.host if request.client else None),
        ))
        db.commit()

        db.refresh(nova_perda)
        return _serializar(nova_perda)
    except StaleDataError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Conflito de concorrência: o estoque deste item foi atualizado por outra pessoa. Tente novamente.",
        )
