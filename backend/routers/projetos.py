"""Projetos importados de softwares de arquitetura (ex: SketchUp).

Um Projeto é salvo de forma independente de qualquer orçamento. Só quando o vendedor/arquiteto
seleciona um Projeto ao criar/editar um orçamento é que os itens são validados e, aí sim,
viram linhas do orçamento — nada é inserido automaticamente.
"""
import csv
import io
import os
import unicodedata
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session, joinedload, selectinload

from database import get_db
import models, schemas, auth
from anexo_utils import read_upload_limited
from rate_limiter import limiter

router = APIRouter(prefix="/projetos", tags=["Projetos (Integrações)"])

PROJETO_CSV_EXTENSOES = {".csv", ".txt"}
PROJETO_CSV_MAX_SIZE = 2 * 1024 * 1024  # 2MB — lista de componentes é texto curto

_CSV_ALIASES = {
    "nome": "nome", "name": "nome", "component": "nome", "component name": "nome", "definition name": "nome",
    "quantidade": "quantidade", "quantity": "quantidade", "count": "quantidade", "qty": "quantidade",
    "material": "material",
    "comprimento": "comprimento", "length": "comprimento",
    "largura": "largura", "width": "largura",
    "altura": "altura", "height": "altura",
    "referencia_externa": "referencia_externa", "guid": "referencia_externa", "definition guid": "referencia_externa",
}


def _normalizar(texto: str) -> str:
    """Remove acentos, espaços nas pontas e coloca em minúsculas — usado tanto para mapear
    cabeçalhos do CSV quanto para casar nomes de item com o catálogo."""
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return sem_acento.strip().lower()


def _parse_csv_projeto(content: bytes) -> tuple[list[schemas.ProjetoItemCreate], int]:
    texto = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(texto))
    if not reader.fieldnames:
        return [], 0

    mapa_colunas = {}
    for coluna in reader.fieldnames:
        canonico = _CSV_ALIASES.get(_normalizar(coluna))
        if canonico:
            mapa_colunas[coluna] = canonico

    itens: list[schemas.ProjetoItemCreate] = []
    ignoradas = 0
    for linha in reader:
        dados = {mapa_colunas[chave]: valor for chave, valor in linha.items() if chave in mapa_colunas}
        nome = (dados.get("nome") or "").strip()
        if not nome:
            ignoradas += 1
            continue

        quantidade_raw = (dados.get("quantidade") or "").strip()
        if quantidade_raw:
            try:
                quantidade = int(float(quantidade_raw))
            except ValueError:
                ignoradas += 1
                continue
            if quantidade < 1:
                ignoradas += 1
                continue
        else:
            quantidade = 1

        def _float_ou_none(chave: str) -> Optional[float]:
            valor = (dados.get(chave) or "").strip()
            if not valor:
                return None
            try:
                return float(valor)
            except ValueError:
                return None

        itens.append(schemas.ProjetoItemCreate(
            nome=nome,
            quantidade=quantidade,
            material=(dados.get("material") or "").strip() or None,
            comprimento=_float_ou_none("comprimento"),
            largura=_float_ou_none("largura"),
            altura=_float_ou_none("altura"),
            referencia_externa=(dados.get("referencia_externa") or "").strip() or None,
        ))

    return itens, ignoradas


def _sugerir_produtos(db: Session) -> dict[str, list[models.Produto]]:
    """Mapa de nome normalizado -> lista de produtos do catálogo (para detectar match único vs. ambíguo)."""
    mapa: dict[str, list[models.Produto]] = {}
    produtos = db.query(models.Produto).filter(
        models.Produto.is_catalogo == True,  # noqa: E712
        models.Produto.ativo == True,  # noqa: E712
    ).all()
    for produto in produtos:
        mapa.setdefault(_normalizar(produto.nome), []).append(produto)
    return mapa


def _criar_projeto_com_itens(
    nome: str,
    cliente_id: Optional[int],
    origem: str,
    origem_meta: Optional[str],
    itens: list[schemas.ProjetoItemCreate],
    usuario: models.Usuario,
    db: Session,
) -> models.Projeto:
    if cliente_id:
        cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")
        if usuario.role != "admin" and cliente.usuario_id != usuario.id:
            raise HTTPException(status_code=403, detail="Cliente pertence a outro vendedor.")

    projeto = models.Projeto(
        nome=nome, cliente_id=cliente_id, usuario_id=usuario.id,
        origem=origem, origem_meta=origem_meta,
    )
    db.add(projeto)
    db.flush()  # gera o id sem commitar ainda

    catalogo = _sugerir_produtos(db)
    for item in itens:
        produto_id = item.produto_id
        preco_sugerido = item.preco_sugerido_centavos
        if not produto_id:
            candidatos = catalogo.get(_normalizar(item.nome), [])
            if len(candidatos) == 1:
                produto_id = candidatos[0].id
                preco_sugerido = preco_sugerido or candidatos[0].preco_venda
        db.add(models.ProjetoItem(
            projeto_id=projeto.id,
            nome=item.nome,
            quantidade=item.quantidade,
            material=item.material,
            comprimento=item.comprimento,
            largura=item.largura,
            altura=item.altura,
            referencia_externa=item.referencia_externa,
            produto_id=produto_id,
            preco_sugerido_centavos=preco_sugerido,
            observacoes=item.observacoes,
        ))

    db.commit()
    db.refresh(projeto)
    return projeto


def _enrich_projeto(projeto: models.Projeto, db: Session, detail: bool = False) -> models.Projeto:
    cliente = getattr(projeto, "cliente", None)
    usuario = getattr(projeto, "usuario", None)
    projeto.cliente_nome = cliente.nome_fantasia if cliente else None
    projeto.usuario_nome = usuario.nome if usuario else None
    projeto.total_itens = len(projeto.itens)

    if detail:
        produto_ids = {item.produto_id for item in projeto.itens if item.produto_id}
        nomes_produto = {}
        if produto_ids:
            for produto in db.query(models.Produto).filter(models.Produto.id.in_(produto_ids)).all():
                nomes_produto[produto.id] = produto.nome
        for item in projeto.itens:
            item.produto_nome_sugerido = nomes_produto.get(item.produto_id)

    return projeto


def _get_projeto_autorizado(projeto_id: int, db: Session, current_user: models.Usuario) -> models.Projeto:
    projeto = db.query(models.Projeto).options(
        selectinload(models.Projeto.itens),
        joinedload(models.Projeto.cliente),
        joinedload(models.Projeto.usuario),
    ).filter(models.Projeto.id == projeto_id).first()
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")
    if current_user.role != "admin" and projeto.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    return projeto


@router.post("/importar", response_model=schemas.ProjetoDetailOut, status_code=status.HTTP_201_CREATED)
async def importar_projeto_csv(
    request: Request,
    file: UploadFile = File(...),
    nome: str = Form(...),
    cliente_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in PROJETO_CSV_EXTENSOES:
        raise HTTPException(status_code=400, detail="Apenas arquivos .csv ou .txt são aceitos.")

    content = await read_upload_limited(file, max_size=PROJETO_CSV_MAX_SIZE)
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    itens, ignoradas = _parse_csv_projeto(content)
    if not itens:
        raise HTTPException(status_code=400, detail="Nenhum item válido encontrado no arquivo.")

    meta = f"arquivo: {file.filename}"
    if ignoradas:
        meta += f" ({ignoradas} linha(s) ignorada(s))"

    projeto = _criar_projeto_com_itens(
        nome=nome, cliente_id=cliente_id, origem="manual_csv", origem_meta=meta,
        itens=itens, usuario=current_user, db=db,
    )

    db.add(models.AuditLog(
        usuario_id=current_user.id, acao="IMPORTOU_PROJETO",
        detalhes=f"Importou projeto '{projeto.nome}' (ID {projeto.id}) via CSV, {len(itens)} item(ns)",
        entidade="Projeto", entidade_id=projeto.id,
        ip=request.headers.get("X-Real-IP", request.client.host if request.client else None),
    ))
    db.commit()

    return _enrich_projeto(projeto, db, detail=True)


@router.post("/push", response_model=schemas.ProjetoDetailOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
def push_projeto(
    request: Request,
    payload: schemas.ProjetoCreatePush,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.get_api_key_identity),
):
    projeto = _criar_projeto_com_itens(
        nome=payload.nome, cliente_id=payload.cliente_id, origem=payload.origem,
        origem_meta=payload.origem_meta, itens=payload.itens, usuario=current_user, db=db,
    )

    db.add(models.AuditLog(
        usuario_id=current_user.id, acao="IMPORTOU_PROJETO",
        detalhes=f"Recebeu projeto '{projeto.nome}' (ID {projeto.id}) via API key ({payload.origem}), {len(payload.itens)} item(ns)",
        entidade="Projeto", entidade_id=projeto.id,
        ip=request.headers.get("X-Real-IP", request.client.host if request.client else None),
    ))
    db.commit()

    return _enrich_projeto(projeto, db, detail=True)


@router.get("/", response_model=list[schemas.ProjetoOut])
def listar_projetos(db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    query = db.query(models.Projeto).options(
        selectinload(models.Projeto.itens),
        joinedload(models.Projeto.cliente),
        joinedload(models.Projeto.usuario),
    )
    if current_user.role != "admin":
        query = query.filter(models.Projeto.usuario_id == current_user.id)
    projetos = query.order_by(models.Projeto.created_at.desc()).all()
    return [_enrich_projeto(p, db) for p in projetos]


@router.get("/{projeto_id}", response_model=schemas.ProjetoDetailOut)
def obter_projeto(projeto_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    projeto = _get_projeto_autorizado(projeto_id, db, current_user)
    return _enrich_projeto(projeto, db, detail=True)


@router.put("/{projeto_id}/itens/{item_id}", response_model=schemas.ProjetoItemOut)
def atualizar_item_projeto(
    projeto_id: int, item_id: int, item_in: schemas.ProjetoItemUpdate,
    db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user),
):
    projeto = _get_projeto_autorizado(projeto_id, db, current_user)
    item = db.query(models.ProjetoItem).filter(
        models.ProjetoItem.id == item_id, models.ProjetoItem.projeto_id == projeto.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")

    update_data = item_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)

    if item.produto_id:
        produto = db.query(models.Produto).filter(models.Produto.id == item.produto_id).first()
        item.produto_nome_sugerido = produto.nome if produto else None
    return item


@router.delete("/{projeto_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_projeto(projeto_id: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    projeto = _get_projeto_autorizado(projeto_id, db, current_user)

    ja_usado = db.query(models.Orcamento).filter(models.Orcamento.projeto_id == projeto.id).first()
    if ja_usado:
        raise HTTPException(status_code=400, detail="Este projeto já foi usado em um orçamento e não pode ser excluído.")

    db.delete(projeto)
    db.commit()
    return None
