from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func
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


# --- Componentes do serviço (serviço composto) ---
#
# Ex: "Bancada Banheiro Completa" = Bancada + Saia + Front (obrigatórios) + Ilharga
# (opcional). Cada componente tem unidade própria porque a marmoraria mede diferente em
# cada peça, e essa unidade é copiada para o item do orçamento junto com o preço.

_gestor_servico = auth.RoleChecker(['admin', 'estoquista'])


def _get_servico(servico_id: int, db: Session) -> models.Servico:
    servico = db.query(models.Servico).filter(models.Servico.id == servico_id).first()
    if not servico:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")
    return servico


def _get_componente(servico_id: int, componente_id: int, db: Session) -> models.ServicoComponente:
    componente = db.query(models.ServicoComponente).filter(
        models.ServicoComponente.id == componente_id,
        models.ServicoComponente.servico_id == servico_id,
    ).first()
    if not componente:
        raise HTTPException(status_code=404, detail="Componente não encontrado neste serviço.")
    return componente


@router.get("/{servico_id}/componentes", response_model=List[schemas.ServicoComponenteOut])
def listar_componentes(
    servico_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.get_current_user),
):
    _get_servico(servico_id, db)
    return db.query(models.ServicoComponente).filter(
        models.ServicoComponente.servico_id == servico_id
    ).order_by(models.ServicoComponente.ordem.asc(), models.ServicoComponente.id.asc()).all()


@router.post("/{servico_id}/componentes", response_model=schemas.ServicoComponenteOut, status_code=status.HTTP_201_CREATED)
def criar_componente(
    request: Request,
    servico_id: int,
    dados: schemas.ServicoComponenteCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(_gestor_servico),
):
    servico = _get_servico(servico_id, db)
    proxima_ordem = (db.query(func.coalesce(func.max(models.ServicoComponente.ordem), 0))
                     .filter(models.ServicoComponente.servico_id == servico_id).scalar() or 0) + 1
    componente = models.ServicoComponente(**dados.model_dump(), servico_id=servico_id, ordem=proxima_ordem)
    db.add(componente)
    db.commit()
    db.refresh(componente)

    _log(db, request, current_user, "CRIOU_COMPONENTE_SERVICO",
         f"Componente '{componente.nome}' adicionado ao serviço '{servico.nome}'", servico_id)
    return componente


@router.patch("/{servico_id}/componentes/{componente_id}", response_model=schemas.ServicoComponenteOut)
def atualizar_componente(
    request: Request,
    servico_id: int,
    componente_id: int,
    dados: schemas.ServicoComponenteUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(_gestor_servico),
):
    componente = _get_componente(servico_id, componente_id, db)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(componente, campo, valor)
    db.commit()
    db.refresh(componente)

    _log(db, request, current_user, "EDITOU_COMPONENTE_SERVICO",
         f"Componente '{componente.nome}' (ID {componente.id}) editado", servico_id)
    return componente


@router.delete("/{servico_id}/componentes/{componente_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_componente(
    request: Request,
    servico_id: int,
    componente_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(_gestor_servico),
):
    componente = _get_componente(servico_id, componente_id, db)
    # Itens de orçamento já emitidos guardam nome, preço e unidade próprios (congelados),
    # então excluir o componente do catálogo não altera histórico.
    nome = componente.nome
    db.delete(componente)
    db.commit()

    _log(db, request, current_user, "EXCLUIU_COMPONENTE_SERVICO",
         f"Componente '{nome}' removido do serviço (ID {servico_id})", servico_id)
    return None
