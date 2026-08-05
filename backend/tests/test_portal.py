from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from routers.portal import STATUS_PUBLICO, _formatar_condicoes, _publicar_proposta
from schemas import PortalDecisaoIn


def _proposta_fake():
    produto = SimpleNamespace(nome="Mesa", foto_url="https://cdn.example.com/mesa.jpg", preco_custo=999)
    item = SimpleNamespace(
        produto=produto,
        nome_externo=None,
        descricao_externa="Mesa sob medida",
        personalizacao_aplicada=None,
        quantidade=2,
        preco_unitario_aplicado=15000,
        local_instalacao="Sala",
        prazo_entrega_valor=30,
        prazo_entrega_unidade="dias",
        foto_externa_url=None,
    )
    anexo = SimpleNamespace(
        id=7,
        nome_original="memorial.pdf",
        extensao=".pdf",
        tamanho=2048,
        created_at=datetime(2026, 8, 5, tzinfo=timezone.utc),
        visivel_cliente=True,
    )
    return SimpleNamespace(
        id=42,
        tipo_orcamento="Venda",
        status="Orçamento gerado",
        cliente=SimpleNamespace(nome="Cliente Teste"),
        itens=[item],
        anexos=[anexo],
        anexo_url="uploads/proposta.pdf",
        data_entrega=None,
        arquiteto_nome="Arquiteto",
        arquiteto_contato="contato@example.com",
        condicoes_pagamento_selecionadas='["40% entrada", "3x sem juros"]',
        decisao_cliente=None,
        decisao_cliente_nome=None,
        decisao_cliente_motivo=None,
        decisao_cliente_em=None,
        created_at=datetime(2026, 8, 5, tzinfo=timezone.utc),
    )


def test_decisao_recusa_exige_motivo_humano():
    with pytest.raises(ValidationError):
        PortalDecisaoIn(acao="recusar", nome="Ana", motivo="curto")


def test_decisao_aprovacao_nao_exige_motivo():
    assert PortalDecisaoIn(acao="aprovar", nome="Ana").motivo is None


def test_resposta_publica_e_lista_branca_sem_custo_ou_fornecedor():
    resposta = _publicar_proposta(_proposta_fake())
    bruto = resposta.model_dump_json()

    assert resposta.valor_total == 30000
    assert resposta.condicoes_pagamento == "40% entrada, 3x sem juros"
    assert "preco_custo" not in bruto
    assert "fornecedor_externo" not in bruto
    assert "vendedor_id" not in bruto
    assert "url" not in resposta.documentos[0].model_dump()


def test_status_publico_nao_expoe_kanban_interno():
    assert STATUS_PUBLICO["Orçamento gerado"] == "Aguardando sua aprovação"
    assert STATUS_PUBLICO["Orçamento negado"] == "Encerrada"
