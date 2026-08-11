from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
import re
import httpx
from database import get_db
from ssrf_utils import assert_public_http_url
import models, schemas, auth

router = APIRouter(prefix="/clientes", tags=["CRM de Clientes"])


def _expandir(cliente: models.Cliente) -> schemas.ClienteOut:
    """Anexa os nomes de quem criou/editou — o detalhe do cliente exibe isso, e sem os
    nomes o frontend teria que buscar usuários um a um."""
    saida = schemas.ClienteOut.model_validate(cliente)
    saida.criado_por_nome = cliente.criado_por.nome if cliente.criado_por else None
    saida.editado_por_nome = cliente.editado_por.nome if cliente.editado_por else None
    return saida


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
        nome_fantasia=cliente.nome_exibicao(),  # derivado de nome+sobrenome ou razão social
        usuario_id=current_user.id, # Vincula o cliente automaticamente ao Vendedor/Admin logado
        criado_por_id=current_user.id,
    )
    db.add(novo_cliente)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Não foi possível cadastrar este CPF/CNPJ. Verifique os dados e tente novamente.")
    db.refresh(novo_cliente)

    _log(db, request, current_user, "CRIOU_CLIENTE", f"Cliente '{novo_cliente.nome_fantasia}' criado (ID {novo_cliente.id})", novo_cliente.id)
    return _expandir(novo_cliente)

@router.get("/", response_model=list[schemas.ClienteOut])
def listar_clientes(db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    """
    Lista a carteira de clientes:
    - Admin vê TODOS.
    - Vendedor vê SÓ os seus.
    """
    query = db.query(models.Cliente).options(
        joinedload(models.Cliente.criado_por), joinedload(models.Cliente.editado_por)
    )
    if current_user.role == 'admin':
        return [_expandir(c) for c in query.all()]
    elif current_user.role == 'vendedor':
        return [_expandir(c) for c in query.filter(models.Cliente.usuario_id == current_user.id).all()]
    else:
        raise HTTPException(status_code=403, detail="Acesso negado.")

# Rota literal precisa vir ANTES de /{cliente_id}: Starlette casa na ordem de registro,
# então "cep" seria capturado como cliente_id se viesse depois.
@router.get("/cep/{cep}", response_model=schemas.CepOut)
def consultar_cep(cep: str, current_user: models.Usuario = Depends(auth.get_current_user)):
    """Proxy de consulta de CEP.

    Existe no backend porque o CSP da aplicação (`connect-src 'self'`) impede o navegador
    de chamar o ViaCEP direto. Falha de rede/CEP inexistente devolve campos vazios em vez
    de erro: preencher endereço é conveniência, nunca pode travar o cadastro.
    """
    apenas_digitos = re.sub(r"\D", "", cep)
    if len(apenas_digitos) != 8:
        raise HTTPException(status_code=400, detail="CEP deve ter 8 dígitos.")

    vazio = schemas.CepOut(cep=apenas_digitos)
    try:
        url = assert_public_http_url(f"https://viacep.com.br/ws/{apenas_digitos}/json/")
        with httpx.Client(timeout=5.0) as client:
            resposta = client.get(url)
        if resposta.status_code != 200:
            return vazio
        dados = resposta.json()
        if dados.get("erro"):
            return vazio
        return schemas.CepOut(
            cep=apenas_digitos,
            logradouro=dados.get("logradouro") or None,
            bairro=dados.get("bairro") or None,
            cidade=dados.get("localidade") or None,
            estado=(dados.get("uf") or "").upper() or None,
        )
    except Exception:
        # Indisponibilidade do ViaCEP não é erro do usuário — devolve vazio e ele digita.
        return vazio


@router.get("/{cliente_id}", response_model=schemas.ClienteOut)
def obter_cliente(cliente_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    # Trava de Segurança Horizontal: Vendedor não espiona cliente de outro Vendedor
    if current_user.role != 'admin' and cliente.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Este cliente pertence à carteira de outro vendedor.")

    return _expandir(cliente)

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
    db_cliente.nome_fantasia = cliente_update.nome_exibicao()
    # criado_por_id nunca é reescrito; só a trilha de edição.
    db_cliente.editado_por_id = current_user.id
    db_cliente.editado_em = datetime.now(timezone.utc)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Não foi possível salvar este CPF/CNPJ. Verifique os dados e tente novamente.")
    db.refresh(db_cliente)

    _log(db, request, current_user, "EDITOU_CLIENTE", f"Cliente '{db_cliente.nome_fantasia}' (ID {db_cliente.id}) editado", db_cliente.id)
    return _expandir(db_cliente)

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
