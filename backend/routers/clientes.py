from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/clientes", tags=["CRM de Clientes"])


def _log(db: Session, request: Request, current_user: models.Usuario, acao: str, detalhes: str, cliente_id: int) -> None:
    db.add(models.AuditLog(
        usuario_id=current_user.id,
        acao=acao,
        detalhes=detalhes,
        entidade="Cliente",
        entidade_id=cliente_id,
        ip=request.headers.get('X-Real-IP', request.client.host if request.client else None),
    ))
    db.commit()


@router.post("/", response_model=schemas.ClienteOut, status_code=status.HTTP_201_CREATED)
def criar_cliente(request: Request, cliente: schemas.ClienteCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    # Vendedores e Admins podem criar
    if current_user.role not in ['admin', 'vendedor']:
        raise HTTPException(status_code=403, detail="Estoquistas não podem cadastrar clientes.")

    # Verifica duplicidade de CPF/CNPJ. Vendedor só é avisado se o duplicado estiver na
    # própria carteira — não deve descobrir se o documento já pertence a outro vendedor
    # (a unicidade global continua sendo garantida pela constraint do banco, tratada abaixo).
    if cliente.cpf_cnpj:
        query = db.query(models.Cliente).filter(models.Cliente.cpf_cnpj == cliente.cpf_cnpj)
        if current_user.role != 'admin':
            query = query.filter(models.Cliente.usuario_id == current_user.id)
        if query.first():
            raise HTTPException(status_code=400, detail="CPF/CNPJ já cadastrado no sistema.")

    novo_cliente = models.Cliente(
        **cliente.model_dump(),
        usuario_id=current_user.id # Vincula o cliente automaticamente ao Vendedor/Admin logado
    )
    db.add(novo_cliente)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Não foi possível cadastrar este CPF/CNPJ. Verifique os dados e tente novamente.")
    db.refresh(novo_cliente)

    _log(db, request, current_user, "CRIOU_CLIENTE", f"Cliente '{novo_cliente.nome_fantasia}' criado (ID {novo_cliente.id})", novo_cliente.id)
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
    request: Request,
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

    # Verifica duplicidade de CPF/CNPJ (excluindo o próprio registro) — mesmo escopo do create
    if cliente_update.cpf_cnpj and cliente_update.cpf_cnpj != db_cliente.cpf_cnpj:
        query = db.query(models.Cliente).filter(
            models.Cliente.cpf_cnpj == cliente_update.cpf_cnpj,
            models.Cliente.id != cliente_id,
        )
        if current_user.role != 'admin':
            query = query.filter(models.Cliente.usuario_id == current_user.id)
        if query.first():
            raise HTTPException(status_code=400, detail="CPF/CNPJ já cadastrado no sistema.")

    for var, value in cliente_update.model_dump().items():
        setattr(db_cliente, var, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Não foi possível salvar este CPF/CNPJ. Verifique os dados e tente novamente.")
    db.refresh(db_cliente)

    _log(db, request, current_user, "EDITOU_CLIENTE", f"Cliente '{db_cliente.nome_fantasia}' (ID {db_cliente.id}) editado", db_cliente.id)
    return db_cliente

@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_cliente(
    request: Request,
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

    nome = db_cliente.nome_fantasia
    db.delete(db_cliente)
    db.commit()

    _log(db, request, current_user, "EXCLUIU_CLIENTE", f"Cliente '{nome}' (ID {cliente_id}) excluído", cliente_id)
    return {"ok": True}
