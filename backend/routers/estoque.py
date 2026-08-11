from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError
from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/estoque", tags=["Estoque"])


def registrar_movimentacao(
    db: Session,
    produto_id: int,
    quantidade: int,
    tipo: str,
    usuario_id: int,
    justificativa: str,
) -> models.Produto:
    """Debita/credita quantidade_estoque de um Produto e grava a MovimentacaoEstoque
    correspondente. Não comita — quem chama decide a transação (permite acoplar audit log
    e outros registros, como PerdaAvaria, na mesma unidade de trabalho)."""
    produto = db.query(models.Produto).filter(models.Produto.id == produto_id).with_for_update().first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    if tipo == 'SAIDA' and produto.quantidade_estoque < quantidade:
        raise HTTPException(status_code=400, detail="Estoque insuficiente para esta baixa.")

    if tipo == 'ENTRADA':
        produto.quantidade_estoque += quantidade
    else:
        produto.quantidade_estoque -= quantidade

    db.add(models.MovimentacaoEstoque(
        produto_id=produto.id,
        usuario_id=usuario_id,
        tipo=tipo,
        quantidade=quantidade,
        justificativa=justificativa,
    ))
    return produto

@router.post("/produtos", response_model=schemas.ProdutoOut, status_code=status.HTTP_201_CREATED)
def criar_produto(
    request: Request,
    produto: schemas.ProdutoCreate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista']))
):
    novo_produto = models.Produto(**produto.model_dump())
    db.add(novo_produto)
    db.commit()
    db.refresh(novo_produto)
    
    # Audit Log
    db.add(models.AuditLog(
        usuario_id=current_user.id, acao="CRIOU_PRODUTO",
        detalhes=f"Produto '{novo_produto.nome}' criado (ID {novo_produto.id})",
        entidade="Produto", entidade_id=novo_produto.id,
        ip=request.headers.get('X-Real-IP', request.client.host if request.client else None)
    ))
    db.commit()
    return novo_produto

@router.get("/produtos", response_model=list[schemas.ProdutoOut])
def listar_produtos(
    is_catalogo: Optional[bool] = None,
    ativo: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.get_current_user)
):
    query = db.query(models.Produto)
    if is_catalogo is not None:
        query = query.filter(models.Produto.is_catalogo == is_catalogo)
    if ativo is not None:
        query = query.filter(models.Produto.ativo == ativo)
    return query.all()

@router.put("/produtos/{produto_id}", response_model=schemas.ProdutoOut)
def editar_produto(
    request: Request,
    produto_id: int,
    produto_in: schemas.ProdutoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista']))
):
    produto_db = db.query(models.Produto).filter(models.Produto.id == produto_id).first()
    if not produto_db:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    
    # Detecta mudanças de preço para log detalhado
    preco_custo_antes = produto_db.preco_custo
    preco_venda_antes = produto_db.preco_venda
    
    update_data = produto_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(produto_db, key, value)
        
    try:
        db.commit()
        db.refresh(produto_db)
        
        # Audit Log com detalhe de alteração de preço
        detalhes = f"Produto '{produto_db.nome}' (ID {produto_db.id}) editado"
        if 'preco_custo' in update_data and update_data['preco_custo'] != preco_custo_antes:
            detalhes += f" | Custo: R${preco_custo_antes/100:.2f} → R${produto_db.preco_custo/100:.2f}"
        if 'preco_venda' in update_data and update_data['preco_venda'] != preco_venda_antes:
            detalhes += f" | Venda: R${preco_venda_antes/100:.2f} → R${produto_db.preco_venda/100:.2f}"
        
        db.add(models.AuditLog(
            usuario_id=current_user.id, acao="EDITOU_PRODUTO",
            detalhes=detalhes, entidade="Produto", entidade_id=produto_db.id,
            ip=request.headers.get('X-Real-IP', request.client.host if request.client else None)
        ))
        db.commit()
        return produto_db
    except StaleDataError:
        db.rollback()
        raise HTTPException(
            status_code=409, 
            detail="Conflito de concorrência: Este produto foi atualizado por outra pessoa enquanto você editava. Por favor, atualize a página e tente novamente."
        )

@router.get("/alertas")
def alertas_estoque(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.RoleChecker(['admin', 'estoquista']))
):
    # Retorna produtos cuja quantidade está menor ou igual ao limite crítico
    produtos_criticos = db.query(models.Produto).filter(
        models.Produto.quantidade_estoque <= models.Produto.estoque_minimo
    ).all()
    
    return {
        "critico": len(produtos_criticos) > 0,
        "total_criticos": len(produtos_criticos),
        "produtos": [
            {"id": p.id, "nome": p.nome, "quantidade": p.quantidade_estoque, "minimo": p.estoque_minimo}
            for p in produtos_criticos
        ]
    }

@router.post("/movimentar/{produto_id}")
def movimentar_estoque(
    request: Request,
    produto_id: int,
    mov: schemas.MovimentacaoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.get_current_user)
):
    if mov.quantidade <= 0:
        raise HTTPException(status_code=400, detail="Quantidade deve ser maior que zero.")

    # Regra de negócio Anti-Conflitos: Loja (vendedor) só subtrai, Galpão (estoquista) só soma.
    if current_user.role == 'vendedor':
        tipo = 'SAIDA'
    elif current_user.role == 'estoquista':
        tipo = 'ENTRADA'
    else: 
        # Admin pode fazer ambos, assumimos entrada por padrão no MVP simplificado
        tipo = 'ENTRADA'

    try:
        produto = registrar_movimentacao(db, produto_id, mov.quantidade, tipo, current_user.id, mov.justificativa)
        db.commit()
        db.refresh(produto)
        
        # Audit Log de movimentação
        db.add(models.AuditLog(
            usuario_id=current_user.id, acao=f"MOVIMENTOU_ESTOQUE_{tipo}",
            detalhes=f"{tipo} de {mov.quantidade}un do produto '{produto.nome}' (ID {produto.id}). Justificativa: {mov.justificativa}",
            entidade="Produto", entidade_id=produto.id,
            ip=request.headers.get('X-Real-IP', request.client.host if request.client else None)
        ))
        db.commit()
        
        return {
            "mensagem": f"Movimentação de {tipo} registrada com sucesso por {current_user.nome}",
            "novo_estoque": produto.quantidade_estoque
        }
    except StaleDataError:
        # Cai aqui se alguém alterou a mesma linha no mesmo milissegundo.
        db.rollback()
        raise HTTPException(
            status_code=409, 
            detail="Conflito de concorrência: O estoque deste item foi atualizado por outra pessoa no exato mesmo segundo. Tente novamente."
        )
