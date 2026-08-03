from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/clientes", tags=["CRM de Clientes"])

@router.post("/", response_model=schemas.ClienteOut, status_code=status.HTTP_201_CREATED)
def criar_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    # Vendedores e Admins podem criar
    if current_user.role not in ['admin', 'vendedor']:
        raise HTTPException(status_code=403, detail="Estoquistas não podem cadastrar clientes.")
        
    # Verifica duplicidade de CPF/CNPJ
    if cliente.cpf_cnpj:
        db_cpf_cnpj = db.query(models.Cliente).filter(models.Cliente.cpf_cnpj == cliente.cpf_cnpj).first()
        if db_cpf_cnpj:
            raise HTTPException(status_code=400, detail="CPF/CNPJ já cadastrado no sistema.")
        
    novo_cliente = models.Cliente(
        **cliente.model_dump(),
        usuario_id=current_user.id # Vincula o cliente automaticamente ao Vendedor/Admin logado
    )
    db.add(novo_cliente)
    db.commit()
    db.refresh(novo_cliente)
    return novo_cliente

@router.get("/", response_model=list[schemas.ClienteOut])
def listar_clientes(db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """
    Lista a carteira de clientes:
    - Admin vê TODOS.
    - Vendedor vê SÓ os seus.
    """
    if current_user.role == 'admin':
        return db.query(models.Cliente).all()
    elif current_user.role == 'vendedor':
        return db.query(models.Cliente).filter(models.Cliente.usuario_id == current_user.id).all()
    else:
        raise HTTPException(status_code=403, detail="Acesso negado.")

@router.get("/{cliente_id}", response_model=schemas.ClienteOut)
def obter_cliente(cliente_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
        
    # Trava de Segurança Horizontal: Vendedor não espiona cliente de outro Vendedor
    if current_user.role != 'admin' and cliente.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Este cliente pertence à carteira de outro vendedor.")
        
    return cliente

@router.put("/{cliente_id}", response_model=schemas.ClienteOut)
def atualizar_cliente(
    cliente_id: int, 
    cliente_update: schemas.ClienteCreate, 
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(auth.get_current_user)
):
    if current_user.role not in ['admin', 'vendedor']:
        raise HTTPException(status_code=403, detail="Acesso negado.")
        
    db_cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not db_cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
        
    # Trava de Segurança Horizontal
    if current_user.role != 'admin' and db_cliente.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Este cliente pertence à carteira de outro vendedor.")
    
    # Verifica duplicidade de CPF/CNPJ (excluindo o próprio registro)
    if cliente_update.cpf_cnpj and cliente_update.cpf_cnpj != db_cliente.cpf_cnpj:
        existe = db.query(models.Cliente).filter(models.Cliente.cpf_cnpj == cliente_update.cpf_cnpj).first()
        if existe:
            raise HTTPException(status_code=400, detail="CPF/CNPJ já cadastrado no sistema.")
    
    for var, value in cliente_update.model_dump().items():
        setattr(db_cliente, var, value)
        
    db.commit()
    db.refresh(db_cliente)
    return db_cliente

@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_cliente(
    cliente_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(auth.get_current_user)
):
    if current_user.role not in ['admin', 'vendedor']:
        raise HTTPException(status_code=403, detail="Acesso negado.")
        
    db_cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not db_cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
        
    # Trava de Segurança Horizontal
    if current_user.role != 'admin' and db_cliente.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Este cliente pertence à carteira de outro vendedor.")
    
    db.delete(db_cliente)
    db.commit()
    return {"ok": True}
