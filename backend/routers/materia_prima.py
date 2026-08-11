from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/materia-prima", tags=["Matéria-prima"])


def _log(db: Session, request: Request, current_user: models.Usuario, acao: str, detalhes: str, materia_prima_id: int) -> None:
    db.add(models.AuditLog(
        usuario_id=current_user.id,
        acao=acao,
        detalhes=detalhes,
        entidade="MateriaPrima",
        entidade_id=materia_prima_id,
        ip=request.headers.get('X-Real-IP', request.client.host if request.client else None),
    ))
    db.commit()


@router.get("/", response_model=List[schemas.MateriaPrimaOut])
def listar_materia_prima(
    ativo: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista'])),
):
    query = db.query(models.MateriaPrima)
    if ativo is not None:
        query = query.filter(models.MateriaPrima.ativo == ativo)
    return query.order_by(models.MateriaPrima.nome).all()


@router.post("/", response_model=schemas.MateriaPrimaOut, status_code=status.HTTP_201_CREATED)
def criar_materia_prima(
    request: Request,
    materia_prima: schemas.MateriaPrimaCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista'])),
):
    nova = models.MateriaPrima(**materia_prima.model_dump())
    db.add(nova)
    db.commit()
    db.refresh(nova)

    _log(db, request, current_user, "CRIOU_MATERIA_PRIMA", f"Matéria-prima '{nova.nome}' criada (ID {nova.id})", nova.id)
    return nova


@router.put("/{materia_prima_id}", response_model=schemas.MateriaPrimaOut)
def atualizar_materia_prima(
    request: Request,
    materia_prima_id: int,
    materia_prima_in: schemas.MateriaPrimaUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista'])),
):
    db_materia_prima = db.query(models.MateriaPrima).filter(models.MateriaPrima.id == materia_prima_id).first()
    if not db_materia_prima:
        raise HTTPException(status_code=404, detail="Matéria-prima não encontrada.")

    for campo, valor in materia_prima_in.model_dump(exclude_unset=True).items():
        setattr(db_materia_prima, campo, valor)

    db.commit()
    db.refresh(db_materia_prima)

    _log(db, request, current_user, "EDITOU_MATERIA_PRIMA", f"Matéria-prima '{db_materia_prima.nome}' (ID {db_materia_prima.id}) editada", db_materia_prima.id)
    return db_materia_prima


@router.delete("/{materia_prima_id}", status_code=status.HTTP_204_NO_CONTENT)
def desativar_materia_prima(
    request: Request,
    materia_prima_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista'])),
):
    db_materia_prima = db.query(models.MateriaPrima).filter(models.MateriaPrima.id == materia_prima_id).first()
    if not db_materia_prima:
        raise HTTPException(status_code=404, detail="Matéria-prima não encontrada.")

    db_materia_prima.ativo = False
    db.commit()

    _log(db, request, current_user, "DESATIVOU_MATERIA_PRIMA", f"Matéria-prima '{db_materia_prima.nome}' (ID {db_materia_prima.id}) desativada", db_materia_prima.id)
    return {"ok": True}
