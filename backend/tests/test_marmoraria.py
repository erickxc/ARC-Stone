"""Regras específicas de marmoraria: medidas por unidade, serviço composto,
tipos de orçamento e venda direta."""
import pytest

from schemas import calcular_total_linha


def _login(client, user):
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200, resp.text
    return client


def _pagamento_simples(client):
    tipos = client.get("/catalogos/tipos-pagamento").json()
    return {"tipo_pagamento_id": next(t for t in tipos if not t["exige_forma"])["id"]}


# --- Fórmula do total da linha -------------------------------------------------

def test_total_por_area_usa_metros_quadrados():
    # Bancada 2,5 m × 0,6 m = 1,50 m² a R$ 300,00/m² -> R$ 450,00
    assert calcular_total_linha("m2", quantidade=1, preco_unitario=30000,
                                area_m2=1.5, comprimento_m=2.5) == 45000


def test_total_linear_ignora_largura():
    # Saia de 3,2 m a R$ 80,00/m -> R$ 256,00. A largura não entra na conta.
    assert calcular_total_linha("linear", quantidade=1, preco_unitario=8000,
                                area_m2=99.0, comprimento_m=3.2) == 25600


def test_total_por_unidade_usa_quantidade():
    # 3 cubas a R$ 120,00 -> R$ 360,00
    assert calcular_total_linha("un", quantidade=3, preco_unitario=12000,
                                area_m2=None, comprimento_m=None) == 36000


def test_total_por_area_multiplica_pela_quantidade():
    # 7 rodapés de 0,28x0,10 = 0,028 m² cada, a R$ 100,00/m² -> 7 x 2,80 = R$ 19,60.
    # Confirmado contra a planilha real do cliente (aba "Conferência": M2 = COMP*LARG*QTDE).
    assert calcular_total_linha("m2", quantidade=7, preco_unitario=10000,
                                area_m2=0.028, comprimento_m=None) == 1960


def test_total_linear_multiplica_pela_quantidade():
    # 3 saias de 2,0 m a R$ 80,00/m -> 3 x R$ 160,00 = R$ 480,00
    assert calcular_total_linha("linear", quantidade=3, preco_unitario=8000,
                                area_m2=None, comprimento_m=2.0) == 48000


def test_arredonda_uma_vez_no_fim():
    # 1,33 m² × R$ 100,015/m² daria fração de centavo; arredonda meio-para-cima no total.
    assert calcular_total_linha("m2", quantidade=1, preco_unitario=10001,
                                area_m2=1.33, comprimento_m=None) == 13301


# --- Validação de medidas ------------------------------------------------------

def test_item_em_m2_exige_comprimento_e_largura(client, make_user, make_client, make_product, make_tipo_peca):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product()
    tipo_peca = make_tipo_peca()
    _login(client, vendedor)

    resp = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Obra",
        "itens": [{"produto_id": produto.id, "tipo_peca_id": tipo_peca.id, "quantidade": 1,
                   "preco_unitario_aplicado": 10000, "unidade_medida": "m2",
                   "comprimento_m": 2.0}],  # largura faltando
    })
    assert resp.status_code == 422


def test_area_e_calculada_no_backend(client, make_user, make_client, make_product, make_tipo_peca):
    """area_m2 nunca vem do cliente: o PUT é substituição total, e aceitar do payload
    permitiria gravar área inconsistente com as medidas."""
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product()
    tipo_peca = make_tipo_peca()
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Obra",
        "itens": [{"produto_id": produto.id, "tipo_peca_id": tipo_peca.id, "quantidade": 1,
                   "preco_unitario_aplicado": 30000, "unidade_medida": "m2",
                   "comprimento_m": 2.5, "largura_m": 0.6}],
    })
    assert criado.status_code == 201, criado.text
    item = criado.json()["itens"][0]
    assert float(item["area_m2"]) == 1.5
    assert item["total_centavos"] == 45000
    assert item["codigo_item"] == 1


def test_desconto_global_abate_do_total(client, make_user, make_client, make_product, make_tipo_peca):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product()
    tipo_peca = make_tipo_peca()
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça",
        "desconto_global_centavos": 5000,
        "itens": [{"produto_id": produto.id, "tipo_peca_id": tipo_peca.id, "quantidade": 2,
                   "preco_unitario_aplicado": 10000, "unidade_medida": "un"}],
    })
    assert criado.status_code == 201, criado.text
    assert criado.json()["valor_total"] == 15000  # 20000 - 5000


# --- Tipo de orçamento ---------------------------------------------------------

def test_peca_nao_aceita_servico(client, make_user, make_client, db_session):
    import models
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    servico = models.Servico(nome="Instalação", preco_padrao=10000,
                             tempo_medio_valor=2, tempo_medio_unidade="horas")
    db_session.add(servico)
    db_session.commit()
    _login(client, vendedor)

    resp = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça",
        "itens": [{"servico_id": servico.id, "quantidade": 1, "preco_unitario_aplicado": 10000}],
    })
    assert resp.status_code == 422
    assert "serviço" in resp.text.lower()


def test_externo_so_aceita_item_externo(client, make_user, make_client, make_product, make_tipo_peca):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product()
    tipo_peca = make_tipo_peca()
    _login(client, vendedor)

    resp = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Externo",
        "itens": [{"produto_id": produto.id, "tipo_peca_id": tipo_peca.id, "quantidade": 1, "preco_unitario_aplicado": 10000}],
    })
    assert resp.status_code == 422


# --- Serviço composto ----------------------------------------------------------

def test_componentes_do_servico_crud(client, make_user, db_session):
    import models
    servico = models.Servico(nome="Bancada Banheiro Completa", preco_padrao=0,
                             tempo_medio_valor=4, tempo_medio_unidade="horas")
    db_session.add(servico)
    db_session.commit()
    _login(client, make_user(role="admin"))

    bancada = client.post(f"/servicos/{servico.id}/componentes",
                          json={"nome": "Bancada", "obrigatorio": True, "unidade_medida": "m2",
                                "preco_unitario": 30000})
    assert bancada.status_code == 201, bancada.text
    ilharga = client.post(f"/servicos/{servico.id}/componentes",
                          json={"nome": "Ilharga", "obrigatorio": False, "unidade_medida": "un",
                                "preco_unitario": 8000})
    assert ilharga.status_code == 201

    componentes = client.get(f"/servicos/{servico.id}/componentes").json()
    assert [c["nome"] for c in componentes] == ["Bancada", "Ilharga"]
    assert componentes[0]["obrigatorio"] is True and componentes[1]["obrigatorio"] is False

    # O serviço carrega os componentes junto — o Builder precisa deles para montar o item.
    detalhe = next(s for s in client.get("/servicos/").json() if s["id"] == servico.id)
    assert len(detalhe["componentes"]) == 2

    assert client.delete(f"/servicos/{servico.id}/componentes/{ilharga.json()['id']}").status_code == 204


# --- Modalidade / venda direta -------------------------------------------------

def test_venda_direta_exige_pagamento(client, make_user, make_client, make_product, make_tipo_peca):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product()
    tipo_peca = make_tipo_peca()
    _login(client, vendedor)

    resp = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça", "modalidade": "venda_direta",
        "itens": [{"produto_id": produto.id, "tipo_peca_id": tipo_peca.id, "quantidade": 1, "preco_unitario_aplicado": 10000}],
    })
    assert resp.status_code == 422
    assert "pagamento" in resp.text.lower()


def test_venda_direta_cria_orcamento_e_venda_na_mesma_transacao(client, make_user, make_client, make_product, make_tipo_peca):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product()
    tipo_peca = make_tipo_peca()
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça", "modalidade": "venda_direta",
        "pagamento": _pagamento_simples(client),
        "itens": [{"produto_id": produto.id, "tipo_peca_id": tipo_peca.id, "quantidade": 2,
                   "preco_unitario_aplicado": 10000, "unidade_medida": "un"}],
    })
    assert criado.status_code == 201, criado.text
    corpo = criado.json()
    # Cliente presente e pago: não passa pelo funil de proposta.
    assert corpo["modalidade"] == "venda_direta"
    assert corpo["status"] == "Aprovado"

    vendas = [v for v in client.get("/orcamentos/vendas/historico").json()
              if v["orcamento_id"] == corpo["id"]]
    assert len(vendas) == 1
    assert vendas[0]["valor_total"] == 20000
    assert vendas[0]["tipo_pagamento_nome"] is not None


def test_orcamento_formal_nao_cria_venda(client, make_user, make_client, make_product, make_tipo_peca):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product()
    tipo_peca = make_tipo_peca()
    _login(client, vendedor)

    criado = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça",
        "itens": [{"produto_id": produto.id, "tipo_peca_id": tipo_peca.id, "quantidade": 1, "preco_unitario_aplicado": 10000}],
    })
    assert criado.status_code == 201
    assert criado.json()["modalidade"] == "orcamento_formal"
    assert criado.json()["status"] == "Gerando orçamento"

    vendas = [v for v in client.get("/orcamentos/vendas/historico").json()
              if v["orcamento_id"] == criado.json()["id"]]
    assert vendas == []


def test_pagamento_em_cartao_exige_forma(client, make_user, make_client, make_product, make_tipo_peca):
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product()
    tipo_peca = make_tipo_peca()
    _login(client, vendedor)

    cartao = next(t for t in client.get("/catalogos/tipos-pagamento").json() if t["exige_forma"])
    resp = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça", "modalidade": "venda_direta",
        "pagamento": {"tipo_pagamento_id": cartao["id"]},  # sem forma
        "itens": [{"produto_id": produto.id, "tipo_peca_id": tipo_peca.id, "quantidade": 1, "preco_unitario_aplicado": 10000}],
    })
    assert resp.status_code == 400
    assert "forma" in resp.json()["detail"].lower()
