from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/equipamentos", tags=["Equipamentos"])


def _log(db: Session, request: Request, current_user: models.Usuario, acao: str, detalhes: str, equipamento_id: int) -> None:
    db.add(models.AuditLog(
        usuario_id=current_user.id,
        acao=acao,
        detalhes=detalhes,
        entidade="Equipamento",
        entidade_id=equipamento_id,
        ip=request.headers.get('X-Real-IP', request.client.host if request.client else None),
    ))
    db.commit()


@router.get("/", response_model=List[schemas.EquipamentoOut])
def listar_equipamentos(
    ativo: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista'])),
):
    query = db.query(models.Equipamento)
    if ativo is not None:
        query = query.filter(models.Equipamento.ativo == ativo)
    return query.order_by(models.Equipamento.nome).all()


@router.post("/", response_model=schemas.EquipamentoOut, status_code=status.HTTP_201_CREATED)
def criar_equipamento(
    request: Request,
    equipamento: schemas.EquipamentoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista'])),
):
    novo_equipamento = models.Equipamento(**equipamento.model_dump())
    db.add(novo_equipamento)
    db.commit()
    db.refresh(novo_equipamento)

    _log(db, request, current_user, "CRIOU_EQUIPAMENTO", f"Equipamento '{novo_equipamento.nome}' criado (ID {novo_equipamento.id})", novo_equipamento.id)
    return novo_equipamento


@router.put("/{equipamento_id}", response_model=schemas.EquipamentoOut)
def atualizar_equipamento(
    request: Request,
    equipamento_id: int,
    equipamento_in: schemas.EquipamentoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista'])),
):
    db_equipamento = db.query(models.Equipamento).filter(models.Equipamento.id == equipamento_id).first()
    if not db_equipamento:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")

    for campo, valor in equipamento_in.model_dump(exclude_unset=True).items():
        setattr(db_equipamento, campo, valor)

    db.commit()
    db.refresh(db_equipamento)

    _log(db, request, current_user, "EDITOU_EQUIPAMENTO", f"Equipamento '{db_equipamento.nome}' (ID {db_equipamento.id}) editado", db_equipamento.id)
    return db_equipamento


@router.delete("/{equipamento_id}", status_code=status.HTTP_204_NO_CONTENT)
def desativar_equipamento(
    request: Request,
    equipamento_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista'])),
):
    db_equipamento = db.query(models.Equipamento).filter(models.Equipamento.id == equipamento_id).first()
    if not db_equipamento:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado.")

    db_equipamento.ativo = False
    db.commit()

    _log(db, request, current_user, "DESATIVOU_EQUIPAMENTO", f"Equipamento '{db_equipamento.nome}' (ID {db_equipamento.id}) desativado", db_equipamento.id)
    return {"ok": True}
