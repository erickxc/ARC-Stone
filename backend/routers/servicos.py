from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/servicos", tags=["Serviços"])


def _log(db: Session, request: Request, current_user: models.Usuario, acao: str, detalhes: str, servico_id: int) -> None:
    db.add(models.AuditLog(
        usuario_id=current_user.id,
        acao=acao,
        detalhes=detalhes,
        entidade="Servico",
        entidade_id=servico_id,
        ip=request.headers.get('X-Real-IP', request.client.host if request.client else None),
    ))
    db.commit()


@router.get("/", response_model=List[schemas.ServicoOut])
def listar_servicos(
    ativo: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.get_current_user),
):
    query = db.query(models.Servico)
    if ativo is not None:
        query = query.filter(models.Servico.ativo == ativo)
    return query.order_by(models.Servico.nome).all()


@router.post("/", response_model=schemas.ServicoOut, status_code=status.HTTP_201_CREATED)
def criar_servico(
    request: Request,
    servico: schemas.ServicoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista'])),
):
    novo_servico = models.Servico(**servico.model_dump())
    db.add(novo_servico)
    db.commit()
    db.refresh(novo_servico)

    _log(db, request, current_user, "CRIOU_SERVICO", f"Serviço '{novo_servico.nome}' criado (ID {novo_servico.id})", novo_servico.id)
    return novo_servico


@router.put("/{servico_id}", response_model=schemas.ServicoOut)
def atualizar_servico(
    request: Request,
    servico_id: int,
    servico_in: schemas.ServicoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista'])),
):
    db_servico = db.query(models.Servico).filter(models.Servico.id == servico_id).first()
    if not db_servico:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    for campo, valor in servico_in.model_dump(exclude_unset=True).items():
        setattr(db_servico, campo, valor)

    db.commit()
    db.refresh(db_servico)

    _log(db, request, current_user, "EDITOU_SERVICO", f"Serviço '{db_servico.nome}' (ID {db_servico.id}) editado", db_servico.id)
    return db_servico


@router.delete("/{servico_id}", status_code=status.HTTP_204_NO_CONTENT)
def desativar_servico(
    request: Request,
    servico_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista'])),
):
    db_servico = db.query(models.Servico).filter(models.Servico.id == servico_id).first()
    if not db_servico:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    db_servico.ativo = False  # Soft delete — igual a Fornecedor/Produto
    db.commit()

    _log(db, request, current_user, "DESATIVOU_SERVICO", f"Serviço '{db_servico.nome}' (ID {db_servico.id}) desativado", db_servico.id)
    return {"ok": True}
