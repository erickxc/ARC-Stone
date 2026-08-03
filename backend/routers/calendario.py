from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timedelta
from typing import List, Optional
from database import get_db
import models, auth
from pydantic import BaseModel

router = APIRouter(prefix="/calendario", tags=["Calendário Inteligente"])

class EventoCalendario(BaseModel):
    id: str
    title: str
    start: datetime
    end: datetime
    allDay: bool
    orcamento_id: int
    cliente_nome: str
    tipo: str # "Entrega", "Devolucao"
    status: str # "Pendente", "Entregue"
    # Campos extras para detalhamento:
    quantidade: Optional[int] = None
    nome_produto: Optional[str] = None
    foto_url: Optional[str] = None
    local_instalacao: Optional[str] = None
    personalizacao_aplicada: Optional[str] = None
    resumo_itens: Optional[str] = None
    valor_total: Optional[int] = None
    vendedor_nome: Optional[str] = None
    cliente_endereco: Optional[str] = None

@router.get("/entregas", response_model=List[EventoCalendario])
def listar_entregas(db: Session = Depends(get_db), current_user: models.Usuario = Depends(auth.get_current_user)):
    # Busca todos os orçamentos aprovados que tenham data de aprovação
    orcamentos = db.query(models.Orcamento).options(
        joinedload(models.Orcamento.itens).joinedload(models.OrcamentoItem.produto).joinedload(models.Produto.fornecedor),
        joinedload(models.Orcamento.cliente),
        joinedload(models.Orcamento.vendedor)
    ).filter(
        models.Orcamento.status == "Aprovado",
        models.Orcamento.data_aprovacao.isnot(None)
    ).all()
    
    eventos = []
    
    for orc in orcamentos:
        # Se não for admin, só vê os orçamentos da sua carteira
        if current_user.role != 'admin' and orc.vendedor_id != current_user.id:
            continue
            
        for item in orc.itens:
            if item.prazo_entrega_valor and item.prazo_entrega_unidade:
                data_base = orc.data_aprovacao
                data_entrega = None
                
                if item.prazo_entrega_unidade == "dias":
                    data_entrega = data_base + timedelta(days=item.prazo_entrega_valor)
                elif item.prazo_entrega_unidade == "meses":
                    data_entrega = data_base + timedelta(days=item.prazo_entrega_valor * 30)
                
                if data_entrega:
                    # Tenta pegar o nome do item
                    nome_item = item.nome_externo
                    if not nome_item and item.produto_id:
                        nome_item = f"Produto #{item.produto_id}" # Em um cenário real, buscaria o nome do produto no DB (podemos usar lazy loading mas o frontend já resolve isso bem)
                        if item.produto:
                             nome_item = item.produto.nome
                             
                    eventos.append({
                        "id": f"entrega-{item.id}",
                        "title": f"Entrega: {orc.cliente.nome_fantasia} - {item.quantidade}x {nome_item}",
                        "start": data_entrega,
                        "end": data_entrega,
                        "allDay": True,
                        "orcamento_id": orc.id,
                        "cliente_nome": orc.cliente.nome_fantasia,
                        "tipo": "Entrega",
                        "status": "Pendente",
                        "quantidade": item.quantidade,
                        "nome_produto": nome_item,
                        "foto_url": item.foto_externa_url if item.is_externo else (item.produto.foto_url if item.produto else None),
                        "local_instalacao": item.local_instalacao,
                        "personalizacao_aplicada": item.personalizacao_aplicada,
                        "vendedor_nome": orc.vendedor.nome if orc.vendedor else None,
                        "cliente_endereco": orc.cliente.endereco_entrega,
                        "fornecedor_nome": "Fornecedor Externo" if item.is_externo else (item.produto.fornecedor.nome_fantasia if item.produto and item.produto.fornecedor else "ARC (Interno)")
                    })
        
        # Evento de Fim de Locação
        if orc.tipo_orcamento == "Locacao" and orc.data_fim_locacao:
            # Resumo dos itens
            nomes_itens = []
            for i in orc.itens:
                n = i.nome_externo if i.is_externo else (i.produto.nome if i.produto else f"Produto #{i.produto_id}")
                nomes_itens.append(f"{i.quantidade}x {n}")
            resumo = ", ".join(nomes_itens)
            
            valor_total = sum((i.quantidade * (i.preco_unitario_aplicado or 0)) for i in orc.itens)
            
            eventos.append({
                "id": f"fim-locacao-{orc.id}",
                "title": f"Fim Locação: {orc.cliente.nome_fantasia}",
                "start": orc.data_fim_locacao,
                "end": orc.data_fim_locacao,
                "allDay": True,
                "orcamento_id": orc.id,
                "cliente_nome": orc.cliente.nome_fantasia,
                "tipo": "Devolucao",
                "status": "Pendente",
                "resumo_itens": resumo,
                "valor_total": valor_total,
                "vendedor_nome": orc.vendedor.nome if orc.vendedor else None,
                "cliente_endereco": orc.cliente.endereco_entrega
            })
        
        # Evento de Fim de Produção (faturamento)
        if orc.tipo_orcamento == "Producao" and orc.data_fim_locacao:
            nomes_itens = []
            for i in orc.itens:
                n = i.nome_externo if i.is_externo else (i.produto.nome if i.produto else f"Produto #{i.produto_id}")
                nomes_itens.append(f"{i.quantidade}x {n}")
            resumo = ", ".join(nomes_itens)
            
            valor_total = sum((i.quantidade * (i.preco_unitario_aplicado or 0)) for i in orc.itens)
            
            eventos.append({
                "id": f"fim-producao-{orc.id}",
                "title": f"Faturamento: {orc.cliente.nome_fantasia}",
                "start": orc.data_fim_locacao,
                "end": orc.data_fim_locacao,
                "allDay": True,
                "orcamento_id": orc.id,
                "cliente_nome": orc.cliente.nome_fantasia,
                "tipo": "Faturamento",
                "status": "Pendente",
                "resumo_itens": resumo,
                "valor_total": valor_total,
                "vendedor_nome": orc.vendedor.nome if orc.vendedor else None,
                "cliente_endereco": orc.cliente.endereco_entrega
            })
                    
    return eventos
