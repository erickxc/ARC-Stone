"""Catálogos configuráveis da tela "Configurações do orçamento".

Todos os catálogos (tipos e formas de pagamento, condições, locais, motivos de perda)
têm a mesma forma: nome + ativo + ordem + built_in. Em vez de um endpoint genérico
parametrizado por nome de tabela (que viraria string mágica e escaparia da tipagem do
FastAPI), cada catálogo ganha rotas próprias geradas por `registrar_catalogo` — o
response_model continua concreto e o /docs continua legível.

Regra transversal: registro com `built_in=True` é semeado pelo sistema. Pode ser
renomeado, desativado e reordenado; nunca excluído.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Callable, Type
import re
import unicodedata

from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/catalogos", tags=["Catálogos configuráveis"])

# Só admin altera catálogo; qualquer usuário autenticado lê (o Builder precisa da lista).
_somente_admin = auth.RoleChecker(["admin"])


def _slug(nome: str) -> str:
    """Slug ASCII do nome. MotivoPerdaAvaria.slug é NOT NULL/unique e o valor gravado em
    PerdaAvaria.motivo continua sendo texto — o slug é a chave estável entre os dois."""
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", sem_acento.lower()).strip("_") or "motivo"


def _log(db: Session, request: Request, usuario, acao: str, detalhes: str, entidade: str, entidade_id: int) -> None:
    """Catálogo muda o comportamento do checkout e das telas do galpão — alteração de
    admin aqui precisa deixar rastro, igual aos outros routers do projeto."""
    db.add(models.AuditLog(
        usuario_id=usuario.id,
        acao=acao,
        detalhes=detalhes,
        entidade=entidade,
        entidade_id=entidade_id,
        ip=request.headers.get('X-Real-IP', request.client.host if request.client else None),
    ))
    db.commit()


def registrar_catalogo(
    caminho: str,
    model: Type,
    schema_out: Type,
    schema_create: Type,
    schema_update: Type,
    rotulo: str,
    derivar: Callable[[dict], dict] | None = None,
):
    """Gera GET/POST/PATCH/PATCH-reordenar/DELETE para um catálogo simples."""

    @router.get(f"/{caminho}", response_model=list[schema_out], name=f"listar_{caminho}")
    def listar(
        apenas_ativos: bool = False,
        db: Session = Depends(get_db),
        current_user: models.Usuario = Depends(auth.get_current_user),
    ):
        query = db.query(model)
        if apenas_ativos:
            query = query.filter(model.ativo.is_(True))
        return query.order_by(model.ordem.asc(), model.id.asc()).all()

    @router.post(f"/{caminho}", response_model=schema_out, status_code=status.HTTP_201_CREATED, name=f"criar_{caminho}")
    def criar(
        request: Request,
        dados: schema_create,
        db: Session = Depends(get_db),
        current_user: models.Usuario = Depends(_somente_admin),
    ):
        proxima_ordem = (db.query(func.coalesce(func.max(model.ordem), 0)).scalar() or 0) + 1
        campos = dados.model_dump()
        # Catálogo com coluna obrigatória além do nome (ex: slug) preenche aqui.
        if derivar:
            campos.update(derivar(campos))
        # built_in nunca vem do payload: item criado por usuário é sempre excluível.
        registro = model(**campos, ordem=proxima_ordem, ativo=True, built_in=False)
        db.add(registro)
        db.commit()
        db.refresh(registro)
        _log(db, request, current_user, "CRIOU_CATALOGO", f"{rotulo} '{registro.nome}' criado", rotulo, registro.id)
        return registro

    @router.patch(f"/{caminho}/reordenar", response_model=list[schema_out], name=f"reordenar_{caminho}")
    def reordenar(
        dados: schemas.ReordenarIn,
        db: Session = Depends(get_db),
        current_user: models.Usuario = Depends(_somente_admin),
    ):
        registros = {r.id: r for r in db.query(model).all()}
        desconhecidos = [i for i in dados.ids_em_ordem if i not in registros]
        if desconhecidos:
            raise HTTPException(status_code=404, detail=f"{rotulo}: id inexistente {desconhecidos}.")
        if len(dados.ids_em_ordem) != len(registros):
            # Lista parcial deixaria os ausentes com ordem obsoleta e empates silenciosos.
            raise HTTPException(status_code=400, detail=f"Envie todos os {len(registros)} itens na nova ordem.")
        for posicao, registro_id in enumerate(dados.ids_em_ordem, start=1):
            registros[registro_id].ordem = posicao
        db.commit()
        return db.query(model).order_by(model.ordem.asc(), model.id.asc()).all()

    @router.patch(f"/{caminho}/{{registro_id}}", response_model=schema_out, name=f"atualizar_{caminho}")
    def atualizar(
        request: Request,
        registro_id: int,
        dados: schema_update,
        db: Session = Depends(get_db),
        current_user: models.Usuario = Depends(_somente_admin),
    ):
        registro = db.query(model).filter(model.id == registro_id).first()
        if not registro:
            raise HTTPException(status_code=404, detail=f"{rotulo} não encontrado.")
        alteracoes = dados.model_dump(exclude_unset=True)
        for campo, valor in alteracoes.items():
            setattr(registro, campo, valor)
        db.commit()
        db.refresh(registro)
        _log(db, request, current_user, "EDITOU_CATALOGO",
             f"{rotulo} '{registro.nome}' alterado: {alteracoes}", rotulo, registro.id)
        return registro

    @router.delete(f"/{caminho}/{{registro_id}}", status_code=status.HTTP_204_NO_CONTENT, name=f"excluir_{caminho}")
    def excluir(
        request: Request,
        registro_id: int,
        db: Session = Depends(get_db),
        current_user: models.Usuario = Depends(_somente_admin),
    ):
        registro = db.query(model).filter(model.id == registro_id).first()
        if not registro:
            raise HTTPException(status_code=404, detail=f"{rotulo} não encontrado.")
        if registro.built_in:
            raise HTTPException(
                status_code=400,
                detail="Item padrão do sistema não pode ser excluído — desative-o para escondê-lo.",
            )
        nome = registro.nome
        db.delete(registro)
        db.commit()
        _log(db, request, current_user, "EXCLUIU_CATALOGO", f"{rotulo} '{nome}' excluído", rotulo, registro_id)
        return None


registrar_catalogo(
    "tipos-pagamento", models.TipoPagamento,
    schemas.TipoPagamentoOut, schemas.TipoPagamentoCreate, schemas.TipoPagamentoUpdate,
    "Tipo de pagamento",
)
registrar_catalogo(
    "condicoes-pagamento", models.CondicaoPagamento,
    schemas.CondicaoPagamentoOut, schemas.CondicaoPagamentoCreate, schemas.CondicaoPagamentoUpdate,
    "Condição de pagamento",
)
registrar_catalogo(
    "locais", models.Local,
    schemas.LocalOut, schemas.LocalCreate, schemas.LocalUpdate,
    "Local",
)
registrar_catalogo(
    "motivos-perda", models.MotivoPerdaAvaria,
    schemas.MotivoPerdaAvariaOut, schemas.MotivoPerdaAvariaCreate, schemas.MotivoPerdaAvariaUpdate,
    "Motivo de perda/avaria",
    derivar=lambda campos: {"slug": _slug(campos["nome"])},
)


# Formas de pagamento não usam o helper: o POST precisa validar o tipo pai e o GET
# aceita filtro por tipo (a cascata Tipo→Forma do checkout depende disso).

@router.get("/formas-pagamento", response_model=list[schemas.FormaPagamentoOut])
def listar_formas_pagamento(
    tipo_pagamento_id: int | None = None,
    apenas_ativos: bool = False,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(auth.get_current_user),
):
    query = db.query(models.FormaPagamento)
    if tipo_pagamento_id is not None:
        query = query.filter(models.FormaPagamento.tipo_pagamento_id == tipo_pagamento_id)
    if apenas_ativos:
        query = query.filter(models.FormaPagamento.ativo.is_(True))
    return query.order_by(models.FormaPagamento.ordem.asc(), models.FormaPagamento.id.asc()).all()


@router.post("/formas-pagamento", response_model=schemas.FormaPagamentoOut, status_code=status.HTTP_201_CREATED)
def criar_forma_pagamento(
    dados: schemas.FormaPagamentoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(_somente_admin),
):
    tipo = db.query(models.TipoPagamento).filter(models.TipoPagamento.id == dados.tipo_pagamento_id).first()
    if not tipo:
        raise HTTPException(status_code=404, detail="Tipo de pagamento não encontrado.")
    proxima_ordem = (
        db.query(func.coalesce(func.max(models.FormaPagamento.ordem), 0))
        .filter(models.FormaPagamento.tipo_pagamento_id == dados.tipo_pagamento_id)
        .scalar() or 0
    ) + 1
    forma = models.FormaPagamento(
        nome=dados.nome,
        tipo_pagamento_id=dados.tipo_pagamento_id,
        ordem=proxima_ordem,
        ativo=True,
        built_in=False,
    )
    db.add(forma)
    db.commit()
    db.refresh(forma)
    return forma


@router.patch("/formas-pagamento/{forma_id}", response_model=schemas.FormaPagamentoOut)
def atualizar_forma_pagamento(
    forma_id: int,
    dados: schemas.FormaPagamentoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(_somente_admin),
):
    forma = db.query(models.FormaPagamento).filter(models.FormaPagamento.id == forma_id).first()
    if not forma:
        raise HTTPException(status_code=404, detail="Forma de pagamento não encontrada.")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(forma, campo, valor)
    db.commit()
    db.refresh(forma)
    return forma


@router.delete("/formas-pagamento/{forma_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_forma_pagamento(
    forma_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(_somente_admin),
):
    forma = db.query(models.FormaPagamento).filter(models.FormaPagamento.id == forma_id).first()
    if not forma:
        raise HTTPException(status_code=404, detail="Forma de pagamento não encontrada.")
    if forma.built_in:
        raise HTTPException(
            status_code=400,
            detail="Item padrão do sistema não pode ser excluído — desative-o para escondê-lo.",
        )
    db.delete(forma)
    db.commit()
    return None
