from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
import database
import auth

router = APIRouter(
    prefix="/fornecedores",
    tags=["Fornecedores"]
)

@router.get("/", response_model=List[schemas.FornecedorOut])
def listar_fornecedores(
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(auth.get_current_user)
):
    if current_user.role not in ['admin', 'vendedor']:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    fornecedores = db.query(models.Fornecedor).filter(models.Fornecedor.ativo == True).all()
    return fornecedores

@router.post("/", response_model=schemas.FornecedorOut, status_code=status.HTTP_201_CREATED)
def criar_fornecedor(
    fornecedor: schemas.FornecedorCreate,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(auth.get_current_user)
):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Apenas admin pode criar fornecedores.")
        
    if fornecedor.cnpj:
        db_cnpj = db.query(models.Fornecedor).filter(models.Fornecedor.cnpj == fornecedor.cnpj).first()
        if db_cnpj:
            raise HTTPException(status_code=400, detail="CNPJ já cadastrado no sistema.")
            
    novo_fornecedor = models.Fornecedor(**fornecedor.model_dump())
    db.add(novo_fornecedor)
    db.commit()
    db.refresh(novo_fornecedor)
    return novo_fornecedor

@router.put("/{fornecedor_id}", response_model=schemas.FornecedorOut)
def atualizar_fornecedor(
    fornecedor_id: int,
    fornecedor_update: schemas.FornecedorCreate,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(auth.get_current_user)
):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Apenas admin pode editar fornecedores.")
        
    db_forn = db.query(models.Fornecedor).filter(models.Fornecedor.id == fornecedor_id).first()
    if not db_forn:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
        
    for var, value in fornecedor_update.model_dump().items():
        setattr(db_forn, var, value)
        
    db.commit()
    db.refresh(db_forn)
    return db_forn

@router.delete("/{fornecedor_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_fornecedor(
    fornecedor_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(auth.get_current_user)
):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Apenas admin pode deletar fornecedores.")
        
    db_forn = db.query(models.Fornecedor).filter(models.Fornecedor.id == fornecedor_id).first()
    if not db_forn:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
        
    db_forn.ativo = False # Soft delete
    db.commit()
    return {"ok": True}
