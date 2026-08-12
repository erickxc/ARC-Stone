"""Esteira de produção: a ordem nasce com a venda e anda (ou volta) entre etapas."""
import models


def _login(client, user):
    resp = client.post("/auth/login", data={"username": user.email, "password": user._plain_password})
    assert resp.status_code == 200, resp.text
    return client


def _pagamento(client):
    tipos = client.get("/catalogos/tipos-pagamento?apenas_ativos=true").json()
    return {"tipo_pagamento_id": next(t for t in tipos if not t["exige_forma"])["id"]}


def _venda_direta(client, cliente, produto):
    resp = client.post("/orcamentos/", json={
        "cliente_id": cliente.id, "tipo_orcamento": "Peça", "modalidade": "venda_direta",
        "pagamento": _pagamento(client),
        "itens": [{"produto_id": produto.id, "quantidade": 1,
                   "preco_unitario_aplicado": 50000, "unidade_medida": "un"}]})
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_etapas_padrao_semeadas(client, make_user):
    _login(client, make_user(role="admin"))
    etapas = client.get("/catalogos/etapas-producao").json()
    nomes = [e["nome"] for e in etapas]
    assert nomes[:4] == ["Projeto", "Em Análise", "Aguardando material", "Corte"]
    assert etapas[-1]["is_final"] is True
    assert all(e["built_in"] for e in etapas)


def test_venda_abre_ordem_de_producao(client, make_user, make_client, make_product):
    """Vendeu, tem que produzir: a ordem nasce junto, na primeira etapa."""
    admin = make_user(role="admin")
    cliente = make_client(admin)
    produto = make_product(quantidade_estoque=10, quantidade_retida=0)
    _login(client, admin)
    _venda_direta(client, cliente, produto)

    ordens = client.get("/producao/ordens").json()
    assert ordens, "venda deveria ter aberto uma ordem de produção"
    ordem = ordens[0]
    assert ordem["etapa_nome"] == "Projeto"
    assert ordem["concluida_em"] is None
    assert ordem["cliente_nome"] == cliente.nome_fantasia
    assert ordem["valor_total"] == 50000
    assert produto.nome in (ordem["resumo_itens"] or "")


def test_mover_entre_etapas_registra_historico(client, make_user, make_client, make_product):
    admin = make_user(role="admin")
    cliente = make_client(admin)
    produto = make_product(quantidade_estoque=10, quantidade_retida=0)
    _login(client, admin)
    _venda_direta(client, cliente, produto)
    ordem_id = client.get("/producao/ordens").json()[0]["id"]

    etapas = client.get("/catalogos/etapas-producao").json()
    corte = next(e for e in etapas if e["nome"] == "Corte")
    resp = client.patch(f"/producao/ordens/{ordem_id}/mover",
                        json={"etapa_id": corte["id"], "observacao": "Chapa separada"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["etapa_nome"] == "Corte"

    detalhe = client.get(f"/producao/ordens/{ordem_id}").json()
    assert [h["etapa_nome"] for h in detalhe["historico"]] == ["Projeto", "Corte"]
    assert detalhe["historico"][-1]["observacao"] == "Chapa separada"


def test_etapa_final_conclui_e_sai_da_esteira(client, make_user, make_client, make_product):
    admin = make_user(role="admin")
    cliente = make_client(admin)
    produto = make_product(quantidade_estoque=10, quantidade_retida=0)
    _login(client, admin)
    _venda_direta(client, cliente, produto)
    ordem_id = client.get("/producao/ordens").json()[0]["id"]

    final = next(e for e in client.get("/catalogos/etapas-producao").json() if e["is_final"])
    resp = client.patch(f"/producao/ordens/{ordem_id}/mover", json={"etapa_id": final["id"]})
    assert resp.status_code == 200
    assert resp.json()["concluida_em"] is not None

    ativas = [o["id"] for o in client.get("/producao/ordens").json()]
    assert ordem_id not in ativas, "ordem concluída não deve poluir a esteira ativa"
    todas = [o["id"] for o in client.get("/producao/ordens?incluir_concluidas=true").json()]
    assert ordem_id in todas


def test_voltar_etapa_reabre_a_ordem(client, make_user, make_client, make_product):
    """Peça que quebra no corte refaz o caminho — voltar precisa reabrir a ordem."""
    admin = make_user(role="admin")
    cliente = make_client(admin)
    produto = make_product(quantidade_estoque=10, quantidade_retida=0)
    _login(client, admin)
    _venda_direta(client, cliente, produto)
    ordem_id = client.get("/producao/ordens").json()[0]["id"]

    etapas = client.get("/catalogos/etapas-producao").json()
    final = next(e for e in etapas if e["is_final"])
    corte = next(e for e in etapas if e["nome"] == "Corte")

    client.patch(f"/producao/ordens/{ordem_id}/mover", json={"etapa_id": final["id"]})
    resp = client.patch(f"/producao/ordens/{ordem_id}/mover",
                        json={"etapa_id": corte["id"], "observacao": "Quebrou, refazer"})
    assert resp.status_code == 200
    assert resp.json()["concluida_em"] is None, "voltar de uma etapa final precisa reabrir"


def test_vendedor_nao_move_ordem_mas_ve_a_propria(client, make_user, make_client, make_product):
    admin = make_user(role="admin")
    vendedor = make_user(role="vendedor")
    cliente = make_client(vendedor)
    produto = make_product(quantidade_estoque=10, quantidade_retida=0)

    _login(client, vendedor)
    _venda_direta(client, cliente, produto)
    minhas = client.get("/producao/ordens").json()
    assert len(minhas) == 1, "vendedor deve enxergar a produção da própria venda"
    ordem_id = minhas[0]["id"]

    etapas = client.get("/catalogos/etapas-producao").json()
    resp = client.patch(f"/producao/ordens/{ordem_id}/mover", json={"etapa_id": etapas[1]["id"]})
    assert resp.status_code == 403, "quem toca a oficina é admin/estoquista"

    # Vendedor de outra carteira não enxerga.
    _login(client, make_user(role="vendedor"))
    assert client.get("/producao/ordens").json() == []
    assert client.get(f"/producao/ordens/{ordem_id}").status_code == 403
    _login(client, admin)


def test_mover_para_etapa_inativa_recusado(client, make_user, make_client, make_product):
    admin = make_user(role="admin")
    cliente = make_client(admin)
    produto = make_product(quantidade_estoque=10, quantidade_retida=0)
    _login(client, admin)
    _venda_direta(client, cliente, produto)
    ordem_id = client.get("/producao/ordens").json()[0]["id"]

    etapas = client.get("/catalogos/etapas-producao").json()
    alvo = next(e for e in etapas if e["nome"] == "Acabamento")
    client.patch(f"/catalogos/etapas-producao/{alvo['id']}", json={"ativo": False})
    try:
        resp = client.patch(f"/producao/ordens/{ordem_id}/mover", json={"etapa_id": alvo["id"]})
        assert resp.status_code == 404
    finally:
        client.patch(f"/catalogos/etapas-producao/{alvo['id']}", json={"ativo": True})
