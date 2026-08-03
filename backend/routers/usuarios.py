from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/usuarios", tags=["Gestão de Equipe"])

@router.get("/me", response_model=schemas.UsuarioOut)
def obter_meu_perfil(current_user: models.Usuario = Depends(auth.get_current_user)):
    return current_user

@router.get("/", response_model=list[schemas.UsuarioOut])
def listar_equipe(db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Apenas administradores podem gerenciar a equipe.")
    return db.query(models.Usuario).all()

@router.post("/", response_model=schemas.UsuarioOut, status_code=status.HTTP_201_CREATED)
def criar_funcionario(request: Request, user: schemas.UsuarioCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Apenas administradores podem contratar funcionários.")
    
    db_user = db.query(models.Usuario).filter(models.Usuario.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="E-mail já corporativo em uso.")
    
    hashed_pwd = auth.get_password_hash(user.password)
    new_user = models.Usuario(
        nome=user.nome,
        email=user.email,
        hashed_password=hashed_pwd,
        role=user.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Audit Log
    db.add(models.AuditLog(
        usuario_id=current_user.id, acao="CRIOU_USUARIO",
        detalhes=f"Usuário '{new_user.nome}' ({new_user.email}, role={new_user.role}) criado",
        entidade="Usuario", entidade_id=new_user.id,
        ip=request.headers.get('X-Real-IP', request.client.host if request.client else None)
    ))
    db.commit()
    return new_user

@router.put("/{user_id}", response_model=schemas.UsuarioOut)
def atualizar_usuario(request: Request, user_id: int, user_update: schemas.UsuarioUpdate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    if current_user.id != user_id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Acesso negado.")
    
    db_user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        
    update_data = user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
        
    db.commit()
    db.refresh(db_user)
    
    # Audit Log
    db.add(models.AuditLog(
        usuario_id=current_user.id, acao="EDITOU_USUARIO",
        detalhes=f"Usuário '{db_user.nome}' (ID {db_user.id}) editado. Campos: {list(update_data.keys())}",
        entidade="Usuario", entidade_id=db_user.id,
        ip=request.headers.get('X-Real-IP', request.client.host if request.client else None)
    ))
    db.commit()
    return db_user

@router.delete("/{user_id}")
def inativar_funcionario(request: Request, user_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """ Realiza o Soft Delete de um funcionário demitido """
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Acesso negado.")
    
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode desligar sua própria conta Master.")
        
    user_to_delete = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado no sistema.")
        
    user_to_delete.ativo = False
    db.commit()
    
    # Audit Log
    db.add(models.AuditLog(
        usuario_id=current_user.id, acao="INATIVOU_USUARIO",
        detalhes=f"Usuário '{user_to_delete.nome}' (ID {user_to_delete.id}, {user_to_delete.email}) inativado",
        entidade="Usuario", entidade_id=user_to_delete.id,
        ip=request.headers.get('X-Real-IP', request.client.host if request.client else None)
    ))
    db.commit()
    return {"status": "Funcionário inativado e teve os acessos revogados."}
