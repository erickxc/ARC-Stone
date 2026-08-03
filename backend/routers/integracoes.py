"""Gestão de chaves de API para integrações máquina-a-máquina (ex: extensão do SketchUp)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/integracoes", tags=["Integrações"])


def _enrich_api_key(key: models.ApiKey) -> models.ApiKey:
    usuario = getattr(key, "usuario", None)
    key.usuario_nome = usuario.nome if usuario else None
    return key


@router.post("/api-keys", response_model=schemas.ApiKeyCreated, status_code=status.HTTP_201_CREATED)
def criar_api_key(
    request: Request,
    payload: schemas.ApiKeyCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(["admin", "vendedor"])),
):
    dono_id = current_user.id
    if current_user.role == "admin" and payload.usuario_id:
        dono = db.query(models.Usuario).filter(models.Usuario.id == payload.usuario_id, models.Usuario.ativo == True).first()  # noqa: E712
        if not dono:
            raise HTTPException(status_code=404, detail="Usuário destinatário não encontrado ou inativo.")
        dono_id = dono.id

    chave_completa, prefixo, hash_chave = auth.generate_api_key()
    nova_chave = models.ApiKey(usuario_id=dono_id, nome=payload.nome, prefixo=prefixo, hash_chave=hash_chave)
    db.add(nova_chave)
    db.commit()
    db.refresh(nova_chave)

    db.add(models.AuditLog(
        usuario_id=current_user.id, acao="CRIOU_API_KEY",
        detalhes=f"Gerou a chave de API '{nova_chave.nome}' (prefixo {prefixo}) para o usuário {dono_id}",
        entidade="ApiKey", entidade_id=nova_chave.id,
        ip=request.headers.get("X-Real-IP", request.client.host if request.client else None),
    ))
    db.commit()

    return schemas.ApiKeyCreated(
        id=nova_chave.id, nome=nova_chave.nome, prefixo=nova_chave.prefixo,
        chave=chave_completa, created_at=nova_chave.created_at,
    )


@router.get("/api-keys", response_model=list[schemas.ApiKeyOut])
def listar_api_keys(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(["admin", "vendedor"])),
):
    query = db.query(models.ApiKey).options(joinedload(models.ApiKey.usuario))
    if current_user.role != "admin":
        query = query.filter(models.ApiKey.usuario_id == current_user.id)
    chaves = query.order_by(models.ApiKey.created_at.desc()).all()
    return [_enrich_api_key(k) for k in chaves]


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revogar_api_key(
    key_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(["admin", "vendedor"])),
):
    chave = db.query(models.ApiKey).filter(models.ApiKey.id == key_id).first()
    if not chave:
        raise HTTPException(status_code=404, detail="Chave não encontrada.")
    if current_user.role != "admin" and chave.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado.")

    chave.ativo = False
    chave.revoked_at = datetime.now(timezone.utc)
    db.commit()

    db.add(models.AuditLog(
        usuario_id=current_user.id, acao="REVOGOU_API_KEY",
        detalhes=f"Revogou a chave de API '{chave.nome}' (prefixo {chave.prefixo})",
        entidade="ApiKey", entidade_id=chave.id,
        ip=request.headers.get("X-Real-IP", request.client.host if request.client else None),
    ))
    db.commit()
    return None
